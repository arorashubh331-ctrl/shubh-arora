import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CloudBrowserState, cloudBrowserController } from '../modules/desktop/CloudBrowserController';
import { ThemeConfig } from '../types/assistant';
import {
  Globe,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Loader2,
  Lock,
  ArrowLeft,
  Monitor,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface LucyBrowserOverlayProps {
  browserState: CloudBrowserState;
  theme: ThemeConfig;
}

export const LucyBrowserOverlay: React.FC<LucyBrowserOverlayProps> = ({ browserState, theme }) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 28, y: 72 });
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 680, height: 480 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [iframeFailed, setIframeFailed] = useState<boolean>(false);

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

  // Reset iframe failed state when URL changes
  useEffect(() => {
    setIframeFailed(false);
  }, [browserState.url, browserState.liveViewUrl]);

  // Responsive defaults for mobile screens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setSize({
          width: Math.min(window.innerWidth - 20, 420),
          height: Math.min(window.innerHeight - 150, 460),
        });
        setPosition({ x: 10, y: 64 });
      }
    }
  }, []);

  // Drag handlers
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.preventDefault();
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
        const maxX = Math.max(0, window.innerWidth - (isMinimized ? 320 : size.width) - 10);
        const maxY = Math.max(0, window.innerHeight - (isMinimized ? 44 : size.height) - 10);

        setPosition({
          x: Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX),
          y: Math.min(Math.max(10, dragStartRef.current.startY + dy), maxY),
        });
      } else if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.mouseX;
        const dy = e.clientY - resizeStartRef.current.mouseY;
        const newW = Math.max(380, Math.min(window.innerWidth - position.x - 20, resizeStartRef.current.startW + dx));
        const newH = Math.max(260, Math.min(window.innerHeight - position.y - 20, resizeStartRef.current.startH + dy));
        setSize({ width: newW, height: newH });
      }
    },
    [isDragging, isResizing, isMinimized, size.width, size.height, position.x, position.y]
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

  // Actions
  const handleClose = () => {
    cloudBrowserController.closeBrowser();
  };

  const handleOpenInNewTab = () => {
    cloudBrowserController.openInNewTab();
  };

  const handleGoBack = () => {
    cloudBrowserController.goBack();
  };

  const handleReload = () => {
    if (browserState.url) {
      cloudBrowserController.openUrl(browserState.url);
    }
  };

  if (!browserState.isOpen) {
    return null;
  }

  const browserName = browserState.channel === 'msedge' ? 'Microsoft Edge' : 'Google Chrome';

  return (
    <div
      ref={panelRef}
      className="fixed z-40 flex flex-col rounded-2xl overflow-hidden backdrop-blur-2xl bg-zinc-950/90 border transition-shadow duration-300 shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? '340px' : `${size.width}px`,
        height: isMinimized ? '48px' : `${size.height}px`,
        borderColor: `${theme.primary}50`,
        boxShadow: `0 20px 50px rgba(0,0,0,0.88), 0 0 35px ${theme.primary}25`,
      }}
    >
      {/* 1. Header Bar with Controls */}
      <div
        onMouseDown={handleMouseDownHeader}
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.04] select-none cursor-move shrink-0 gap-2"
      >
        {/* Left: Brand Badge & Mode Indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${theme.primary}25`, color: theme.primary }}
          >
            <Monitor className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold text-zinc-200 tracking-wide uppercase truncate">
            Lucy Browser
          </span>

          {browserState.isLocal ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 hidden sm:inline flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Real Desktop ({browserState.channel === 'msedge' ? 'Edge' : 'Chrome'})
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30 hidden sm:inline">
              Preview Mode
            </span>
          )}
        </div>

        {/* Center: Address Bar */}
        {!isMinimized && (
          <div className="flex-1 max-w-sm sm:max-w-md mx-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/10 text-zinc-300 text-[11px] min-w-0">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate font-mono font-normal flex-1">
              {browserState.url || 'about:blank'}
            </span>
            {browserState.isLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-400 shrink-0" />}
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleGoBack}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
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
            title="Close Browser"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Viewport */}
      {!isMinimized && (
        <div className="relative flex-1 w-full bg-black flex flex-col overflow-hidden">
          {/* A. Local Real Browser Active State */}
          {browserState.isLocal ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 overflow-y-auto">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <h3 className="text-base font-bold text-white mb-1 tracking-tight">
                Real Visible Browser Active
              </h3>

              <p className="text-xs text-zinc-300 max-w-md leading-relaxed mb-4">
                A live, visible <strong className="text-white">{browserName}</strong> window is running on your desktop.
              </p>

              <div className="w-full max-w-md p-3.5 mb-5 rounded-xl bg-zinc-900/90 border border-white/10 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px] border-b border-white/5 pb-1.5">
                  <span>Current Page:</span>
                  <span className="text-zinc-200 font-semibold truncate max-w-[200px]">{browserState.title || 'Loaded'}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px] border-b border-white/5 pb-1.5">
                  <span>URL:</span>
                  <span className="text-cyan-300 truncate max-w-[240px]">{browserState.url || 'about:blank'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Google login preserved in <code className="text-amber-300">./lucy-browser-profile</code></span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleOpenInNewTab}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: theme.primary }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Direct Tab</span>
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : browserState.error ? (
            /* B. Error State */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 overflow-y-auto">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-lg shadow-rose-950/40">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <h3 className="text-base font-bold text-white mb-1 tracking-tight">
                Browser Launch Notice
              </h3>

              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-4">
                {browserState.error}
              </p>

              <div className="p-3 mb-5 rounded-xl bg-zinc-900 border border-white/10 max-w-sm text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-1">
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Local Real Browser Mode:</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Real visible browser automation uses Microsoft Edge or Chrome on your local machine with profile <code className="text-cyan-300">./lucy-browser-profile</code>. In this cloud preview, you can browse via direct tab below.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {browserState.url && (
                  <button
                    onClick={handleOpenInNewTab}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open URL in Direct Tab</span>
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Close Panel
                </button>
              </div>
            </div>
          ) : browserState.liveViewUrl ? (
            /* C. Preview / Live Viewport (Iframe or Cloud Stream) */
            <div className="relative w-full h-full bg-zinc-950 flex flex-col">
              {/* Preview mode top info pill */}
              {browserState.isPreviewFallback && (
                <div className="px-3 py-1 bg-zinc-900/90 border-b border-white/10 flex items-center justify-between text-[11px] text-zinc-400 font-mono shrink-0">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    In-app preview. Run Lucy locally for visible desktop Edge/Chrome!
                  </span>
                  <button
                    onClick={handleOpenInNewTab}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Open New Tab ↗
                  </button>
                </div>
              )}

              {/* Iframe View */}
              <div className="relative flex-1 w-full h-full">
                {iframeFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
                    <Globe className="w-12 h-12 text-zinc-600 mb-3" />
                    <h4 className="text-sm font-semibold text-white mb-1">
                      Embedding Restricted by Website
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-sm mb-4">
                      This website restricts iframe embedding in cloud preview. Open it in a new tab, or run Lucy locally for full visible Edge/Chrome automation!
                    </p>
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md cursor-pointer"
                      style={{ backgroundColor: theme.primary }}
                    >
                      Open in New Tab
                    </button>
                  </div>
                ) : (
                  <iframe
                    src={browserState.liveViewUrl}
                    title="Lucy Browser Viewport"
                    className="w-full h-full border-0"
                    onError={() => setIframeFailed(true)}
                    allow="autoplay; clipboard-read; clipboard-write"
                  />
                )}

                {browserState.isLoading && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <Loader2 className="w-7 h-7 animate-spin text-white" />
                    <span className="text-xs text-zinc-200 font-medium">Loading page...</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* D. Loading State */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <h4 className="text-sm font-semibold text-white mb-1">
                Starting Browser...
              </h4>
              <p className="text-xs text-zinc-400 max-w-xs font-mono">
                Launching with persistent profile ./lucy-browser-profile
              </p>
            </div>
          )}

          {/* Bottom Right Resize Grip */}
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
