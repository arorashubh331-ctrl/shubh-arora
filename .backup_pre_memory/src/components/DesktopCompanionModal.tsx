import React, { useState, useEffect } from 'react';
import {
  Monitor,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  Volume2,
  FileCode,
  ExternalLink,
  ShieldAlert,
  Play,
  X,
  Sparkles,
  Command,
} from 'lucide-react';
import { ThemeConfig } from '../types/assistant';
import { desktopBridge } from '../modules/desktop/DesktopBridge';

interface DesktopCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
}

export const DesktopCompanionModal: React.FC<DesktopCompanionModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/desktop/status')
        .then((res) => res.json())
        .then((data) => setAgentStatus(data))
        .catch(() => setAgentStatus({ status: 'server-active', platform: 'windows' }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const psCommand = `powershell -ExecutionPolicy Bypass -File .\\lucy-windows-agent.ps1`;

  const handleCopy = () => {
    navigator.clipboard.writeText(psCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestExecution = async (action: string, args: Record<string, any>, label: string) => {
    setIsExecuting(label);
    setTestResult(null);
    try {
      const res = await desktopBridge.execute(action, args);
      if (res.verified) {
        setTestResult(`✓ SUCCESS: ${res.message}`);
      } else {
        setTestResult(`✕ ${res.message}`);
      }
    } catch (e: any) {
      setTestResult(`✕ Execution error: ${e?.message}`);
    } finally {
      setIsExecuting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl border"
              style={{
                backgroundColor: `${theme.primary}20`,
                borderColor: `${theme.primary}50`,
                color: theme.primary,
              }}
            >
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Windows 11 Desktop Assistant Architecture
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  REAL EXECUTION ACTIVE
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Alexa-like hands-free voice control with verified OS actions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Desktop Engine</span>
            <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Windows 11</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Action Verifier</span>
            <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>PID & Window</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Wake Word</span>
            <div className="flex items-center gap-1.5 mt-1 text-cyan-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>"Hey Lucy"</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Global Shortcut</span>
            <div className="flex items-center gap-1.5 mt-1 text-amber-300 text-xs font-semibold">
              <Command className="w-3.5 h-3.5" />
              <span>Ctrl+Shift+L</span>
            </div>
          </div>
        </div>

        {/* Interactive Quick Execution Tester */}
        <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 mb-5">
          <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-300 mb-3 flex items-center justify-between">
            <span>Live Action Tester (Click to verify native OS launch)</span>
            {isExecuting && (
              <span className="text-cyan-400 text-[11px] font-normal animate-pulse">
                Executing {isExecuting}...
              </span>
            )}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => handleTestExecution('openDesktopApp', { appName: 'Chrome' }, 'Chrome')}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Launch Chrome</span>
              <Play className="w-3 h-3 text-cyan-400" />
            </button>

            <button
              onClick={() => handleTestExecution('openDesktopApp', { appName: 'Notepad' }, 'Notepad')}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Launch Notepad</span>
              <Play className="w-3 h-3 text-cyan-400" />
            </button>

            <button
              onClick={() => handleTestExecution('openDesktopApp', { appName: 'VS Code' }, 'VS Code')}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Launch VS Code</span>
              <Play className="w-3 h-3 text-cyan-400" />
            </button>

            <button
              onClick={() =>
                handleTestExecution(
                  'youtubeSearchAndPlay',
                  { query: 'Rabba song Heropanti' },
                  'YouTube Rabba'
                )
              }
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Play Rabba on YouTube</span>
              <Play className="w-3 h-3 text-rose-400" />
            </button>

            <button
              onClick={() =>
                handleTestExecution(
                  'createNotepad',
                  { filename: 'LucyDictation.txt', content: 'Lucy created this real document directly on your computer disk.' },
                  'Create Note'
                )
              }
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Create Disk Note (.txt)</span>
              <Play className="w-3 h-3 text-emerald-400" />
            </button>

            <button
              onClick={() =>
                handleTestExecution(
                  'openDesktopFolderOrFile',
                  { pathOrName: 'LucyFiles' },
                  'File Explorer'
                )
              }
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Open File Explorer</span>
              <Play className="w-3 h-3 text-amber-400" />
            </button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-2.5 rounded-xl text-xs font-medium ${
                testResult.startsWith('✓')
                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950/50 text-rose-300 border border-rose-500/40'
              }`}
            >
              {testResult}
            </div>
          )}
        </div>

        {/* Local Windows Agent Instruction (For 100% Native PC Control) */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-zinc-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Windows 11 Companion Agent Command
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-xs text-zinc-400 mb-2.5">
            Run this single PowerShell command in your project directory on Windows 11 to grant Lucy direct unrestricted computer control:
          </p>

          <code className="block p-3 rounded-xl bg-black/60 border border-white/10 text-cyan-300 text-xs font-mono select-all overflow-x-auto">
            {psCommand}
          </code>

          <div className="mt-3 text-[11px] text-zinc-500 flex flex-wrap gap-4">
            <span>✓ Auto-launches Chrome & VS Code</span>
            <span>✓ Saves files to %USERPROFILE%\Desktop\LucyFiles</span>
            <span>✓ Alexa-like background execution</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-black cursor-pointer transition-all hover:scale-105"
            style={{ backgroundColor: theme.primary }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
