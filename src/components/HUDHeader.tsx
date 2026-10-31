import React from 'react';
import { Sparkles, Sliders, Monitor, HelpCircle, Radio, Command, Brain } from 'lucide-react';
import { AssistantState, ThemeConfig } from '../types/assistant';

interface HUDHeaderProps {
  state: AssistantState;
  theme: ThemeConfig;
  activeVoice: string;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onOpenDesktopCompanion: () => void;
  onOpenMemory: () => void;
}

export const HUDHeader: React.FC<HUDHeaderProps> = ({
  state,
  theme,
  activeVoice,
  onOpenSettings,
  onOpenGuide,
  onOpenDesktopCompanion,
  onOpenMemory,
}) => {
  return (
    <header className="relative z-20 w-full px-5 py-4 flex items-center justify-between">
      {/* Brand & Companion Info */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center border backdrop-blur-xl shadow-lg transition-all"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              borderColor: `${theme.primary}55`,
              boxShadow: `0 0 15px ${theme.glow}`,
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: theme.primary }} />
          </div>
          {state !== 'disconnected' && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${
                state === 'speaking'
                  ? 'bg-cyan-400 animate-ping'
                  : state === 'listening'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider text-white uppercase">
              Lucy
            </h1>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider"
              style={{
                backgroundColor: `${theme.primary}15`,
                color: theme.primary,
                borderColor: `${theme.primary}40`,
              }}
            >
              Voice Companion ❤️
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-medium">
            <span>Voice: {activeVoice}</span>
            <span className="text-zinc-600">•</span>
            <span className="capitalize">{theme.name}</span>
          </p>
        </div>
      </div>

      {/* Center Wake Word & Shortcut Badge */}
      <div className="hidden md:flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-md">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>"Hey Lucy" Hands-Free</span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-mono">
          <Command className="w-3 h-3" />
          <span>Ctrl+Shift+L</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMemory}
          className="p-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 hover:text-white backdrop-blur-md transition-all shadow-sm flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          title="Cognitive Memory Architecture Dashboard"
        >
          <Brain className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Memory</span>
        </button>

        <button
          onClick={onOpenDesktopCompanion}
          className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-white backdrop-blur-md transition-all shadow-sm flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          title="Windows 11 Desktop Control Status & Tester"
        >
          <Monitor className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Windows 11</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        <button
          onClick={onOpenGuide}
          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white backdrop-blur-md transition-all shadow-sm flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          title="Voice commands & conversation guide"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Guide</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white backdrop-blur-md transition-all shadow-sm cursor-pointer"
          title="Lucy voice & theme settings"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
