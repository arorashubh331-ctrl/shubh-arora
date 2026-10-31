/**
 * ConversationMemory - Tracks session conversational continuity, user context,
 * recent desktop actions, and active topics for natural human-like contextual intelligence.
 */

import { QuickNote, ActiveTimer } from '../../types/assistant';

export interface UserContextItem {
  key: string;
  value: string;
  timestamp: number;
}

export interface ConversationTurn {
  role: 'user' | 'lucy';
  text: string;
  timestamp: number;
  sentiment?: 'playful' | 'curious' | 'affectionate' | 'concerned' | 'neutral';
}

export interface ExecutedActionContext {
  tool: string;
  summary: string;
  target?: string;
  verified: boolean;
  timestamp: number;
}

export class ConversationMemory {
  private notes: QuickNote[] = [];
  private timers: ActiveTimer[] = [];
  private contextItems: Map<string, UserContextItem> = new Map();
  private recentTurns: ConversationTurn[] = [];
  private recentActions: ExecutedActionContext[] = [];

  // Inferred conversation context
  private activeTopic: string | null = null;
  private lastMusicQuery: string | null = null;
  private lastAppLaunched: string | null = null;
  private lastDocumentCreated: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  // --- Quick Notes ---
  public addNote(note: QuickNote) {
    this.notes.unshift(note);
    this.recordAction('note', `Saved note: "${note.title}"`, note.title, true);
    this.saveToStorage();
  }

  public getNotes(): QuickNote[] {
    return this.notes;
  }

  public setNotes(notes: QuickNote[]) {
    this.notes = notes;
    this.saveToStorage();
  }

  // --- Active Timers ---
  public addTimer(timer: ActiveTimer) {
    this.timers.unshift(timer);
    this.recordAction('timer', `Set timer for ${timer.label} (${timer.totalSeconds}s)`, timer.label, true);
  }

  public getTimers(): ActiveTimer[] {
    return this.timers;
  }

  public setTimers(timers: ActiveTimer[]) {
    this.timers = timers;
  }

  // --- Context & Preferences ---
  public setContext(key: string, value: string) {
    this.contextItems.set(key, { key, value, timestamp: Date.now() });
    this.saveToStorage();
  }

  public getContext(key: string): string | undefined {
    return this.contextItems.get(key)?.value;
  }

  // --- Conversation Turns ---
  public recordTurn(role: 'user' | 'lucy', text: string, sentiment?: ConversationTurn['sentiment']) {
    const cleanText = text.trim();
    if (!cleanText) return;

    this.recentTurns.push({
      role,
      text: cleanText,
      timestamp: Date.now(),
      sentiment,
    });

    // Keep rolling window of last 20 turns
    if (this.recentTurns.length > 20) {
      this.recentTurns.shift();
    }
  }

  public getRecentTurns(): ConversationTurn[] {
    return [...this.recentTurns];
  }

  // --- Executed Actions & Tool History ---
  public recordAction(tool: string, summary: string, target?: string, verified: boolean = true) {
    this.recentActions.unshift({
      tool,
      summary,
      target,
      verified,
      timestamp: Date.now(),
    });

    if (this.recentActions.length > 15) {
      this.recentActions.pop();
    }

    // Update specific context pointers for seamless follow-up references
    if (tool.toLowerCase().includes('youtube')) {
      this.lastMusicQuery = target || summary;
      this.activeTopic = 'music';
    } else if (tool.toLowerCase().includes('app') || tool === 'openDesktopApp') {
      this.lastAppLaunched = target || summary;
    } else if (tool.toLowerCase().includes('document') || tool.toLowerCase().includes('notepad') || tool.toLowerCase().includes('excel')) {
      this.lastDocumentCreated = target || summary;
      this.activeTopic = 'work';
    }
  }

  public getRecentActions(): ExecutedActionContext[] {
    return [...this.recentActions];
  }

  public getLastMusicQuery(): string | null {
    return this.lastMusicQuery;
  }

  public getLastAppLaunched(): string | null {
    return this.lastAppLaunched;
  }

  public getLastDocumentCreated(): string | null {
    return this.lastDocumentCreated;
  }

  public setActiveTopic(topic: string) {
    this.activeTopic = topic;
  }

  public getActiveTopic(): string | null {
    return this.activeTopic;
  }

  /**
   * Generates a concise context summary for system instructions,
   * enabling Lucy to remember recent events without robotic repetition.
   */
  public getContextSummary(): string {
    const lines: string[] = [];

    if (this.lastMusicQuery) {
      lines.push(`- Current Music Context: Recent song/video is "${this.lastMusicQuery}"`);
    }

    if (this.lastAppLaunched) {
      lines.push(`- Last Application Launched: "${this.lastAppLaunched}"`);
    }

    if (this.lastDocumentCreated) {
      lines.push(`- Last Document Created: "${this.lastDocumentCreated}"`);
    }

    if (this.timers.length > 0) {
      const active = this.timers.slice(0, 2).map((t) => `"${t.label}" (${t.remainingSeconds}s remaining)`).join(', ');
      lines.push(`- Active Timers: ${active}`);
    }

    if (this.notes.length > 0) {
      const recentNotes = this.notes.slice(0, 2).map((n) => `"${n.title}"`).join(', ');
      lines.push(`- Recent User Notes: ${recentNotes}`);
    }

    if (this.recentActions.length > 0) {
      const lastAction = this.recentActions[0];
      lines.push(`- Most Recent Action: ${lastAction.summary} (${Math.round((Date.now() - lastAction.timestamp) / 1000)}s ago)`);
    }

    return lines.join('\n');
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('lucy_memory_notes', JSON.stringify(this.notes.slice(0, 10)));
        const contextObj: Record<string, string> = {};
        this.contextItems.forEach((item, k) => {
          contextObj[k] = item.value;
        });
        localStorage.setItem('lucy_memory_context', JSON.stringify(contextObj));
      }
    } catch {}
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedNotes = localStorage.getItem('lucy_memory_notes');
        if (savedNotes) {
          this.notes = JSON.parse(savedNotes);
        }
        const savedContext = localStorage.getItem('lucy_memory_context');
        if (savedContext) {
          const parsed = JSON.parse(savedContext);
          Object.keys(parsed).forEach((k) => {
            this.contextItems.set(k, { key: k, value: parsed[k], timestamp: Date.now() });
          });
        }
      }
    } catch {}
  }
}

export const conversationMemory = new ConversationMemory();
