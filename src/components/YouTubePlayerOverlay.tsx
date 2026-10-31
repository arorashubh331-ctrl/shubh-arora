import React, { useState, useEffect, useRef } from 'react';
import { YouTubePlayerState, youtubeController } from '../modules/desktop/YouTubeController';
import { ThemeConfig } from '../types/assistant';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, ExternalLink, X, Music2, AlertTriangle, Loader2, SkipForward } from 'lucide-react';

interface YouTubePlayerOverlayProps {
  playerState: YouTubePlayerState;
  theme: ThemeConfig;
}

// Helper to ensure YouTube IFrame API script is inserted and loaded
let iframeApiLoadingPromise: Promise<void> | null = null;
function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve();
  }

  if (iframeApiLoadingPromise) {
    return iframeApiLoadingPromise;
  }

  iframeApiLoadingPromise = new Promise((resolve) => {
    const existingScript = document.getElementById('youtube-iframe-api-tag');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-tag';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript?.parentNode?.insertBefore(tag, firstScript);
    }

    const previousReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve();
    };

    // Polling fallback in case onYouTubeIframeAPIReady already fired
    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });

  return iframeApiLoadingPromise;
}

export const YouTubePlayerOverlay: React.FC<YouTubePlayerOverlayProps> = ({ playerState, theme }) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const lastLoadedVideoIdRef = useRef<string | null>(null);

  // If there is no active query, video, or failure state, do not render
  const isVisible = Boolean(playerState.videoId || playerState.isLoading || playerState.embeddingFailed);

  // Initialize YouTube IFrame Player when videoId is available
  useEffect(() => {
    if (!isVisible || playerState.embeddingFailed || !playerState.videoId) return;

    let isSubscribed = true;

    loadYouTubeIframeAPI().then(() => {
      if (!isSubscribed || !playerContainerRef.current) return;

      // If player already exists, load the new video ID if changed
      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        if (lastLoadedVideoIdRef.current !== playerState.videoId) {
          lastLoadedVideoIdRef.current = playerState.videoId;
          ytPlayerRef.current.loadVideoById(playerState.videoId);
        }
        return;
      }

      // Create new YT.Player instance
      try {
        lastLoadedVideoIdRef.current = playerState.videoId;
        const player = new (window as any).YT.Player(playerContainerRef.current, {
          height: '100%',
          width: '100%',
          videoId: playerState.videoId,
          playerVars: {
            autoplay: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              youtubeController.attachPlayerInstance(event.target);
              event.target.setVolume(playerState.volume);
              if (playerState.isMuted) {
                event.target.mute();
              } else {
                event.target.unMute();
              }
              event.target.playVideo();
            },
            onStateChange: (event: any) => {
              if (!isSubscribed) return;
              const state = event.data;
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (state === 1) {
                youtubeController.handlePlayerPlaying();
              } else if (state === 2) {
                youtubeController.handlePlayerPaused();
              } else if (state === 0) {
                youtubeController.handlePlayerEnded();
              }
            },
            onError: (event: any) => {
              if (!isSubscribed) return;
              const errorCode = event.data;
              console.warn('[YouTubePlayerOverlay] YT.Player error event code:', errorCode);
              // Requirement 3: If error code is 100, 101, or 150, automatically try next result
              youtubeController.handlePlayerError(errorCode);
            },
          },
        });

        ytPlayerRef.current = player;
      } catch (err) {
        console.error('[YouTubePlayerOverlay] Error creating YT.Player:', err);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [playerState.videoId, playerState.embeddingFailed, isVisible]);

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      if (ytPlayerRef.current) {
        try {
          if (typeof ytPlayerRef.current.destroy === 'function') {
            ytPlayerRef.current.destroy();
          }
        } catch {}
        ytPlayerRef.current = null;
      }
      youtubeController.detachPlayerInstance();
    };
  }, []);

  if (!isVisible) return null;

  const handleTogglePlay = () => {
    if (playerState.isPlaying) {
      youtubeController.pauseVideo();
    } else {
      youtubeController.resumeVideo();
    }
  };

  const handleToggleMute = () => {
    youtubeController.toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    youtubeController.setVolume(val);
  };

  const handleClose = () => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === 'function') {
      try {
        ytPlayerRef.current.stopVideo();
      } catch {}
    }
    youtubeController.closePlayer();
  };

  // Requirement 4: Button that opens watch URL in new tab
  const watchUrl = playerState.failedVideoId
    ? `https://www.youtube.com/watch?v=${playerState.failedVideoId}`
    : playerState.videoId
    ? `https://www.youtube.com/watch?v=${playerState.videoId}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(playerState.query || '')}`;

  const handleOpenExternal = () => {
    window.open(watchUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <aside
      aria-label="YouTube Media Player"
      className="fixed bottom-24 left-4 z-40 max-w-sm w-[92vw] sm:w-[380px] rounded-2xl border backdrop-blur-2xl bg-zinc-950/95 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-6"
      style={{
        borderColor: `${theme.primary}50`,
        boxShadow: `0 12px 40px rgba(0,0,0,0.8), 0 0 25px ${theme.primary}30`,
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${theme.primary}25`, color: theme.primary }}
          >
            <Music2 className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase truncate">
            YouTube Player
          </span>

          {/* Status badge */}
          {playerState.isPlaying ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              Playing
            </span>
          ) : playerState.isLoading ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Buffering
            </span>
          ) : playerState.embeddingFailed ? (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 font-medium">
              <AlertTriangle className="w-2.5 h-2.5" />
              Restricted
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isMinimized ? 'Expand Player' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleOpenExternal}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Open in YouTube"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Content & Controls */}
      {!isMinimized && (
        <div className="p-3 flex flex-col gap-3">
          {/* Requirement 4: If all results fail, show clear message and 'Open on YouTube' button */}
          {playerState.embeddingFailed ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-rose-500/30 flex flex-col items-center justify-center p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h5 className="text-xs font-bold text-white mb-1">Video Embedding Restricted</h5>
              <p className="text-[11px] text-zinc-400 mb-3 max-w-[280px] leading-relaxed">
                This song cannot be played inside the app due to content owner restrictions.
              </p>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open on YouTube</span>
              </button>
            </div>
          ) : (
            /* Real Embedded YouTube Player rendered via YouTube IFrame Player API */
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-inner">
              <div ref={playerContainerRef} className="w-full h-full" />
              {playerState.isLoading && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 pointer-events-none p-3 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                  <span className="text-[11px] text-zinc-200 font-medium">
                    {playerState.statusText || 'Finding playable version...'}
                  </span>
                  {playerState.candidates.length > 1 && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Candidate {playerState.currentIndex + 1} of {playerState.candidates.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title & Artist/Query */}
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white tracking-wide truncate">
              {playerState.videoTitle || (playerState.query ? `Search: ${playerState.query}` : 'YouTube Track')}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 truncate flex items-center gap-1.5">
              <span>Voice controlled by Lucy</span>
              {playerState.candidates.length > 0 && (
                <>
                  <span>•</span>
                  <span>Track {playerState.currentIndex + 1} of {playerState.candidates.length}</span>
                </>
              )}
            </p>
          </div>

          {/* Quick Playback Bar */}
          {!playerState.embeddingFailed && (
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTogglePlay}
                  disabled={playerState.isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs text-white transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.primary,
                    boxShadow: `0 4px 15px ${theme.primary}50`,
                  }}
                >
                  {playerState.isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => youtubeController.nextResult()}
                  disabled={playerState.isLoading}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-40"
                  title="Next Result"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Volume & Mute */}
              <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                <button
                  onClick={handleToggleMute}
                  className="text-zinc-400 hover:text-white cursor-pointer transition-colors p-1"
                  title={playerState.isMuted ? 'Unmute' : 'Mute'}
                >
                  {playerState.isMuted || playerState.volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playerState.isMuted ? 0 : playerState.volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                  style={{ accentColor: theme.primary }}
                />
                <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">
                  {playerState.isMuted ? '0%' : `${playerState.volume}%`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minimized Compact Bar */}
      {isMinimized && (
        <div className="p-2.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-200 truncate flex-1">
            {playerState.videoTitle || playerState.query}
          </p>
          {!playerState.embeddingFailed ? (
            <button
              onClick={handleTogglePlay}
              className="p-1.5 rounded-lg text-white cursor-pointer hover:bg-white/10"
              style={{ color: theme.primary }}
            >
              {playerState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          ) : (
            <button
              onClick={handleOpenExternal}
              className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
