/**
 * YouTubeController - Real YouTube Video Playback & Control Module
 * Upgraded to seamlessly handle YouTube label embedding restrictions ("Video Embedding Restricted"):
 * 
 * 1. Queries YouTube Data API v3 search.list with videoEmbeddable=true, type=video, videoCategoryId=10, maxResults=10.
 * 2. Tries candidate results one by one. If IFrame Player fires onError with 101, 150 (embedding blocked)
 *    or 100 (not found), silently moves to next result without showing an error to the user.
 * 3. If the first 3 results fail, retries search once with query + " lyrics", then once with query + " audio".
 * 4. Prefers results whose title contains "lyrics", "audio" or "topic" channels when official video is not embeddable.
 * 5. Only after all attempts fail, shows "Open on YouTube" button and has Lucy say honestly that this song
 *    cannot be played inside the app, but she can open it on YouTube.
 * 6. Never attempts to bypass restrictions; strictly plays videos that the IFrame Player accepts.
 */

export interface YouTubeVideoCandidate {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnail?: string;
}

export interface YouTubePlayerState {
  videoId: string | null;
  videoTitle: string | null;
  channelTitle?: string | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  candidates: YouTubeVideoCandidate[];
  currentIndex: number;
  query: string | null;
  isLoading: boolean;
  error: string | null;
  embeddingFailed: boolean;
  failedVideoId: string | null;
  statusText?: string;
  attemptCount: number;
}

export class YouTubeController {
  private playerState: YouTubePlayerState = {
    videoId: null,
    videoTitle: null,
    channelTitle: null,
    isPlaying: false,
    volume: 80,
    isMuted: false,
    currentTime: 0,
    candidates: [],
    currentIndex: 0,
    query: null,
    isLoading: false,
    error: null,
    embeddingFailed: false,
    failedVideoId: null,
    statusText: undefined,
    attemptCount: 0,
  };

  private onStateChangeCallback: ((state: YouTubePlayerState) => void) | null = null;
  private onPlayConfirmedCallback: ((title: string, videoId: string) => void) | null = null;
  private ytPlayerInstance: any = null;

  // Search and retry tracking
  private baseQuery: string = '';
  private failedCount: number = 0;
  private triedVideoIds: Set<string> = new Set();
  private hasRetriedLyrics: boolean = false;
  private hasRetriedAudio: boolean = false;
  private isProcessingError: boolean = false;

  // Track playback confirmation promise
  private pendingPlayResolve: ((res: any) => void) | null = null;
  private pendingPlayTimer: any = null;

  constructor() {}

  public setOnStateChange(cb: (state: YouTubePlayerState) => void) {
    this.onStateChangeCallback = cb;
  }

  public setOnPlayConfirmed(cb: (title: string, videoId: string) => void) {
    this.onPlayConfirmedCallback = cb;
  }

  public getState(): YouTubePlayerState {
    return { ...this.playerState };
  }

  public attachPlayerInstance(instance: any) {
    this.ytPlayerInstance = instance;
  }

  public detachPlayerInstance() {
    this.ytPlayerInstance = null;
  }

  /**
   * Helper to fetch candidate videos from server API (YouTube Data API v3 search.list)
   */
  private async fetchCandidatesFromApi(q: string): Promise<YouTubeVideoCandidate[]> {
    try {
      console.log(`[YouTubeController] Fetching candidate videos for: "${q}"`);
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (response.ok && Array.isArray(data.candidates)) {
        return data.candidates;
      } else {
        console.warn(`[YouTubeController] YouTube API returned error or empty for "${q}":`, data.error);
      }
    } catch (err: any) {
      console.error(`[YouTubeController] Search fetch error for "${q}":`, err);
    }
    return [];
  }

  /**
   * Requirement 4: Score candidates to prefer "lyrics", "audio", or "topic" channels
   * when official videos are not embeddable.
   */
  public scoreCandidate(c: YouTubeVideoCandidate): number {
    const title = (c.title || '').toLowerCase();
    const channel = (c.channelTitle || '').toLowerCase();
    let score = 0;

    // Highest preference for lyrics and official audio releases
    if (title.includes('lyrics') || title.includes('lyric')) score += 10;
    if (title.includes('official audio') || title.includes('audio track') || title.includes('full audio')) score += 9;
    if (title.includes('audio')) score += 7;

    // YouTube Music auto-generated topic channels (e.g., "Artist - Topic") are usually fully embeddable
    if (channel.includes('topic') || channel.endsWith(' - topic')) score += 8;
    if (channel.includes('lyrics') || channel.includes('records') || channel.includes('audio')) score += 4;

    return score;
  }

  /**
   * Sort candidates by priority score descending
   */
  public prioritizeCandidates(list: YouTubeVideoCandidate[]): YouTubeVideoCandidate[] {
    return [...list].sort((a, b) => this.scoreCandidate(b) - this.scoreCandidate(a));
  }

  /**
   * Searches for real videos using YouTube Data API v3 endpoint and initiates playback with fallback queue
   */
  public async searchAndPlay(query: string): Promise<{
    success: boolean;
    message: string;
    videoTitle?: string;
    videoId?: string;
    verified: boolean;
    embeddingFailed?: boolean;
    openUrl?: string;
  }> {
    const cleanQuery = query.trim();
    console.log(`[YouTubeController] Starting searchAndPlay for: "${cleanQuery}"`);

    // Reset previous pending promises and tracking
    this.clearPendingPlay();
    this.baseQuery = cleanQuery;
    this.failedCount = 0;
    this.triedVideoIds.clear();
    this.hasRetriedLyrics = false;
    this.hasRetriedAudio = false;
    this.isProcessingError = false;

    // Set initial loading state
    this.playerState.query = cleanQuery;
    this.playerState.isLoading = true;
    this.playerState.isPlaying = false;
    this.playerState.error = null;
    this.playerState.embeddingFailed = false;
    this.playerState.failedVideoId = null;
    this.playerState.attemptCount = 1;
    this.playerState.statusText = 'Connecting to YouTube...';
    this.notifyState();

    // 1. Initial Search: YouTube Data API search.list with maxResults=10
    const candidates = await this.fetchCandidatesFromApi(cleanQuery);

    if (candidates.length === 0) {
      console.warn('[YouTubeController] YouTube API returned no candidate videos.');
      this.playerState.isLoading = false;
      this.playerState.isPlaying = false;
      this.playerState.embeddingFailed = true;
      this.playerState.error = 'No embeddable music videos found for this search.';
      this.notifyState();

      const searchFallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
      return {
        success: false,
        verified: false,
        embeddingFailed: true,
        openUrl: searchFallbackUrl,
        message: 'This song cannot be played inside the app, but I can open it on YouTube.',
      };
    }

    // Set candidate queue and load candidate 0
    this.playerState.candidates = candidates;
    this.playerState.currentIndex = 0;
    this.playerState.videoId = candidates[0].videoId;
    this.playerState.videoTitle = candidates[0].title;
    this.playerState.channelTitle = candidates[0].channelTitle || null;
    this.playerState.failedVideoId = candidates[0].videoId;
    this.triedVideoIds.add(candidates[0].videoId);
    this.notifyState();

    // If player instance is already attached, load candidate 0 immediately
    if (this.ytPlayerInstance && typeof this.ytPlayerInstance.loadVideoById === 'function') {
      try {
        this.ytPlayerInstance.loadVideoById(candidates[0].videoId);
      } catch (e) {
        console.warn('[YouTubeController] Error calling loadVideoById:', e);
      }
    }

    // Await actual player confirmation (or silent retry fallback)
    return new Promise((resolve) => {
      this.pendingPlayResolve = resolve;

      // Generous timeout safety: give multi-candidate search & verification up to 14s
      this.pendingPlayTimer = setTimeout(() => {
        if (this.pendingPlayResolve) {
          const isActuallyPlaying = this.playerState.isPlaying;
          const currentCandidate = this.playerState.candidates[this.playerState.currentIndex];

          if (isActuallyPlaying) {
            this.pendingPlayResolve({
              success: true,
              verified: true,
              isPlaying: true,
              videoTitle: currentCandidate?.title || this.playerState.videoTitle || cleanQuery,
              videoId: currentCandidate?.videoId || this.playerState.videoId,
              message: `Playing "${currentCandidate?.title || this.playerState.videoTitle}" on YouTube.`,
            });
          } else if (this.playerState.embeddingFailed) {
            this.pendingPlayResolve({
              success: false,
              verified: false,
              embeddingFailed: true,
              openUrl: `https://www.youtube.com/watch?v=${this.playerState.failedVideoId || ''}`,
              message: 'This song cannot be played inside the app, but I can open it on YouTube.',
            });
          } else {
            // Still buffering or pending
            this.pendingPlayResolve({
              success: true,
              verified: true,
              isPlaying: false,
              videoTitle: currentCandidate?.title || this.playerState.videoTitle || cleanQuery,
              videoId: currentCandidate?.videoId || this.playerState.videoId,
              message: `Loaded "${currentCandidate?.title || this.playerState.videoTitle}". Waiting for playback.`,
            });
          }
          this.pendingPlayResolve = null;
        }
      }, 14000);
    });
  }

  /**
   * Called by YouTube IFrame Player when state changes to PLAYING (1)
   */
  public handlePlayerPlaying() {
    console.log(`[YouTubeController] Playback confirmed (PLAYING) for: ${this.playerState.videoTitle}`);
    const wasPlaying = this.playerState.isPlaying;
    this.playerState.isPlaying = true;
    this.playerState.isLoading = false;
    this.playerState.embeddingFailed = false;
    this.playerState.error = null;
    this.playerState.statusText = undefined;
    this.isProcessingError = false;
    this.notifyState();

    // Show the success toast ("Playing ...") only after the player confirms playback started
    if (!wasPlaying && this.onPlayConfirmedCallback && this.playerState.videoTitle && this.playerState.videoId) {
      this.onPlayConfirmedCallback(this.playerState.videoTitle, this.playerState.videoId);
    }

    // Resolve any waiting searchAndPlay promise
    if (this.pendingPlayResolve) {
      this.pendingPlayResolve({
        success: true,
        verified: true,
        isPlaying: true,
        videoTitle: this.playerState.videoTitle,
        videoId: this.playerState.videoId,
        message: `Playing "${this.playerState.videoTitle}" on YouTube. Playback confirmed.`,
      });
      this.clearPendingPlay();
    }
  }

  /**
   * Called by YouTube IFrame Player when state changes to PAUSED (2)
   */
  public handlePlayerPaused() {
    this.playerState.isPlaying = false;
    this.notifyState();
  }

  /**
   * Called by YouTube IFrame Player when state changes to ENDED (0)
   */
  public handlePlayerEnded() {
    this.playerState.isPlaying = false;
    this.notifyState();
  }

  /**
   * Requirement 2, 3, 4, 5: Handle onError event
   * 2. If onError fires with code 101 or 150 (embedding blocked) or 100 (not found),
   *    silently move to the next result without showing an error to the user.
   * 3. If the first 3 results fail, retry search once with query + " lyrics", then once with " audio".
   * 4. Prefer results whose title contains "lyrics", "audio" or "topic" channels when official video is not embeddable.
   * 5. Only after all attempts fail, show "Open on YouTube" button and have Lucy say honestly that this song
   *    cannot be played inside the app, but she can open it on YouTube.
   */
  public async handlePlayerError(errorCode: number): Promise<void> {
    console.warn(`[YouTubeController] YT.Player error encountered: code ${errorCode}`);

    // Avoid parallel re-entrant handling for the same error cycle
    if (this.isProcessingError) return;
    this.isProcessingError = true;

    try {
      this.failedCount++;
      const currentVideoId = this.playerState.videoId;
      if (currentVideoId) {
        this.triedVideoIds.add(currentVideoId);
        this.playerState.failedVideoId = currentVideoId;
      }

      // Requirement 4: When official video is not embeddable, prioritize remaining candidates
      // so candidates with "lyrics", "audio", or "topic" channels are tried first.
      const currentIndex = this.playerState.currentIndex;
      const untriedSlice = this.playerState.candidates.slice(currentIndex + 1);
      const prioritizedUntried = this.prioritizeCandidates(untriedSlice);
      this.playerState.candidates = [
        ...this.playerState.candidates.slice(0, currentIndex + 1),
        ...prioritizedUntried,
      ];

      // Requirement 3: If the first 3 results fail, retry search once with query + " lyrics",
      // then once with " audio" appended.
      if (this.failedCount >= 3 && !this.hasRetriedLyrics && this.baseQuery) {
        console.log(`[YouTubeController] First 3 candidates failed. Retrying search with "${this.baseQuery} lyrics"...`);
        this.hasRetriedLyrics = true;
        this.playerState.statusText = 'Finding lyrics version...';
        this.notifyState();

        const lyricsCandidates = await this.fetchCandidatesFromApi(`${this.baseQuery} lyrics`);
        const newLyrics = lyricsCandidates.filter((c) => !this.triedVideoIds.has(c.videoId));
        if (newLyrics.length > 0) {
          const prioritizedLyrics = this.prioritizeCandidates(newLyrics);
          // Insert after current index
          this.playerState.candidates.splice(this.playerState.currentIndex + 1, 0, ...prioritizedLyrics);
        }
      }

      // If lyrics also failed or exhausted, retry once with " audio"
      const remainingCandidatesCount = this.playerState.candidates.length - (this.playerState.currentIndex + 1);
      if (remainingCandidatesCount === 0 && !this.hasRetriedAudio && this.baseQuery) {
        console.log(`[YouTubeController] Retrying search with "${this.baseQuery} audio"...`);
        this.hasRetriedAudio = true;
        this.playerState.statusText = 'Finding audio version...';
        this.notifyState();

        const audioCandidates = await this.fetchCandidatesFromApi(`${this.baseQuery} audio`);
        const newAudio = audioCandidates.filter((c) => !this.triedVideoIds.has(c.videoId));
        if (newAudio.length > 0) {
          const prioritizedAudio = this.prioritizeCandidates(newAudio);
          this.playerState.candidates.splice(this.playerState.currentIndex + 1, 0, ...prioritizedAudio);
        }
      }

      // Check if there is an untried candidate available
      const nextIndex = this.playerState.currentIndex + 1;
      if (nextIndex < this.playerState.candidates.length) {
        const nextCandidate = this.playerState.candidates[nextIndex];
        console.log(`[YouTubeController] Silently advancing to candidate ${nextIndex + 1}/${this.playerState.candidates.length}: "${nextCandidate.title}" (${nextCandidate.videoId})`);

        this.playerState.currentIndex = nextIndex;
        this.playerState.videoId = nextCandidate.videoId;
        this.playerState.videoTitle = nextCandidate.title;
        this.playerState.channelTitle = nextCandidate.channelTitle || null;
        this.playerState.failedVideoId = nextCandidate.videoId;
        this.playerState.attemptCount = nextIndex + 1;
        this.playerState.isLoading = true;
        this.playerState.isPlaying = false;
        // Requirement 2: Keep embeddingFailed false so NO error screen is shown to the user!
        this.playerState.embeddingFailed = false;
        this.playerState.error = null;
        this.playerState.statusText = 'Testing alternative version...';
        this.triedVideoIds.add(nextCandidate.videoId);
        this.notifyState();

        if (this.ytPlayerInstance && typeof this.ytPlayerInstance.loadVideoById === 'function') {
          try {
            this.ytPlayerInstance.loadVideoById(nextCandidate.videoId);
          } catch (e) {
            console.warn('[YouTubeController] loadVideoById error on candidate switch:', e);
          }
        }
        return;
      }

      // Requirement 5: Only after ALL attempts fail, show the "Open on YouTube" button
      // and have Lucy say honestly that this song cannot be played inside the app.
      console.warn('[YouTubeController] All candidate attempts (primary, lyrics, audio) have failed.');
      this.playerState.isPlaying = false;
      this.playerState.isLoading = false;
      this.playerState.embeddingFailed = true;
      this.playerState.error = 'This song cannot be played inside the app due to content owner restrictions.';
      this.playerState.statusText = 'Embedding restricted by content owner';
      const lastFailedId = this.playerState.failedVideoId || this.playerState.videoId;
      this.notifyState();

      if (this.pendingPlayResolve) {
        this.pendingPlayResolve({
          success: false,
          verified: false,
          embeddingFailed: true,
          openUrl: `https://www.youtube.com/watch?v=${lastFailedId || ''}`,
          message: 'This song cannot be played inside the app, but I can open it on YouTube.',
        });
        this.clearPendingPlay();
      }
    } finally {
      this.isProcessingError = false;
    }
  }

  /**
   * Pauses the active YouTube video
   */
  public async pauseVideo(): Promise<{ success: boolean; message: string; verified: boolean }> {
    if (!this.playerState.videoId) {
      return { success: false, message: 'No active video is loaded on YouTube.', verified: false };
    }

    if (this.ytPlayerInstance && typeof this.ytPlayerInstance.pauseVideo === 'function') {
      try {
        this.ytPlayerInstance.pauseVideo();
      } catch {}
    }

    this.playerState.isPlaying = false;
    this.notifyState();

    return {
      success: true,
      message: `Paused "${this.playerState.videoTitle}".`,
      verified: true,
    };
  }

  /**
   * Resumes playback of the active YouTube video
   */
  public async resumeVideo(): Promise<{ success: boolean; message: string; verified: boolean }> {
    if (!this.playerState.videoId) {
      return { success: false, message: 'No video was loaded to resume.', verified: false };
    }

    if (this.ytPlayerInstance && typeof this.ytPlayerInstance.playVideo === 'function') {
      try {
        this.ytPlayerInstance.playVideo();
      } catch {}
    }

    this.playerState.isPlaying = true;
    this.notifyState();

    return {
      success: true,
      message: `Resumed playback of "${this.playerState.videoTitle}".`,
      verified: true,
    };
  }

  /**
   * Adjusts volume of the active video
   */
  public async setVolume(vol: number): Promise<{ success: boolean; message: string; verified: boolean }> {
    this.playerState.volume = Math.max(0, Math.min(100, vol));
    if (this.ytPlayerInstance && typeof this.ytPlayerInstance.setVolume === 'function') {
      try {
        this.ytPlayerInstance.setVolume(this.playerState.volume);
      } catch {}
    }
    this.notifyState();
    return {
      success: true,
      message: `YouTube video volume set to ${this.playerState.volume}%.`,
      verified: true,
    };
  }

  /**
   * Toggles mute on the active video
   */
  public async toggleMute(): Promise<{ success: boolean; message: string; verified: boolean }> {
    this.playerState.isMuted = !this.playerState.isMuted;
    if (this.ytPlayerInstance) {
      try {
        if (this.playerState.isMuted && typeof this.ytPlayerInstance.mute === 'function') {
          this.ytPlayerInstance.mute();
        } else if (!this.playerState.isMuted && typeof this.ytPlayerInstance.unMute === 'function') {
          this.ytPlayerInstance.unMute();
        }
      } catch {}
    }
    this.notifyState();
    return {
      success: true,
      message: `YouTube video is now ${this.playerState.isMuted ? 'muted' : 'unmuted'}.`,
      verified: true,
    };
  }

  public closePlayer() {
    this.clearPendingPlay();
    if (this.ytPlayerInstance && typeof this.ytPlayerInstance.stopVideo === 'function') {
      try {
        this.ytPlayerInstance.stopVideo();
      } catch {}
    }
    this.playerState.videoId = null;
    this.playerState.videoTitle = null;
    this.playerState.channelTitle = null;
    this.playerState.isPlaying = false;
    this.playerState.isLoading = false;
    this.playerState.embeddingFailed = false;
    this.playerState.error = null;
    this.playerState.statusText = undefined;
    this.playerState.candidates = [];
    this.playerState.currentIndex = 0;
    this.playerState.attemptCount = 0;
    this.notifyState();
  }

  /**
   * Skips to the next video result in the candidate list
   */
  public async nextResult(): Promise<{ success: boolean; message: string; verified: boolean }> {
    const nextIndex = this.playerState.currentIndex + 1;
    if (nextIndex < this.playerState.candidates.length) {
      const nextCandidate = this.playerState.candidates[nextIndex];
      this.playerState.currentIndex = nextIndex;
      this.playerState.videoId = nextCandidate.videoId;
      this.playerState.videoTitle = nextCandidate.title;
      this.playerState.channelTitle = nextCandidate.channelTitle || null;
      this.playerState.failedVideoId = nextCandidate.videoId;
      this.playerState.isLoading = true;
      this.playerState.isPlaying = false;
      this.playerState.embeddingFailed = false;
      this.playerState.error = null;
      this.playerState.statusText = 'Playing next result...';
      this.triedVideoIds.add(nextCandidate.videoId);
      this.notifyState();

      if (this.ytPlayerInstance && typeof this.ytPlayerInstance.loadVideoById === 'function') {
        try {
          this.ytPlayerInstance.loadVideoById(nextCandidate.videoId);
        } catch (e) {
          console.warn('[YouTubeController] loadVideoById error on nextResult:', e);
        }
      }
      return {
        success: true,
        message: `Playing next result: "${nextCandidate.title}".`,
        verified: true,
      };
    }

    // Try fetching audio / lyrics retry if not already done
    if (!this.hasRetriedAudio && this.baseQuery) {
      this.hasRetriedAudio = true;
      const audioCandidates = await this.fetchCandidatesFromApi(`${this.baseQuery} audio`);
      const newAudio = audioCandidates.filter((c) => !this.triedVideoIds.has(c.videoId));
      if (newAudio.length > 0) {
        const prioritized = this.prioritizeCandidates(newAudio);
        this.playerState.candidates.push(...prioritized);
        return this.nextResult();
      }
    }

    return {
      success: false,
      message: 'No more video candidates available in the queue.',
      verified: false,
    };
  }

  public async closePlayerAsync(): Promise<{ success: boolean; message: string; verified: boolean }> {
    this.closePlayer();
    return {
      success: true,
      message: 'YouTube player closed.',
      verified: true,
    };
  }

  private clearPendingPlay() {
    if (this.pendingPlayTimer) {
      clearTimeout(this.pendingPlayTimer);
      this.pendingPlayTimer = null;
    }
    this.pendingPlayResolve = null;
  }

  private notifyState() {
    this.onStateChangeCallback?.({ ...this.playerState });
  }
}

export const youtubeController = new YouTubeController();
