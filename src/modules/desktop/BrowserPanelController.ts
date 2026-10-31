/**
 * BrowserPanelController - Manages in-app floating, draggable, resizable Browser Panel
 * 
 * Complies with:
 * 1. Floating, draggable, resizable glass panel with URL bar, close button, and "Open in New Tab" button.
 * 2. openInBrowserPanel(url) and googleSearch(query) tools.
 * 3. Honest fallback: uses iframe onLoad/onError events + 3-second timeout check to detect embedding blocks
 *    (e.g., Google, YouTube, GitHub). Replaces panel content with clear card: "This site doesn't allow embedding"
 *    and a big "Open in New Tab" button.
 * 4. Never tries to bypass site security headers or restrictions (no proxy).
 */

export interface BrowserPanelState {
  isOpen: boolean;
  url: string | null;
  displayUrl: string | null;
  title: string | null;
  isLoading: boolean;
  embeddingBlocked: boolean;
  isMinimized: boolean;
  searchQuery: string | null;
}

export class BrowserPanelController {
  private state: BrowserPanelState = {
    isOpen: false,
    url: null,
    displayUrl: null,
    title: null,
    isLoading: false,
    embeddingBlocked: false,
    isMinimized: false,
    searchQuery: null,
  };

  private onStateChangeCallback: ((state: BrowserPanelState) => void) | null = null;
  private loadTimer: any = null;
  private pendingResolve: ((res: any) => void) | null = null;

  constructor() {}

  public setOnStateChange(cb: (state: BrowserPanelState) => void) {
    this.onStateChangeCallback = cb;
  }

  public getState(): BrowserPanelState {
    return { ...this.state };
  }

  /**
   * Known domains that strictly enforce X-Frame-Options: SAMEORIGIN / DENY
   */
  private isKnownNonEmbeddableDomain(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return (
        host.includes('google.') ||
        host.includes('youtube.com') ||
        host.includes('youtu.be') ||
        host.includes('github.com') ||
        host.includes('twitter.com') ||
        host.includes('x.com') ||
        host.includes('facebook.com') ||
        host.includes('instagram.com') ||
        host.includes('linkedin.com') ||
        host.includes('reddit.com') ||
        host.includes('medium.com')
      );
    } catch {
      return false;
    }
  }

  /**
   * Opens URL in Browser Panel with 3-second honest embedding detection
   */
  public async openUrl(rawUrl: string, searchQuery?: string): Promise<{
    success: boolean;
    verified: boolean;
    embeddingBlocked: boolean;
    url: string;
    message: string;
  }> {
    let cleanUrl = rawUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    console.log(`[BrowserPanelController] Opening URL in Browser Panel: ${cleanUrl}`);

    this.clearPendingLoad();

    const isKnownBlocked = this.isKnownNonEmbeddableDomain(cleanUrl);

    this.state.isOpen = true;
    this.state.url = cleanUrl;
    this.state.displayUrl = cleanUrl;
    this.state.title = searchQuery ? `Search: ${searchQuery}` : new URL(cleanUrl).hostname;
    this.state.searchQuery = searchQuery || null;
    this.state.isLoading = true;
    this.state.embeddingBlocked = isKnownBlocked;
    this.state.isMinimized = false;
    this.notifyState();

    return new Promise((resolve) => {
      this.pendingResolve = resolve;

      // 3-second timeout check for iframe embedding
      this.loadTimer = setTimeout(() => {
        if (this.pendingResolve) {
          // If known blocked or still loading after 3 seconds, mark embedding blocked
          if (isKnownBlocked || this.state.isLoading) {
            console.warn(`[BrowserPanelController] 3s check: site ${cleanUrl} cannot be embedded`);
            this.state.isLoading = false;
            this.state.embeddingBlocked = true;
            this.notifyState();

            this.pendingResolve({
              success: false,
              verified: false,
              embeddingBlocked: true,
              url: cleanUrl,
              message: `This site doesn't allow embedding inside the app, but you can open it in a new tab.`,
            });
          } else {
            // Loaded successfully
            this.pendingResolve({
              success: true,
              verified: true,
              embeddingBlocked: false,
              url: cleanUrl,
              message: `Opened ${cleanUrl} in the browser panel.`,
            });
          }
          this.pendingResolve = null;
        }
      }, 3000);

      // If known blocked immediately, resolve quickly so Lucy gives prompt honest reply
      if (isKnownBlocked) {
        setTimeout(() => {
          if (this.pendingResolve) {
            this.state.isLoading = false;
            this.state.embeddingBlocked = true;
            this.notifyState();

            this.pendingResolve({
              success: false,
              verified: false,
              embeddingBlocked: true,
              url: cleanUrl,
              message: `This site doesn't allow embedding inside the app, but you can open it in a new tab.`,
            });
            this.clearPendingLoad();
          }
        }, 800);
      }
    });
  }

  /**
   * Opens Google Search in the browser panel
   */
  public async googleSearch(query: string): Promise<{
    success: boolean;
    verified: boolean;
    embeddingBlocked: boolean;
    url: string;
    message: string;
  }> {
    const cleanQuery = query.trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
    return this.openUrl(searchUrl, cleanQuery);
  }

  /**
   * Called on iframe onLoad event
   */
  public handleIframeLoad() {
    console.log('[BrowserPanelController] IFrame onLoad event fired');
    // If it's a known non-embeddable site (like Google search), X-Frame-Options blocked it
    if (this.state.url && this.isKnownNonEmbeddableDomain(this.state.url)) {
      this.state.isLoading = false;
      this.state.embeddingBlocked = true;
      this.notifyState();
      return;
    }

    this.state.isLoading = false;
    this.state.embeddingBlocked = false;
    this.notifyState();

    if (this.pendingResolve) {
      this.pendingResolve({
        success: true,
        verified: true,
        embeddingBlocked: false,
        url: this.state.url || '',
        message: `Successfully loaded ${this.state.url} in browser panel.`,
      });
      this.clearPendingLoad();
    }
  }

  /**
   * Called on iframe onError event
   */
  public handleIframeError() {
    console.warn('[BrowserPanelController] IFrame onError event fired');
    this.state.isLoading = false;
    this.state.embeddingBlocked = true;
    this.notifyState();

    if (this.pendingResolve) {
      this.pendingResolve({
        success: false,
        verified: false,
        embeddingBlocked: true,
        url: this.state.url || '',
        message: `This site doesn't allow embedding inside the app, but you can open it in a new tab.`,
      });
      this.clearPendingLoad();
    }
  }

  public openInNewTab() {
    if (this.state.url) {
      window.open(this.state.url, '_blank', 'noopener,noreferrer');
    }
  }

  public close() {
    this.clearPendingLoad();
    this.state.isOpen = false;
    this.state.isLoading = false;
    this.state.embeddingBlocked = false;
    this.state.url = null;
    this.state.displayUrl = null;
    this.state.title = null;
    this.state.searchQuery = null;
    this.notifyState();
  }

  public toggleMinimize() {
    this.state.isMinimized = !this.state.isMinimized;
    this.notifyState();
  }

  public reload() {
    if (this.state.url) {
      const current = this.state.url;
      this.state.isLoading = true;
      this.notifyState();
      // Trigger iframe reload by resetting and reassigning
      setTimeout(() => {
        this.openUrl(current, this.state.searchQuery || undefined);
      }, 50);
    }
  }

  private clearPendingLoad() {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    this.pendingResolve = null;
  }

  private notifyState() {
    this.onStateChangeCallback?.({ ...this.state });
  }
}

export const browserPanelController = new BrowserPanelController();
