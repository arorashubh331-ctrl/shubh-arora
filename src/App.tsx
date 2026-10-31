import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantState, AuraTheme, ActiveTimer, QuickNote, ToolNotification } from './types/assistant';
import { THEMES } from './utils/themeConfig';
import { AudioStreamer } from './modules/AudioStreamer';
import { AudioPlayer } from './modules/AudioPlayer';
import { ToolManager } from './modules/ToolManager';
import { LiveSession } from './modules/LiveSession';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { CentralControl } from './components/CentralControl';
import { HUDHeader } from './components/HUDHeader';
import { ActiveToolsDisplay } from './components/ActiveToolsDisplay';
import { SettingsDrawer } from './components/SettingsDrawer';
import { VoiceGuideModal } from './components/VoiceGuideModal';
import { SuggestionPills } from './components/SuggestionPills';
import { AlertCircle, WifiOff } from 'lucide-react';
import { youtubeController, YouTubePlayerState } from './modules/desktop/YouTubeController';
import { documentManager, ActiveDocument } from './modules/desktop/DocumentManager';
import { permissionManager } from './modules/desktop/ActionPlanner';
import { YouTubePlayerOverlay } from './components/YouTubePlayerOverlay';
import { BrowserPanelOverlay } from './components/BrowserPanelOverlay';
import { LucyBrowserOverlay } from './components/LucyBrowserOverlay';
import { ActiveDocumentModal } from './components/ActiveDocumentModal';
import { EmergencyStopBanner } from './components/EmergencyStopBanner';
import { DesktopCompanionModal } from './components/DesktopCompanionModal';
import { MemoryDashboardModal } from './components/MemoryDashboardModal';
import { wakeWordDetector } from './modules/WakeWordDetector';
import { browserPanelController, BrowserPanelState } from './modules/desktop/BrowserPanelController';
import { cloudBrowserController, CloudBrowserState } from './modules/desktop/CloudBrowserController';

const LOCAL_STORAGE_NOTES_KEY = 'lucy_voice_notes_v1';
const LOCAL_STORAGE_THEME_KEY = 'lucy_active_theme_v1';
const LOCAL_STORAGE_VOICE_KEY = 'lucy_active_voice_v1';

export default function App() {
  const [state, setState] = useState<AssistantState>('disconnected');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<AuraTheme>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_THEME_KEY) as AuraTheme) || 'cyberpunk';
  });
  const [activeVoice, setActiveVoice] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_VOICE_KEY) || 'Zephyr';
  });
  const [volume, setVolume] = useState<number>(1.0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active tools state
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [notes, setNotes] = useState<QuickNote[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notifications, setNotifications] = useState<ToolNotification[]>([]);

  // Real Desktop & Media states
  const [youtubeState, setYoutubeState] = useState<YouTubePlayerState>(() => youtubeController.getState());
  const [browserPanelState, setBrowserPanelState] = useState<BrowserPanelState>(() => browserPanelController.getState());
  const [cloudBrowserState, setCloudBrowserState] = useState<CloudBrowserState>(() => cloudBrowserController.getState());
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(() => permissionManager.isStopped());

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isDesktopCompanionOpen, setIsDesktopCompanionOpen] = useState<boolean>(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);

  // Core modules refs
  const streamerRef = useRef<AudioStreamer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const toolManagerRef = useRef<ToolManager | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  // Toast deduplication helper: prevents repeating the same notification within 4 seconds
  const addDeduplicatedToast = useCallback((notif: ToolNotification) => {
    setNotifications((prev) => {
      const isDuplicate = prev.some(
        (existing) =>
          existing.id === notif.id ||
          (existing.title === notif.title && Math.abs(existing.timestamp - notif.timestamp) < 4000) ||
          (existing.tool === notif.tool && existing.description === notif.description && Math.abs(existing.timestamp - notif.timestamp) < 4000)
      );
      if (isDuplicate) return prev;
      return [notif, ...prev.slice(0, 3)];
    });
  }, []);

  // Initialize modules once
  useEffect(() => {
    const streamer = new AudioStreamer();
    const player = new AudioPlayer();
    const toolManager = new ToolManager();
    const session = new LiveSession(streamer, player, toolManager);

    streamerRef.current = streamer;
    playerRef.current = player;
    toolManagerRef.current = toolManager;
    liveSessionRef.current = session;

    session.setVoice(activeVoice);

    // Register Tool Manager Callbacks
    toolManager.setCallbacks({
      onNotification: (notif) => {
        addDeduplicatedToast(notif);
      },
      onThemeChange: (theme) => {
        setActiveTheme(theme);
        localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
      },
      onTimerCreate: (timer) => {
        setTimers((prev) => [timer, ...prev]);
      },
      onNoteCreate: (note) => {
        setNotes((prev) => {
          const updated = [note, ...prev];
          localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(updated));
          return updated;
        });
      },
    });

    // Register YouTube, Browser Panel & Document Callbacks
    youtubeController.setOnStateChange((ytState) => {
      setYoutubeState(ytState);
    });

    browserPanelController.setOnStateChange((pState) => {
      setBrowserPanelState(pState);
    });

    cloudBrowserController.setOnStateChange((cbState) => {
      setCloudBrowserState(cbState);
    });

    // Requirement 5: Show the success toast ("Playing ...") only after the player confirms playback started, not when the tool is called.
    youtubeController.setOnPlayConfirmed((title, videoId) => {
      addDeduplicatedToast({
        id: `youtube-playing-${Date.now()}`,
        tool: 'youtubeSearchAndPlay',
        title: 'Playing on YouTube',
        description: title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        timestamp: Date.now(),
      });
    });

    documentManager.setOnDocumentCreated((doc) => {
      setActiveDocument(doc);
    });

    session.setOnStateChange((newState) => {
      setState(newState);
      if (newState !== 'error') {
        setErrorMessage(null);
      }
    });

    session.setOnError((err) => {
      setErrorMessage(err);
    });

    // Start Hands-Free Wake Word Detector ("Hey Lucy")
    wakeWordDetector.setCallbacks({
      onWake: () => {
        console.log('[App] "Hey Lucy" wake word detected');
        if (session.getState() === 'disconnected') {
          session.connect();
        } else if (session.isMuted()) {
          session.toggleMute();
          setIsMuted(false);
        }
        addDeduplicatedToast({
          id: `wake-${Date.now()}`,
          tool: 'wakeWord',
          title: 'Lucy is listening! ❤️',
          description: '"Hey Lucy" hands-free voice trigger activated.',
          timestamp: Date.now(),
        });
      },
    });
    wakeWordDetector.start();

    // Electron Global Shortcut listener
    if ((window as any).electronAPI?.onWakeShortcut) {
      (window as any).electronAPI.onWakeShortcut(() => {
        wakeWordDetector.triggerWake();
      });
    }

    return () => {
      session.disconnect();
      wakeWordDetector.stop();
    };
  }, []);

  // Update theme in local storage
  const handleSelectTheme = (theme: AuraTheme) => {
    setActiveTheme(theme);
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
  };

  // Update voice in session and local storage
  const handleSelectVoice = (voice: string) => {
    setActiveVoice(voice);
    localStorage.setItem(LOCAL_STORAGE_VOICE_KEY, voice);
    if (liveSessionRef.current) {
      liveSessionRef.current.setVoice(voice);
    }
  };

  // Volume slider
  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    if (playerRef.current) {
      playerRef.current.setVolume(vol);
    }
  };

  // Connect or disconnect
  const handleToggleConnect = async () => {
    if (!liveSessionRef.current) return;

    if (state === 'disconnected' || state === 'error') {
      setErrorMessage(null);
      await liveSessionRef.current.connect();
    } else {
      liveSessionRef.current.disconnect();
    }
  };

  // Mute toggle
  const handleToggleMute = () => {
    if (!liveSessionRef.current) return;
    const muted = liveSessionRef.current.toggleMute();
    setIsMuted(muted);
  };

  // Interruption
  const handleInterrupt = () => {
    if (!liveSessionRef.current) return;
    liveSessionRef.current.interruptAssistant();
  };

  // Dismiss notification
  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Dismiss timer
  const handleDismissTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    setNotes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearAllNotes = () => {
    setNotes([]);
    localStorage.removeItem(LOCAL_STORAGE_NOTES_KEY);
  };

  // Emergency stop handlers
  const handleEmergencyStop = () => {
    permissionManager.triggerEmergencyStop();
    setIsEmergencyStopped(true);
    youtubeController.pauseVideo();
    if (liveSessionRef.current) {
      liveSessionRef.current.interruptAssistant();
    }
  };

  const handleResumeControls = () => {
    permissionManager.resetEmergencyStop();
    setIsEmergencyStopped(false);
  };

  // Visualizer data callback
  const getVisualizerData = useCallback(() => {
    if (liveSessionRef.current) {
      return liveSessionRef.current.getVisualizerData();
    }
    return { level: 0, frequencies: new Uint8Array(0), source: 'idle' as const };
  }, []);

  const currentTheme = THEMES[activeTheme] || THEMES.cyberpunk;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col justify-between select-none">
      {/* 1. Ambient Background Lighting Beam & Radial Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Animated background aura gradient */}
        <div
          className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[120vw] h-[100vw] rounded-full opacity-30 filter blur-[120px] transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, ${currentTheme.primary} 0%, ${currentTheme.secondary} 40%, transparent 70%)`,
          }}
        />

        {/* Ambient bottom glow */}
        <div
          className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[90vw] h-[60vw] rounded-full opacity-20 filter blur-[100px] transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, ${currentTheme.accent} 0%, transparent 70%)`,
          }}
        />

        {/* Subtle futuristic high-tech grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* 2. Audio-reactive Dynamic Canvas Waveform Visualizer */}
      <WaveformVisualizer
        state={state}
        theme={currentTheme}
        getVisualizerData={getVisualizerData}
      />

      {/* 3. Top HUD Navigation */}
      <HUDHeader
        state={state}
        theme={currentTheme}
        activeVoice={activeVoice}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenDesktopCompanion={() => setIsDesktopCompanionOpen(true)}
        onOpenMemory={() => setIsMemoryOpen(true)}
      />

      {/* 4. Active Tool Notifications & Timers HUD */}
      <ActiveToolsDisplay
        timers={timers}
        notes={notes}
        notifications={notifications}
        theme={currentTheme}
        onDismissTimer={handleDismissTimer}
        onDismissNote={handleDeleteNote}
        onDismissNotification={handleDismissNotification}
        onUpdateTimers={setTimers}
      />

      {/* 5. Error Banner if connection fails */}
      {errorMessage && (
        <div className="relative z-30 mx-auto px-4 max-w-md w-full animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 backdrop-blur-xl text-rose-200 text-xs shadow-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={handleToggleConnect}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer shrink-0 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 6. Central Iconic Voice Orb & Controls */}
      <main className="relative z-10 flex-1 flex items-center justify-center">
        <CentralControl
          state={state}
          theme={currentTheme}
          isMuted={isMuted}
          onToggleConnect={handleToggleConnect}
          onToggleMute={handleToggleMute}
          onInterrupt={handleInterrupt}
        />
      </main>

      {/* 7. Bottom Voice Suggestions Carousel */}
      <SuggestionPills theme={currentTheme} />

      {/* 8. Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTheme={activeTheme}
        onSelectTheme={handleSelectTheme}
        activeVoice={activeVoice}
        onSelectVoice={handleSelectVoice}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        notes={notes}
        onDeleteNote={handleDeleteNote}
        onClearAllNotes={handleClearAllNotes}
      />

      {/* 9. Voice Guide Modal */}
      <VoiceGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        theme={currentTheme}
      />

      {/* 10. Floating Real YouTube Video Player Overlay */}
      <YouTubePlayerOverlay
        playerState={youtubeState}
        theme={currentTheme}
      />

      {/* 11. Document Preview & Action Modal */}
      <ActiveDocumentModal
        document={activeDocument}
        theme={currentTheme}
        onClose={() => setActiveDocument(null)}
      />

      {/* 12. Emergency Stop Status & Quick Action Button */}
      <EmergencyStopBanner
        isStopped={isEmergencyStopped}
        theme={currentTheme}
        onResume={handleResumeControls}
        onEmergencyStop={handleEmergencyStop}
      />

      {/* 13. Windows 11 Desktop Companion Modal */}
      <DesktopCompanionModal
        isOpen={isDesktopCompanionOpen}
        onClose={() => setIsDesktopCompanionOpen(false)}
        theme={currentTheme}
      />

      {/* 14. Cognitive Memory Dashboard Modal */}
      <MemoryDashboardModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        theme={currentTheme}
      />

      {/* 14. Floating In-App Browser Panel */}
      <BrowserPanelOverlay
        panelState={browserPanelState}
        theme={currentTheme}
      />

      {/* 15. Floating Remote Cloud Browser Panel (Lucy Browser) */}
      <LucyBrowserOverlay
        browserState={cloudBrowserState}
        theme={currentTheme}
      />
    </div>
  );
}
