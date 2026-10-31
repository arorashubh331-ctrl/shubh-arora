import { floatTo16BitPCM, arrayBufferToBase64, resampleAudio, calculateRMS } from '../utils/audioUtils';

export class AudioStreamer {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dummyGainNode: GainNode | null = null;

  private isMuted: boolean = false;
  private isStreaming: boolean = false;
  private onAudioChunkCallback: ((base64Chunk: string) => void) | null = null;
  private onSpeechActivityCallback: ((rms: number) => void) | null = null;

  private currentVolume: number = 0;
  private frequencyDataArray: Uint8Array<ArrayBuffer> | null = null;

  constructor() {}

  public setOnSpeechActivity(cb: (rms: number) => void) {
    this.onSpeechActivityCallback = cb;
  }

  public async start(onAudioChunk: (base64Chunk: string) => void): Promise<void> {
    if (this.isStreaming) return;

    this.onAudioChunkCallback = onAudioChunk;

    // High fidelity voice capture settings
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      },
      video: false,
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.audioCtx = new AudioContextClass({ sampleRate: 16000, latencyHint: 'interactive' });
    } catch {
      this.audioCtx = new AudioContextClass();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const sampleRate = this.audioCtx.sampleRate;

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.4;
    this.frequencyDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    // Optimized buffer size: 1024 samples = ~64ms latency at 16kHz (vs 256ms previously)
    // Low latency streaming provides ultra-fast turn-taking
    this.processorNode = this.audioCtx.createScriptProcessor(1024, 1, 1);

    this.dummyGainNode = this.audioCtx.createGain();
    this.dummyGainNode.gain.value = 0;

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(this.dummyGainNode);
    this.dummyGainNode.connect(this.audioCtx.destination);

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.isStreaming || this.isMuted) {
        this.currentVolume = 0;
        return;
      }

      const inputBuffer = e.inputBuffer.getChannelData(0);
      const rms = calculateRMS(inputBuffer);
      this.currentVolume = rms;

      // Notify VAD monitor for real-time natural interruption
      this.onSpeechActivityCallback?.(rms);

      // Resample to 16kHz if audio context is running at 44.1k/48k
      const resampled = sampleRate === 16000 ? inputBuffer : resampleAudio(inputBuffer, sampleRate, 16000);

      // Convert to 16-bit PCM little endian
      const pcm16 = floatTo16BitPCM(resampled);

      // Encode to base64
      const base64Chunk = arrayBufferToBase64(pcm16);

      if (this.onAudioChunkCallback) {
        this.onAudioChunkCallback(base64Chunk);
      }
    };

    this.isStreaming = true;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getAudioLevel(): number {
    return this.isMuted ? 0 : this.currentVolume;
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyserNode || !this.frequencyDataArray || this.isMuted) {
      return new Uint8Array(0);
    }
    this.analyserNode.getByteFrequencyData(this.frequencyDataArray);
    return this.frequencyDataArray;
  }

  public stop(): void {
    this.isStreaming = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.dummyGainNode) {
      this.dummyGainNode.disconnect();
      this.dummyGainNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.currentVolume = 0;
  }
}
