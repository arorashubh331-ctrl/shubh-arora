import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserPanelState, browserPanelController } from '../modules/desktop/BrowserPanelController';
import { ThemeConfig } from '../types/assistant';
import {
  Globe,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Lock,
} from 'lucide-react';

interface BrowserPanelOverlayProps {
  panelState: BrowserPanelState;
  theme: ThemeConfig;
}

export const BrowserPanelOverlay: React.FC<BrowserPanelOverlayProps> = ({ panelState, theme }) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 20, y: 80 });
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 560, height: 420 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(0);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: 0,
    startH: 0,
  });

  // Responsive defaults for mobile screens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setSize({
          width: Math.min(window.innerWidth - 24, 380),
          height: Math.min(window.innerHeight - 180, 440),
        });
        setPosition({ x: 12, y: 70 });
      }
    }
  }, []);

  // Update iframe key on URL change to re-trigger load
  useEffect(() => {
    setIframeKey((prev) => prev + 1);
  }, [panelState.url]);

  // Drag handlers
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    // Only drag from header, ignore buttons
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  // Resize handler
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const maxX = Math.max(10, window.innerWidth - 100);
        const maxY = Math.max(10, window.innerHeight - 80);
        setPosition({
          x: Math.max(10, Math.min(maxX, dragStartRef.current.startX + dx)),
          y: Math.max(40, Math.min(maxY, dragStartRef.current.startY + dy)),
        });
      } else if (isResizing) {
        const dw = e.clientX - resizeStartRef.current.mouseX;
        const dh = e.clientY - resizeStartRef.current.mouseY;
        setSize({
          width: Math.max(300, Math.min(window.innerWidth - 40, resizeStartRef.current.startW + dw)),
          height: Math.max(220, Math.min(window.innerHeight - 100, resizeStartRef.current.startH + dh)),
        });
      }
    },
    [isDragging, isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  if (!panelState.isOpen) return null;

  const handleClose = () => {
    browserPanelController.close();
  };

  const handleOpenInNewTab = () => {
    browserPanelController.openInNewTab();
  };

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
    browserPanelController.reload();
  };

  const isEmbedBlocked = panelState.embeddingBlocked;

  return (
    <div
      ref={panelRef}
      aria-label="In-App Browser Panel"
      className="fixed z-40 rounded-2xl border backdrop-blur-2xl bg-zinc-950/95 shadow-2xl flex flex-col overflow-hidden transition-all duration-150 animate-in fade-in zoom-in-95"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? '320px' : `${size.width}px`,
        height: isMinimized ? '48px' : `${size.height}px`,
        borderColor: `${theme.primary}50`,
        boxShadow: `0 16px 45px rgba(0,0,0,0.85), 0 0 30px ${theme.primary}25`,
      }}
    >
      {/* 1. Draggable Header & URL Bar */}
      <div
        onMouseDown={handleMouseDownHeader}
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.04] select-none cursor-move shrink-0 gap-2"
      >
        {/* Left: Indicator & Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${theme.primary}25`, color: theme.primary }}
          >
            <Globe className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase truncate hidden sm:inline">
            Browser Panel
          </span>
        </div>

        {/* Center: URL display badge */}
        {!isMinimized && (
          <div className="flex-1 max-w-xs sm:max-w-md mx-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/10 text-zinc-300 text-[11px] min-w-0">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate font-mono font-normal flex-1">
              {panelState.displayUrl || 'about:blank'}
            </span>
            {panelState.isLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-400 shrink-0" />}
          </div>
        )}

        {/* Right Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleReload}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Reload Page"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Panel Viewport */}
      {!isMinimized && (
        <div className="relative flex-1 w-full bg-black flex flex-col overflow-hidden">
          {/* Honest Fallback Card (Requirement 2) */}
          {isEmbedBlocked ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-950/30">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">
                This site doesn't allow embedding
              </h3>

              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-5">
                Websites like Google, YouTube, and GitHub enforce security policies that prevent display inside in-app
                frames. You can view the full website safely in a new browser tab.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={handleOpenInNewTab}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-900/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: theme.primary }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in New Tab</span>
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 w-full max-w-xs text-center">
                <p className="text-[10px] text-zinc-500 font-mono truncate">
                  Target: {panelState.url}
                </p>
              </div>
            </div>
          ) : (
            /* Standard IFrame for embeddable pages */
            <div className="relative w-full h-full bg-white">
              <iframe
                key={iframeKey}
                src={panelState.url || 'about:blank'}
                title={panelState.title || 'Browser Viewport'}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                onLoad={() => browserPanelController.handleIframeLoad()}
                onError={() => browserPanelController.handleIframeError()}
              />

              {panelState.isLoading && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 pointer-events-none">
                  <Loader2 className="w-7 h-7 animate-spin text-white" />
                  <span className="text-xs text-zinc-200 font-medium">Loading webpage...</span>
                  <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[280px]">
                    {panelState.displayUrl}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Resize Grip Handle at Bottom Right */}
          <div
            onMouseDown={handleMouseDownResize}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 text-zinc-500 hover:text-white select-none"
            title="Resize Panel"
          >
            <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current opacity-70">
              <circle cx="5" cy="5" r="0.8" />
              <circle cx="3" cy="5" r="0.8" />
              <circle cx="5" cy="3" r="0.8" />
              <circle cx="1" cy="5" r="0.8" />
              <circle cx="3" cy="3" r="0.8" />
              <circle cx="5" cy="1" r="0.8" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
