/**
 * WakeWordDetector - Hands-Free "Hey Lucy" Voice Activation Engine
 * 
 * Supports:
 * 1. Continuous hands-free wake phrase listening ("Hey Lucy", "Lucy", "Hello Lucy", "Suno Lucy")
 * 2. Gentle synthesized activation chime via Web Audio API
 * 3. Global keyboard shortcuts (Ctrl+Shift+L or Space push-to-talk)
 * 4. Automatic connection/listening trigger
 */

export type WakeWordStatus = 'listening' | 'detected' | 'paused' | 'unsupported';

export class WakeWordDetector {
  private recognition: any = null;
  private isListening: boolean = false;
  private onWakeCallback: (() => void) | null = null;
  private onStatusChangeCallback: ((status: WakeWordStatus) => void) | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.initSpeechRecognition();
    this.initKeyboardShortcut();
  }

  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WakeWordDetector] Web Speech API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();

        if (
          transcript.includes('hey lucy') ||
          transcript.includes('hay lucy') ||
          transcript.includes('hi lucy') ||
          transcript.includes('hello lucy') ||
          transcript.includes('suno lucy') ||
          transcript.includes('ok lucy') ||
          transcript.endsWith('lucy')
        ) {
          console.log(`[WakeWordDetector] Wake word detected: "${transcript}"`);
          this.triggerWake();
        }
      };

      this.recognition.onerror = (e: any) => {
        // Silently restart on benign network/speech timeouts
        if (e.error === 'no-speech' || e.error === 'network') {
          if (this.isListening) {
            setTimeout(() => this.restart(), 500);
          }
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          setTimeout(() => this.restart(), 400);
        }
      };
    } catch (e) {
      console.warn('[WakeWordDetector] Initialization error:', e);
    }
  }

  private initKeyboardShortcut() {
    window.addEventListener('keydown', (e) => {
      // Global shortcut: Ctrl+Shift+L or Cmd+Shift+L
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        console.log('[WakeWordDetector] Global shortcut triggered: Ctrl+Shift+L');
        this.triggerWake();
      }
    });
  }

  public setCallbacks(callbacks: {
    onWake: () => void;
    onStatusChange?: (status: WakeWordStatus) => void;
  }) {
    this.onWakeCallback = callbacks.onWake;
    if (callbacks.onStatusChange) {
      this.onStatusChangeCallback = callbacks.onStatusChange;
    }
  }

  public start() {
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    try {
      this.recognition.start();
      this.onStatusChangeCallback?.('listening');
    } catch {
      // Already running or permission waiting
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.onStatusChangeCallback?.('paused');
  }

  private restart() {
    if (!this.isListening || !this.recognition) return;
    try {
      this.recognition.start();
    } catch {}
  }

  public triggerWake() {
    this.playActivationChime();
    this.onStatusChangeCallback?.('detected');
    this.onWakeCallback?.();
    setTimeout(() => {
      if (this.isListening) {
        this.onStatusChangeCallback?.('listening');
      }
    }, 2000);
  }

  /**
   * Harmonious, subtle 2-tone chime synthesized in real-time
   */
  private playActivationChime() {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtx();
      }

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now); // D6
      osc2.frequency.exponentialRampToValueAtTime(1760.0, now + 0.12); // A6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch (e) {
      // AudioContext policy fallback
    }
  }
}

export const wakeWordDetector = new WakeWordDetector();
