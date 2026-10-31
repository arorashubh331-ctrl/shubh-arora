import React, { useState } from 'react';
import { ActiveDocument } from '../modules/desktop/DocumentManager';
import { ThemeConfig } from '../types/assistant';
import { FileText, Code2, Table, FileCheck2, Download, Copy, Check, X } from 'lucide-react';

interface ActiveDocumentModalProps {
  document: ActiveDocument | null;
  theme: ThemeConfig;
  onClose: () => void;
}

export const ActiveDocumentModal: React.FC<ActiveDocumentModalProps> = ({
  document,
  theme,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!document) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleDownloadAgain = () => {
    try {
      const mimeType =
        document.type === 'excel'
          ? 'text/csv'
          : document.type === 'word'
          ? 'application/msword'
          : 'text/plain';

      const blob = new Blob([document.content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.filename;
      window.document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      console.error('Failed to download', e);
    }
  };

  const getIcon = () => {
    switch (document.type) {
      case 'code':
        return <Code2 className="w-4 h-4 text-emerald-400" />;
      case 'excel':
        return <Table className="w-4 h-4 text-emerald-300" />;
      case 'word':
        return <FileCheck2 className="w-4 h-4 text-blue-400" />;
      default:
        return <FileText className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl border backdrop-blur-2xl bg-zinc-950/95 shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200"
        style={{
          borderColor: `${theme.primary}50`,
          boxShadow: `0 15px 50px rgba(0,0,0,0.8), 0 0 30px ${theme.primary}25`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">{getIcon()}</div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-wide truncate">
                {document.filename}
              </h3>
              <p className="text-[10px] text-zinc-400">
                Created & saved on your machine • {new Date(document.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Viewer */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-zinc-300 leading-relaxed bg-black/40">
          <pre className="whitespace-pre-wrap break-words">{document.content}</pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02]">
          <span className="text-[11px] text-zinc-500">
            Type: <span className="uppercase text-zinc-300 font-semibold">{document.type}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Content</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadAgain}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md"
              style={{
                backgroundColor: theme.primary,
                boxShadow: `0 4px 15px ${theme.primary}40`,
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Again</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
