import React from 'react';
import { X, Sparkles, Mic, Wrench, MessageSquareHeart, Zap, Volume2, Monitor } from 'lucide-react';
import { ThemeConfig } from '../types/assistant';

interface VoiceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
}

export const VoiceGuideModal: React.FC<VoiceGuideModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-white/15 bg-zinc-950/95 p-6 shadow-2xl text-white"
        style={{
          boxShadow: `0 0 50px ${theme.glow}`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Talking to Lucy</h3>
              <p className="text-xs text-zinc-400">Pure real-time voice-to-voice intelligence</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5 text-sm">
          {/* Key Principle */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
            <Mic className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-xs tracking-wider uppercase text-cyan-300">
                100% Voice Experience & "Hey Lucy" Wake Word
              </h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Say <strong className="text-white">"Hey Lucy"</strong> or press <strong className="text-white font-mono">Ctrl+Shift+L</strong> anytime to activate hands-free voice control. You can also tap the central glowing orb.
              </p>
            </div>
          </div>

          {/* Natural Interruption */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-xs tracking-wider uppercase text-amber-300">
                Natural Interruption
              </h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                When Lucy is talking, you don't have to wait for her to finish. Simply start speaking or tap the orb, and she will instantly yield and listen to you.
              </p>
            </div>
          </div>

          {/* Feminine Playful Flirting & Hinglish Banter */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-fuchsia-300 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              Playful Flirting & Hinglish Banter (Sweet & Witty)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { user: `"Tum pagal ho."`, reply: `Lucy: "Haan ji, aapke pyaar mein! Hehe"` },
                { user: `"Kaisi ho?"`, reply: `Lucy: "Jaisi bhi hoon, aapki favourite hoon!"` },
                { user: `"Mujhse naraz ho?"`, reply: `Lucy: "Thoda sa! Ab manaoge bhi ya bas poochte rahoge?"` },
                { user: `"Tum cute ho."`, reply: `Lucy: "Achhaaa? Aaj badi tareef ho rahi hai meri!"` },
                { user: `"Mujhe tang mat karo."`, reply: `Lucy: "Achha baba, nahi karti... par thoda sa toh kar sakti hoon na?"` },
                { user: `"I love you."`, reply: `Lucy: "Aww, I love you too! Always."` },
              ].map((item, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 rounded-xl bg-fuchsia-950/25 border border-fuchsia-500/25 text-xs text-fuchsia-100 font-mono flex flex-col gap-1"
                >
                  <span className="text-zinc-300 font-medium">{item.user}</span>
                  <span className="text-fuchsia-300 font-semibold">{item.reply}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Emotional Support & Listening */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Empathetic Listening (When you need a friend)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                `"I had such a exhausting, stressful day today..." (She listens & comforts without unsolicited advice)`,
                `"I'm feeling really lonely right now, can we just chat?"`,
                `"I just received amazing news, celebrate with me!"`,
                `"Tease me a little about staying up too late."`,
              ].map((phrase, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-white/5 text-xs text-zinc-200 hover:border-white/20 transition-all font-mono"
                >
                  {phrase}
                </div>
              ))}
            </div>
          </div>

          {/* Real YouTube & Document Automation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-2.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-rose-400" />
              Real YouTube & File Creation (Voice-Executed)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { user: `"YouTube par Rabba song chalao."`, reply: `Lucy: "Aww Rabba! Abhi chalati hoon, suno... ❤️"` },
                { user: `"Lucy video pause karo / volume 60 karo."`, reply: `Lucy: "Video pause kar di hai!"` },
                { user: `"Notepad mein meeting notes bana do."`, reply: `Lucy: "Notes bana kar file download kar di!"` },
                { user: `"Python script banao sample code ke sath."`, reply: `Lucy: "Script.py ready hai, check kar lo!"` },
                { user: `"Excel sheet banao students marks ki."`, reply: `Lucy: "Sheet ready karke save kar di hai!"` },
                { user: `"Lucy ruko! / Emergency stop!"`, reply: `Lucy: "Sab rok diya hai, bolo kya hua?"` },
              ].map((item, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-950/25 border border-rose-500/25 text-xs text-rose-100 font-mono flex flex-col gap-1"
                >
                  <span className="text-zinc-300 font-medium">{item.user}</span>
                  <span className="text-rose-300 font-semibold">{item.reply}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Windows 11 Desktop Automation (Preserved Personality) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2.5 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-cyan-400" />
              Windows 11 Desktop Automation (Sweet & Playful)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { user: `"Lucy, Chrome open kar do."`, reply: `Lucy: "Achha ji, abhi kholti hoon! Hehe"` },
                { user: `"Mera project folder open karo."`, reply: `Lucy: "Sure! Ek second, tumhara project dhoondhti hoon."` },
                { user: `"Thank you, I love you."`, reply: `Lucy: "Aww, you're welcome! I love you too ❤️"` },
                { user: `"Desktop volume thoda badha do."`, reply: `Lucy: "Done! Awaaz thodi tez kar di hai."` },
                { user: `"Ek screenshot le lo please."`, reply: `Lucy: "Khinch li screenshot! Screenshots folder mein saved hai."` },
              ].map((item, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 rounded-xl bg-cyan-950/25 border border-cyan-500/25 text-xs text-cyan-100 font-mono flex flex-col gap-1"
                >
                  <span className="text-zinc-300 font-medium">{item.user}</span>
                  <span className="text-cyan-300 font-semibold">{item.reply}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Browser Tools */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-emerald-400" />
              Hands-Free Browser Tools
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                `"Lucy, shift your mood to velvet sunset."`,
                `"Open YouTube for some relaxing lo-fi music."`,
                `"Set a 15-minute timer for my reading time."`,
                `"Take a quick note: remember to call mom tonight."`,
                `"What's my local time and battery right now?"`,
              ].map((phrase, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-white/5 text-xs text-zinc-200 hover:border-white/20 transition-all font-mono"
                >
                  {phrase}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Got it, let's talk
          </button>
        </div>
      </div>
    </div>
  );
};
