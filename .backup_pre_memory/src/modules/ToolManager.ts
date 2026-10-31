import { AuraTheme, ToolNotification, ActiveTimer, QuickNote } from '../types/assistant';
import { desktopActionEngine } from './desktop/DesktopActionEngine';
import { conversationMemory } from './personality/ConversationMemory';

export interface ToolExecutionResult {
  success: boolean;
  message?: string;
  data?: any;
  verified?: boolean;
}

export class ToolManager {
  private onNotificationCallback: ((notif: ToolNotification) => void) | null = null;
  private onThemeChangeCallback: ((theme: AuraTheme) => void) | null = null;
  private onTimerCreateCallback: ((timer: ActiveTimer) => void) | null = null;
  private onNoteCreateCallback: ((note: QuickNote) => void) | null = null;

  constructor() {
    // Listen to real desktop execution events and generate verified notifications
    desktopActionEngine.setOnExecutionEvent((event) => {
      this.onNotificationCallback?.({
        id: event.id,
        tool: event.category,
        title: event.title,
        description: event.details,
        timestamp: event.timestamp,
      });
    });
  }

  public setCallbacks(callbacks: {
    onNotification?: (notif: ToolNotification) => void;
    onThemeChange?: (theme: AuraTheme) => void;
    onTimerCreate?: (timer: ActiveTimer) => void;
    onNoteCreate?: (note: QuickNote) => void;
  }) {
    if (callbacks.onNotification) this.onNotificationCallback = callbacks.onNotification;
    if (callbacks.onThemeChange) this.onThemeChangeCallback = callbacks.onThemeChange;
    if (callbacks.onTimerCreate) this.onTimerCreateCallback = callbacks.onTimerCreate;
    if (callbacks.onNoteCreate) this.onNoteCreateCallback = callbacks.onNoteCreate;
  }

  public async executeTool(name: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    console.log(`[ToolManager] Routing tool execution: '${name}'`, args);

    switch (name) {
      // 1. Core Companion Tools
      case 'changeThemeOrMood': {
        const validThemes: AuraTheme[] = ['cyberpunk', 'aurora', 'sunset', 'cosmic', 'emerald', 'crimson'];
        const requestedMood = String(args.mood || '').toLowerCase().trim() as AuraTheme;
        const selectedTheme: AuraTheme = validThemes.includes(requestedMood) ? requestedMood : 'sunset';

        this.onThemeChangeCallback?.(selectedTheme);
        this.onNotificationCallback?.({
          id: `theme-${Date.now()}`,
          tool: 'changeThemeOrMood',
          title: `Mood shifted to ${selectedTheme.toUpperCase()}`,
          description: args.description || `Lucy's aura is now glowing in ${selectedTheme} aesthetic.`,
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `Theme aura successfully changed to ${selectedTheme}.`,
          data: { theme: selectedTheme },
          verified: true,
        };
      }

      case 'setTimer': {
        const durationSeconds = Math.max(1, parseInt(String(args.durationSeconds || '60'), 10));
        const label = String(args.label || 'Voice Reminder').trim();

        const timer: ActiveTimer = {
          id: `timer-${Date.now()}`,
          label,
          totalSeconds: durationSeconds,
          remainingSeconds: durationSeconds,
          createdAt: Date.now(),
        };

        this.onTimerCreateCallback?.(timer);
        conversationMemory.addTimer(timer);
        this.onNotificationCallback?.({
          id: `notif-${timer.id}`,
          tool: 'setTimer',
          title: `Timer started: ${label}`,
          description: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `Timer set for ${durationSeconds} seconds with label "${label}".`,
          data: { durationSeconds, label },
          verified: true,
        };
      }

      case 'takeQuickNote': {
        const title = String(args.title || 'Voice Memo').trim();
        const content = String(args.content || '').trim();

        const note: QuickNote = {
          id: `note-${Date.now()}`,
          title,
          content,
          timestamp: Date.now(),
        };

        this.onNoteCreateCallback?.(note);
        conversationMemory.addNote(note);
        this.onNotificationCallback?.({
          id: `notif-${note.id}`,
          tool: 'takeQuickNote',
          title: `Saved: ${title}`,
          description: content,
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `Note "${title}" saved to user notes.`,
          data: { id: note.id, title },
          verified: true,
        };
      }

      case 'getLiveStatus': {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let batteryLevel = 'unknown';
        if ('getBattery' in navigator) {
          try {
            const battery: any = await (navigator as any).getBattery();
            batteryLevel = `${Math.round(battery.level * 100)}% (${battery.charging ? 'Charging' : 'On battery'})`;
          } catch {}
        }

        const statusInfo = {
          currentTime: timeStr,
          currentDate: dateStr,
          timeZone,
          battery: batteryLevel,
          screen: `${window.innerWidth}x${window.innerHeight}`,
          online: navigator.onLine,
        };

        return {
          success: true,
          message: `Current local time is ${timeStr} on ${dateStr} (${timeZone}). Battery: ${batteryLevel}.`,
          data: statusInfo,
          verified: true,
        };
      }

      // 2. Real Desktop, YouTube, Browser, File & Document Actions (Delegated to DesktopActionEngine)
      case 'playMusic':
      case 'pauseMusic':
      case 'resumeMusic':
      case 'setVolume':
      case 'nextResult':
      case 'closePlayer':
      case 'youtubePlay':
      case 'youtubeSearchAndPlay':
      case 'youtubePause':
      case 'youtubeResume':
      case 'openUrl':
      case 'searchGoogle':
      case 'click':
      case 'typeText':
      case 'scroll':
      case 'goBack':
      case 'closeBrowser':
      case 'openInBrowserPanel':
      case 'googleSearch':
      case 'createNotepad':
      case 'createDocument':
      case 'createCodeFile':
      case 'createExcelTable':
      case 'createProjectReport':
      case 'openDesktopApp':
      case 'openDesktopFolderOrFile':
      case 'createFolder':
      case 'findFile':
      case 'controlDeviceSettings':
      case 'connectBluetooth':
      case 'executeSystemAction':
      case 'emergencyStop':
      case 'searchWeb':
      case 'openWebsite': {
        // Map openWebsite / searchWeb to browser actions
        const targetTool = name === 'openWebsite' ? 'browserNavigate' : name;
        return await desktopActionEngine.execute(targetTool, args);
      }

      default:
        return {
          success: false,
          message: `Tool '${name}' is not recognized.`,
          verified: false,
        };
    }
  }
}
