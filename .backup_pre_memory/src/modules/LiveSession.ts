import { AssistantState, ToolNotification, ActiveTimer, QuickNote, AuraTheme } from '../types/assistant';
import { AudioStreamer } from './AudioStreamer';
import { AudioPlayer } from './AudioPlayer';
import { ToolManager } from './ToolManager';

export class LiveSession {
  private ws: WebSocket | null = null;
  private streamer: AudioStreamer;
  private player: AudioPlayer;
  private toolManager: ToolManager;

  private state: AssistantState = 'disconnected';
  private voice: string = 'Zephyr';
  private errorMessage: string | null = null;

  private onStateChangeCallback: ((state: AssistantState) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor(
    streamer: AudioStreamer,
    player: AudioPlayer,
    toolManager: ToolManager
  ) {
    this.streamer = streamer;
    this.player = player;
    this.toolManager = toolManager;

    // Listen to player's speaking changes
    this.player.setOnSpeakingStateChange((isSpeaking) => {
      if (this.state === 'disconnected' || this.state === 'connecting' || this.state === 'error') {
        return;
      }
      this.setState(isSpeaking ? 'speaking' : 'listening');
    });

    // Local VAD: Detect when user speaks while Lucy is speaking to interrupt immediately
    let speechFramesCount = 0;
    this.streamer.setOnSpeechActivity((rms) => {
      if (this.state === 'speaking' && !this.streamer.getIsMuted()) {
        if (rms > 0.038) {
          speechFramesCount++;
          if (speechFramesCount >= 2) {
            console.log('[LiveSession] Local VAD detected user speech during playback, interrupting');
            this.interruptAssistant();
            speechFramesCount = 0;
          }
        } else {
          speechFramesCount = Math.max(0, speechFramesCount - 1);
        }
      } else {
        speechFramesCount = 0;
      }
    });
  }

  public setVoice(voice: string) {
    this.voice = voice;
  }

  public getVoice(): string {
    return this.voice;
  }

  public getState(): AssistantState {
    return this.state;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public setOnStateChange(cb: (state: AssistantState) => void) {
    this.onStateChangeCallback = cb;
  }

  public setOnError(cb: (error: string) => void) {
    this.onErrorCallback = cb;
  }

  private setState(newState: AssistantState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChangeCallback?.(newState);
    }
  }

  public async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'listening' || this.state === 'speaking') {
      return;
    }

    this.setState('connecting');
    this.errorMessage = null;

    try {
      // 1. Initialize Audio Player (24kHz Web Audio context)
      await this.player.init();

      // 2. Start microphone streaming (16kHz PCM chunks)
      await this.streamer.start((base64Chunk: string) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Chunk,
            })
          );
        }
      });

      // 3. Establish WebSocket connection to backend server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live?voice=${encodeURIComponent(this.voice)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveSession] WebSocket connected');
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            console.log('[LiveSession] Gemini Live session is ready');
            this.setState('listening');
          } else if (msg.type === 'audio' && msg.audio) {
            // Play received 24kHz audio chunk
            await this.player.playChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            console.log('[LiveSession] User interrupted assistant');
            this.player.interrupt();
            this.setState('listening');
          } else if (msg.type === 'turn_complete') {
            // Turn completed by model - notify audio player to smoothly finalize turn
            this.player.handleTurnComplete();
          } else if (msg.type === 'tool_call') {
            // Model invoked a tool
            console.log('[LiveSession] Received tool call:', msg.name, msg.args);
            const result = await this.toolManager.executeTool(msg.name, msg.args || {});

            // Immediately send response back to server
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(
                JSON.stringify({
                  type: 'tool_response',
                  callId: msg.callId,
                  name: msg.name,
                  response: result,
                })
              );
            }
          } else if (msg.type === 'error') {
            console.error('[LiveSession] Error from server:', msg.message);
            this.errorMessage = msg.message;
            this.onErrorCallback?.(msg.message);
            this.setState('error');
          } else if (msg.type === 'session_closed') {
            console.log('[LiveSession] Session closed by server');
            this.disconnect();
          }
        } catch (e) {
          console.error('[LiveSession] Failed to parse message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[LiveSession] WebSocket error:', err);
        const errText = 'Failed to connect to Lucy Voice Server. Please verify microphone permissions and server status.';
        this.errorMessage = errText;
        this.onErrorCallback?.(errText);
        this.setState('error');
      };

      this.ws.onclose = () => {
        console.log('[LiveSession] WebSocket connection closed');
        if (this.state !== 'error') {
          this.setState('disconnected');
        }
      };
    } catch (err: any) {
      console.error('[LiveSession] Connection exception:', err);
      const errText = err?.message || 'Microphone access denied or audio initialization failed.';
      this.errorMessage = errText;
      this.onErrorCallback?.(errText);
      this.setState('error');
      this.disconnect();
    }
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.player.interrupt();
    this.streamer.stop();

    if (this.state !== 'error') {
      this.setState('disconnected');
    }
  }

  public toggleMute(): boolean {
    const nextMuted = !this.streamer.getIsMuted();
    this.streamer.setMuted(nextMuted);
    return nextMuted;
  }

  public isMuted(): boolean {
    return this.streamer.getIsMuted();
  }

  public interruptAssistant(): void {
    this.player.interrupt();
    if (this.state === 'speaking') {
      this.setState('listening');
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'client_interrupted' }));
      } catch {}
    }
  }

  public getVisualizerData(): {
    level: number;
    frequencies: Uint8Array;
    source: 'user' | 'assistant' | 'idle';
  } {
    if (this.state === 'speaking') {
      return {
        level: this.player.getAudioLevel(),
        frequencies: this.player.getFrequencyData(),
        source: 'assistant',
      };
    } else if (this.state === 'listening' && !this.streamer.getIsMuted()) {
      return {
        level: this.streamer.getAudioLevel(),
        frequencies: this.streamer.getFrequencyData(),
        source: 'user',
      };
    }
    return {
      level: 0,
      frequencies: new Uint8Array(0),
      source: 'idle',
    };
  }
}
