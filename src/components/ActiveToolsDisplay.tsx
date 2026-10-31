import React, { useEffect } from 'react';
import { Timer as TimerIcon, StickyNote, ExternalLink, X, CheckCircle2, Clock, Folder, Monitor, Volume2, Camera, Sliders, Music2 } from 'lucide-react';
import { ActiveTimer, QuickNote, ToolNotification, ThemeConfig } from '../types/assistant';

interface ActiveToolsDisplayProps {
  timers: ActiveTimer[];
  notes: QuickNote[];
  notifications: ToolNotification[];
  theme: ThemeConfig;
  onDismissTimer: (id: string) => void;
  onDismissNote: (id: string) => void;
  onDismissNotification: (id: string) => void;
  onUpdateTimers: (updated: ActiveTimer[]) => void;
}

export const ActiveToolsDisplay: React.FC<ActiveToolsDisplayProps> = ({
  timers,
  notes,
  notifications,
  theme,
  onDismissTimer,
  onDismissNote,
  onDismissNotification,
  onUpdateTimers,
}) => {
  // Tick timers down every second
  useEffect(() => {
    if (timers.length === 0) return;

    const interval = setInterval(() => {
      let hasChanges = false;
      const updated = timers.map((t) => {
        if (t.remainingSeconds > 0) {
          hasChanges = true;
          const nextSec = t.remainingSeconds - 1;
          if (nextSec === 0) {
            // Beep alert
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.2, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.4);
            } catch {}
          }
          return {
            ...t,
            remainingSeconds: nextSec,
            isCompleted: nextSec === 0,
          };
        }
        return t;
      });

      if (hasChanges) {
        onUpdateTimers(updated);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timers, onUpdateTimers]);

  return (
    <div className="fixed top-20 right-4 z-30 max-w-sm w-full pointer-events-none flex flex-col gap-2.5 px-2">
      {/* 1. Real-time Tool Action Notifications */}
      {notifications.slice(0, 3).map((notif) => (
        <div
          key={notif.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl bg-zinc-900/85 shadow-2xl transition-all animate-in fade-in slide-in-from-right duration-300"
          style={{
            borderColor: `${theme.primary}50`,
            boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 15px ${theme.primary}33`,
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}
          >
            {notif.tool === 'openWebsite' || notif.tool === 'searchWeb' ? (
              <ExternalLink className="w-4 h-4" />
            ) : notif.tool === 'youtubeSearchAndPlay' || notif.tool === 'youtubePlay' ? (
              <Music2 className="w-4 h-4 animate-pulse" />
            ) : notif.tool === 'setTimer' ? (
              <TimerIcon className="w-4 h-4" />
            ) : notif.tool === 'folder_open' || notif.tool === 'openDesktopFolderOrFile' ? (
              <Folder className="w-4 h-4" />
            ) : notif.tool === 'app_launch' || notif.tool === 'openDesktopApp' ? (
              <Monitor className="w-4 h-4" />
            ) : notif.tool === 'device_control' || notif.tool === 'controlDeviceSettings' ? (
              <Volume2 className="w-4 h-4" />
            ) : notif.tool === 'screenshot' || notif.tool === 'takeDesktopScreenshot' ? (
              <Camera className="w-4 h-4" />
            ) : notif.tool === 'system_action' || notif.tool === 'executeSystemAction' ? (
              <Sliders className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white tracking-wide truncate">
              {notif.title}
            </h4>
            <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-2">
              {notif.description}
            </p>
            {notif.url && (
              <a
                href={notif.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
              >
                <span>Visit URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            onClick={() => onDismissNotification(notif.id)}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* 2. Active Countdown Timers */}
      {timers.map((timer) => {
        const mins = Math.floor(timer.remainingSeconds / 60);
        const secs = timer.remainingSeconds % 60;
        const progress = Math.max(0, (timer.remainingSeconds / timer.totalSeconds) * 100);

        return (
          <div
            key={timer.id}
            className={`pointer-events-auto p-3 rounded-2xl border backdrop-blur-xl shadow-xl transition-all ${
              timer.isCompleted
                ? 'bg-emerald-950/70 border-emerald-500/60 animate-bounce'
                : 'bg-zinc-900/80 border-white/15'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Clock className={`w-3.5 h-3.5 ${timer.isCompleted ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="text-xs font-semibold text-white tracking-wide truncate max-w-[160px]">
                  {timer.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold ${
                    timer.isCompleted ? 'text-emerald-300 animate-pulse' : 'text-zinc-200'
                  }`}
                >
                  {timer.isCompleted
                    ? 'DONE!'
                    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
                </span>
                <button
                  onClick={() => onDismissTimer(timer.id)}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  timer.isCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-rose-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* 3. Latest Voice Notes */}
      {notes.slice(0, 2).map((note) => (
        <div
          key={note.id}
          className="pointer-events-auto p-3 rounded-2xl border border-white/10 bg-zinc-900/75 backdrop-blur-xl shadow-lg flex items-start gap-2.5"
        >
          <StickyNote className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-semibold text-white truncate">{note.title}</h5>
            <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-2">{note.content}</p>
          </div>
          <button
            onClick={() => onDismissNote(note.id)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
