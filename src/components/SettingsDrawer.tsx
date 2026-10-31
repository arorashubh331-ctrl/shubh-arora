import React from 'react';
import { X, Volume2, Mic, Palette, StickyNote, Trash2, Copy, Check } from 'lucide-react';
import { AuraTheme, ThemeConfig, VoiceOption, QuickNote, ActiveTimer } from '../types/assistant';
import { THEMES, VOICE_OPTIONS } from '../utils/themeConfig';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: AuraTheme;
  onSelectTheme: (theme: AuraTheme) => void;
  activeVoice: string;
  onSelectVoice: (voice: string) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  notes: QuickNote[];
  onDeleteNote: (id: string) => void;
  onClearAllNotes: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  activeTheme,
  onSelectTheme,
  activeVoice,
  onSelectVoice,
  volume,
  onVolumeChange,
  notes,
  onDeleteNote,
  onClearAllNotes,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const currentThemeConfig = THEMES[activeTheme];

  const handleCopyNote = (note: QuickNote) => {
    navigator.clipboard.writeText(`${note.title}: ${note.content}`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md h-full bg-zinc-950/95 border-l border-white/10 p-6 flex flex-col text-white shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold tracking-wide">Companion Settings</h3>
            <p className="text-xs text-zinc-400">Configure voice, ambiance & memory</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6 flex-1">
          {/* 1. Voice Persona */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-2.5">
              <Mic className="w-4 h-4 text-cyan-400" />
              Voice Model (Gemini Live)
            </label>
            <div className="grid grid-cols-1 gap-2">
              {VOICE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelectVoice(v.id)}
                  className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    activeVoice === v.id
                      ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-lg'
                      : 'bg-zinc-900/60 border-white/10 text-zinc-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{v.name}</span>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {v.gender}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{v.description}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5 italic">
              * Voice selection applies on the next connection session.
            </p>
          </div>

          {/* 2. Aura & Theme Aesthetic */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-2.5">
              <Palette className="w-4 h-4 text-fuchsia-400" />
              Aura Aesthetic
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(THEMES) as AuraTheme[]).map((themeKey) => {
                const item = THEMES[themeKey];
                const isSelected = activeTheme === themeKey;
                return (
                  <button
                    key={themeKey}
                    onClick={() => onSelectTheme(themeKey)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-white bg-white/10 shadow-lg'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: item.primary }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full -ml-2"
                        style={{ backgroundColor: item.secondary }}
                      />
                      <span className="text-xs font-semibold">{item.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 line-clamp-1">{item.tagline}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Output Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                Spoken Audio Volume
              </label>
              <span className="text-xs font-mono text-zinc-400">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* 4. Saved Voice Notes / Memos */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <StickyNote className="w-4 h-4 text-amber-400" />
                Saved Voice Memos ({notes.length})
              </label>
              {notes.length > 0 && (
                <button
                  onClick={onClearAllNotes}
                  className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {notes.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                No voice notes yet. Say "Lucy, take a note" to store memos.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl bg-zinc-900/70 border border-white/10 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <h6 className="text-xs font-bold text-white truncate">{note.title}</h6>
                      <p className="text-[11px] text-zinc-300 mt-0.5">{note.content}</p>
                      <span className="text-[9px] text-zinc-500 font-mono mt-1 block">
                        {new Date(note.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyNote(note)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Copy note"
                      >
                        {copiedId === note.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
