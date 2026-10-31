export type AssistantState = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'error';

export type AuraTheme = 'cyberpunk' | 'aurora' | 'sunset' | 'cosmic' | 'emerald' | 'crimson';

export interface ThemeConfig {
  id: AuraTheme;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  gradient: string;
  tagline: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  description: string;
}

export interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  createdAt: number;
  isCompleted?: boolean;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

export interface ToolNotification {
  id: string;
  tool: string;
  title: string;
  description: string;
  timestamp: number;
  url?: string;
}

export interface ToolCallPayload {
  callId: string;
  name: string;
  args: Record<string, any>;
}
