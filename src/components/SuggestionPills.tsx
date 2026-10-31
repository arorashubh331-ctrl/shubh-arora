import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { ThemeConfig } from '../types/assistant';

interface SuggestionPillsProps {
  theme: ThemeConfig;
  onSelectSuggestion?: (text: string) => void;
}

const SUGGESTIONS = [
  '🧠 "Remember that my favourite song is Kesariya"',
  '💭 "What do you remember about my projects?"',
  '☁️ "Lucy browser mein wikipedia.org kholo"',
  '🌐 "Google par AI news search karo"',
  '🎵 "Play Rabba / Play Kesariya"',
  '⏭️ "Next song / Next track"',
  '⏸️ "Lucy pause karo / volume 80 karo"',
  '📝 "Notepad mein meeting notes likho"',
  '🐍 "Python script create karo"',
  '📊 "Excel sheet banao students ke marks ki"',
  '💻 "Lucy, Chrome & VS Code open karo"',
  '🚨 "Emergency stop / Lucy ruko"',
  '❤️ "Tum pagal ho!" (Haan ji, aapke pyaar mein!)',
  '😉 "Kaisi ho Lucy?" (Aapki favourite!)',
  '🥺 "Mujhse naraz ho kya?"',
  '🥰 "Tum bohot cute ho!"',
  '💖 "I love you / I missed you"',
  '🔊 "Desktop volume badha do"',
  '☕ "Good morning sunshine"',
  '🌸 "Shift mood to emerald / sunset"',
];

export const SuggestionPills: React.FC<SuggestionPillsProps> = ({ theme }) => {
  return (
    <div className="relative z-20 w-full max-w-xl mx-auto px-4 pb-6 select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Try speaking these to Lucy:
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {SUGGESTIONS.map((s, idx) => (
          <div
            key={idx}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/10 text-zinc-300 backdrop-blur-md transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
