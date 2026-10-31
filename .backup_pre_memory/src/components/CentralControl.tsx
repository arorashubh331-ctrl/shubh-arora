import React from 'react';
import { Mic, MicOff, Power, Volume2, Sparkles, AlertCircle, Radio, Heart } from 'lucide-react';
import { AssistantState, ThemeConfig } from '../types/assistant';

interface CentralControlProps {
  state: AssistantState;
  theme: ThemeConfig;
  isMuted: boolean;
  onToggleConnect: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
}

export const CentralControl: React.FC<CentralControlProps> = ({
  state,
  theme,
  isMuted,
  onToggleConnect,
  onToggleMute,
  onInterrupt,
}) => {
  const isConnected = state === 'listening' || state === 'speaking';
  const isConnecting = state === 'connecting';

  const getStateLabel = () => {
    switch (state) {
      case 'connecting':
        return {
          title: 'Connecting with Lucy...',
          desc: 'Waking up her voice and listening presence',
          badge: 'CONNECTING',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'listening':
        return {
          title: isMuted ? 'Microphone Muted' : 'Listening with warmth...',
          desc: isMuted ? 'Unmute anytime to talk with Lucy' : 'She is right here with you... speak naturally',
          badge: isMuted ? 'MUTED' : 'HERE WITH YOU ❤️',
          badgeClass: isMuted
            ? 'bg-red-500/20 text-red-300 border-red-500/40'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'speaking':
        return {
          title: 'Lucy is speaking...',
          desc: 'Tap anytime or speak naturally to interrupt',
          badge: 'SPEAKING',
          badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse',
        };
      case 'error':
        return {
          title: 'Connection Issue',
          desc: 'Tap orb to reconnect microphone',
          badge: 'ATTENTION',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'disconnected':
      default:
        return {
          title: 'Lucy Companion',
          desc: 'Tap the orb to connect with Lucy ❤️',
          badge: 'TOUCH TO WAKE',
          badgeClass: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50',
        };
    }
  };

  const info = getStateLabel();

  return (
    <div className="relative z-10 flex flex-col items-center justify-center select-none">
      {/* Outer Halo Rings */}
      <div className="relative flex items-center justify-center">
        {/* Glow backdrop */}
        <div
          className={`absolute rounded-full filter blur-2xl transition-all duration-700 pointer-events-none ${
            state === 'speaking'
              ? 'w-72 h-72 opacity-80 scale-110'
              : state === 'listening'
              ? 'w-64 h-64 opacity-60 scale-100'
              : state === 'connecting'
              ? 'w-60 h-60 opacity-50 animate-pulse'
              : 'w-48 h-48 opacity-25 scale-90'
          }`}
          style={{
            background: `radial-gradient(circle, ${theme.primary} 0%, ${theme.secondary} 60%, transparent 80%)`,
          }}
        />

        {/* Outer concentric pulsing ring */}
        {(isConnected || isConnecting) && (
          <div
            className={`absolute rounded-full border border-dashed transition-all duration-1000 ${
              state === 'speaking'
                ? 'w-64 h-64 border-cyan-400/40 animate-[spin_12s_linear_infinite]'
                : state === 'connecting'
                ? 'w-56 h-56 border-amber-400/40 animate-[spin_4s_linear_infinite]'
                : 'w-56 h-56 border-white/20 animate-[spin_24s_linear_infinite]'
            }`}
          />
        )}

        {/* Main Central Orb Button */}
        <button
          onClick={() => {
            if (state === 'speaking') {
              onInterrupt();
            } else {
              onToggleConnect();
            }
          }}
          className={`relative group w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 cursor-pointer focus:outline-none focus:ring-4 focus:ring-cyan-500/30 ${
            state === 'speaking'
              ? 'shadow-[0_0_50px_rgba(0,240,255,0.7)] scale-105'
              : state === 'listening'
              ? 'shadow-[0_0_35px_rgba(16,185,129,0.5)] scale-100 hover:scale-105'
              : state === 'connecting'
              ? 'shadow-[0_0_35px_rgba(245,158,11,0.5)]'
              : 'shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:shadow-[0_0_35px_rgba(0,240,255,0.4)] hover:scale-105'
          }`}
          style={{
            background:
              state === 'disconnected'
                ? 'linear-gradient(135deg, rgba(24,24,27,0.9) 0%, rgba(9,9,11,0.95) 100%)'
                : state === 'speaking'
                ? `linear-gradient(135deg, ${theme.secondary}88 0%, ${theme.primary}aa 100%)`
                : state === 'listening'
                ? `linear-gradient(135deg, rgba(16,185,129,0.25) 0%, ${theme.primary}55 100%)`
                : `linear-gradient(135deg, rgba(245,158,11,0.25) 0%, ${theme.primary}44 100%)`,
            backdropFilter: 'blur(20px)',
            border: `1.5px solid ${isConnected ? theme.primary : 'rgba(255,255,255,0.18)'}`,
          }}
          title={state === 'speaking' ? 'Click to interrupt' : isConnected ? 'Click to disconnect' : 'Click to connect'}
        >
          {/* Glass reflections */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-t from-transparent via-white/5 to-white/20 pointer-events-none" />

          {/* Icon state */}
          <div className="relative z-10 flex flex-col items-center">
            {state === 'disconnected' ? (
              <Power className="w-10 h-10 text-zinc-300 group-hover:text-cyan-300 transition-colors drop-shadow" />
            ) : state === 'connecting' ? (
              <Radio className="w-10 h-10 text-amber-300 animate-pulse drop-shadow" />
            ) : state === 'speaking' ? (
              <Volume2 className="w-11 h-11 text-white animate-bounce drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
            ) : (
              <Mic className="w-11 h-11 text-white drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]" />
            )}
          </div>

          {/* Subtext indicator inside orb */}
          <span className="relative z-10 mt-1.5 text-[10px] uppercase font-bold tracking-widest text-white/80">
            {state === 'speaking' ? 'Interrupt' : isConnected ? 'Active' : 'Start'}
          </span>
        </button>
      </div>

      {/* State Badge and Live Label */}
      <div className="mt-8 flex flex-col items-center text-center px-4 max-w-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold tracking-wider backdrop-blur-md transition-all shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'speaking'
                ? 'bg-cyan-400 animate-ping'
                : state === 'listening'
                ? 'bg-emerald-400 animate-pulse'
                : state === 'connecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-zinc-500'
            }`}
          />
          <span className={info.badgeClass.split(' ')[1]}>{info.badge}</span>
        </div>

        <h2 className="mt-2 text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          {info.title}
          {state === 'speaking' ? (
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
          ) : isConnected ? (
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          ) : null}
        </h2>

        <p className="mt-1 text-xs text-zinc-400 font-medium">
          {info.desc}
        </p>

        {/* Action Controls for Connected state (Mute & Disconnect quick actions) */}
        {isConnected && (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={onToggleMute}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-lg border transition-all ${
                isMuted
                  ? 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30'
                  : 'bg-white/10 text-zinc-300 border-white/20 hover:bg-white/20 hover:text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              {isMuted ? 'Unmute' : 'Mute Mic'}
            </button>

            <button
              onClick={onToggleConnect}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-lg bg-zinc-800/80 text-zinc-300 border border-zinc-700 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700/50 transition-all"
            >
              <Power className="w-3.5 h-3.5 text-zinc-400" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
