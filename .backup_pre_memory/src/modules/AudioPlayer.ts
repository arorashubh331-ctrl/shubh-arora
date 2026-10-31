import {
  decodePCM16ToFloat32,
  createAudioBufferFromFloat32,
  PCMDecodeState,
} from '../utils/audioUtils';

export class AudioPlayer {
  private audioCtx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private masterGainNode: GainNode | null = null;
  private interruptionGainNode: GainNode | null = null;

  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private frequencyDataArray: Uint8Array<ArrayBuffer> | null = null;

  private isPlaying: boolean = false;
  private onSpeakingStateChange: ((isSpeaking: boolean) => void) | null = null;
  private checkPlayingInterval: number | null = null;

  // Byte alignment state across incoming network chunks
  private pcmState: PCMDecodeState = { leftoverByte: null };
  private volumeLevel: number = 1.0;

  // Adaptive jitter buffer settings
  private isFirstChunkOfTurn: boolean = true;
  private adaptiveJitterDelay: number = 0.040; // 40ms responsive baseline buffer
  private consecutiveCleanChunks: number = 0;

  constructor() {}

  public async init(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Gemini Live audio output is 24,000 Hz 16-bit PCM mono
    try {
      this.audioCtx = new AudioContextClass({ sampleRate: 24000, latencyHint: 'interactive' });
    } catch {
      this.audioCtx = new AudioContextClass();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.5;
    this.frequencyDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.masterGainNode = this.audioCtx.createGain();
    this.masterGainNode.gain.value = this.volumeLevel;

    this.interruptionGainNode = this.audioCtx.createGain();
    this.interruptionGainNode.gain.value = 1.0;

    // Connect: interruptionGain -> masterGain -> analyser -> destination
    this.interruptionGainNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioCtx.destination);

    this.nextStartTime = 0;
    this.isFirstChunkOfTurn = true;
    this.startPlayingMonitor();
  }

  public setOnSpeakingStateChange(cb: (isSpeaking: boolean) => void) {
    this.onSpeakingStateChange = cb;
  }

  /**
   * Continuous streaming playback of 24kHz PCM chunks
   * Schedules chunks consecutively on the audio timeline with zero unnatural gaps
   */
  public async playChunk(base64PCM: string): Promise<void> {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      await this.init();
    }

    if (!this.audioCtx || !this.interruptionGainNode) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      // Decode with carry-over byte alignment
      const float32Data = decodePCM16ToFloat32(base64PCM, this.pcmState);
      if (float32Data.length === 0) return;

      const currentTime = this.audioCtx.currentTime;
      let scheduledStart: number;
      let isUnderrun = false;

      if (this.isFirstChunkOfTurn || this.nextStartTime <= 0) {
        // Start of a new spoken turn: add adaptive jitter buffer to prevent network underrun
        scheduledStart = currentTime + this.adaptiveJitterDelay;
        this.isFirstChunkOfTurn = false;
        this.consecutiveCleanChunks = 0;
      } else if (this.nextStartTime < currentTime) {
        // Network delay caused an underrun: adaptively raise jitter buffer slightly to ensure continuous speech
        scheduledStart = currentTime + 0.005;
        isUnderrun = true;
        this.adaptiveJitterDelay = Math.min(0.070, this.adaptiveJitterDelay + 0.010);
        this.consecutiveCleanChunks = 0;
      } else {
        // Perfect seamless back-to-back continuation on the exact sample clock
        scheduledStart = this.nextStartTime;
        this.consecutiveCleanChunks++;
        // Gently decay back to baseline 40ms when network stream is stable
        if (this.consecutiveCleanChunks > 15 && this.adaptiveJitterDelay > 0.040) {
          this.adaptiveJitterDelay = Math.max(0.040, this.adaptiveJitterDelay - 0.005);
          this.consecutiveCleanChunks = 0;
        }
      }

      const audioBuffer = createAudioBufferFromFloat32(
        this.audioCtx,
        float32Data,
        24000,
        isUnderrun // Apply micro edge fade only if recovering from an underrun
      );

      const sourceNode = this.audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.interruptionGainNode);

      sourceNode.start(scheduledStart);
      this.activeSources.push(sourceNode);

      // Advance timeline precisely by this chunk's duration
      this.nextStartTime = scheduledStart + audioBuffer.duration;

      if (!this.isPlaying) {
        this.isPlaying = true;
        this.onSpeakingStateChange?.(true);
      }

      sourceNode.onended = () => {
        const index = this.activeSources.indexOf(sourceNode);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
      };
    } catch (err) {
      console.error('[AudioPlayer] Error scheduling audio chunk:', err);
    }
  }

  /**
   * Graceful, click-free interruption
   * Smoothly ramps gain down in 6ms, stops sources, and clears queued chunks
   */
  public interrupt(): void {
    if (!this.audioCtx || !this.interruptionGainNode) {
      this.cleanupSources();
      return;
    }

    const now = this.audioCtx.currentTime;

    try {
      // 6ms micro ramp down to prevent acoustic pop/click
      this.interruptionGainNode.gain.cancelScheduledValues(now);
      this.interruptionGainNode.gain.setValueAtTime(this.interruptionGainNode.gain.value, now);
      this.interruptionGainNode.gain.linearRampToValueAtTime(0, now + 0.006);
    } catch {}

    setTimeout(() => {
      this.cleanupSources();

      // Restore interruption gain for next turn
      if (this.audioCtx && this.interruptionGainNode) {
        try {
          const resetTime = this.audioCtx.currentTime;
          this.interruptionGainNode.gain.cancelScheduledValues(resetTime);
          this.interruptionGainNode.gain.setValueAtTime(1.0, resetTime);
        } catch {}
      }
    }, 8);
  }

  /**
   * Called when server signals model turn is complete
   * Allows scheduled chunks to finish playing gracefully to the end
   */
  public handleTurnComplete(): void {
    this.isFirstChunkOfTurn = true;
  }

  private cleanupSources(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.pcmState.leftoverByte = null;
    this.nextStartTime = 0;
    this.isFirstChunkOfTurn = true;

    if (this.isPlaying) {
      this.isPlaying = false;
      this.onSpeakingStateChange?.(false);
    }
  }

  public setVolume(vol: number): void {
    this.volumeLevel = Math.max(0, Math.min(1, vol));
    if (this.masterGainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
      this.masterGainNode.gain.linearRampToValueAtTime(this.volumeLevel, now + 0.03);
    }
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyserNode || !this.frequencyDataArray || !this.isPlaying) {
      return new Uint8Array(0);
    }
    this.analyserNode.getByteFrequencyData(this.frequencyDataArray);
    return this.frequencyDataArray;
  }

  public getAudioLevel(): number {
    if (!this.isPlaying || !this.analyserNode || !this.frequencyDataArray) {
      return 0;
    }
    this.analyserNode.getByteFrequencyData(this.frequencyDataArray);
    let sum = 0;
    for (let i = 0; i < this.frequencyDataArray.length; i++) {
      sum += this.frequencyDataArray[i];
    }
    return sum / (this.frequencyDataArray.length * 255);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private startPlayingMonitor(): void {
    if (this.checkPlayingInterval) {
      clearInterval(this.checkPlayingInterval);
    }

    this.checkPlayingInterval = window.setInterval(() => {
      if (!this.audioCtx) return;

      const currentTime = this.audioCtx.currentTime;
      // If no active sources remain and the scheduled timeline has elapsed
      if (this.isPlaying && this.activeSources.length === 0 && currentTime >= this.nextStartTime) {
        this.isPlaying = false;
        this.isFirstChunkOfTurn = true;
        this.onSpeakingStateChange?.(false);
      }
    }, 40);
  }

  public close(): void {
    this.interrupt();
    if (this.checkPlayingInterval) {
      clearInterval(this.checkPlayingInterval);
      this.checkPlayingInterval = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.masterGainNode) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }

    if (this.interruptionGainNode) {
      this.interruptionGainNode.disconnect();
      this.interruptionGainNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
