/**
 * LucyVoiceEngine - PROTECTED VOICE CAPTURE & PLAYBACK ORCHESTRATION
 * 
 * Preserves Lucy's voice characteristics:
 * - 16kHz PCM16 mic streaming with 1024 low-latency buffer
 * - 24kHz gapless playback scheduling with adaptive jitter buffer
 * - Real-time Voice Activity Detection (VAD) for instant natural interruption
 * - Voice identity settings (Zephyr, Kore, Aoede)
 */

import { AudioStreamer } from '../AudioStreamer';
import { AudioPlayer } from '../AudioPlayer';

export class LucyVoiceEngine {
  private streamer: AudioStreamer;
  private player: AudioPlayer;
  private activeVoice: string = 'Zephyr';

  constructor(streamer: AudioStreamer, player: AudioPlayer) {
    this.streamer = streamer;
    this.player = player;
  }

  public setVoice(voice: string) {
    this.activeVoice = voice;
  }

  public getVoice(): string {
    return this.activeVoice;
  }

  public async startCapture(onChunk: (base64Chunk: string) => void): Promise<void> {
    await this.streamer.start(onChunk);
  }

  public stopCapture(): void {
    this.streamer.stop();
  }

  public async playResponseChunk(base64PCM: string): Promise<void> {
    await this.player.playChunk(base64PCM);
  }

  public interruptSpeech(): void {
    this.player.interrupt();
  }

  public setVolume(vol: number): void {
    this.player.setVolume(vol);
  }

  public toggleMute(): boolean {
    const next = !this.streamer.getIsMuted();
    this.streamer.setMuted(next);
    return next;
  }

  public isMuted(): boolean {
    return this.streamer.getIsMuted();
  }

  public isSpeaking(): boolean {
    return this.player.getIsPlaying();
  }

  public getStreamer(): AudioStreamer {
    return this.streamer;
  }

  public getPlayer(): AudioPlayer {
    return this.player;
  }
}
