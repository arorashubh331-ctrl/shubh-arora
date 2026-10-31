import React from 'react';
import { ShieldAlert, Play } from 'lucide-react';
import { ThemeConfig } from '../types/assistant';

interface EmergencyStopBannerProps {
  isStopped: boolean;
  theme: ThemeConfig;
  onResume: () => void;
  onEmergencyStop: () => void;
}

export const EmergencyStopBanner: React.FC<EmergencyStopBannerProps> = ({
  isStopped,
  onResume,
  onEmergencyStop,
}) => {
  if (!isStopped) {
    return (
      <button
        onClick={onEmergencyStop}
        title="Emergency Stop: Halt all automated computer actions"
        className="fixed bottom-6 right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 text-[11px] font-mono font-medium text-rose-300 backdrop-blur-xl transition-all cursor-pointer shadow-lg hover:border-rose-400"
      >
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <span>STOP CONTROLS</span>
      </button>
    );
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90vw] animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-950/95 border border-rose-500/70 backdrop-blur-2xl text-rose-100 shadow-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white tracking-wide">
              EMERGENCY STOP ACTIVE
            </h4>
            <p className="text-[11px] text-rose-200/80 truncate">
              All automated desktop actions are paused.
            </p>
          </div>
        </div>

        <button
          onClick={onResume}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-md"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Resume</span>
        </button>
      </div>
    </div>
  );
};
