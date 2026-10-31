/**
 * CloudBrowserController - Frontend Controller for Lucy Browser Panel
 * 
 * Supports:
 * - Local Real Browser (Visible Edge/Chrome window on user computer with saved profile ./lucy-browser-profile)
 * - Preview Fallback (In-app iframe and New Tab button for AI Studio cloud preview environment)
 * - Sensitive action voice confirmation
 * - Strict password typing block
 */

export interface CloudBrowserState {
  isOpen: boolean;
  liveViewUrl: string | null;
  url: string | null;
  title: string | null;
  isLoading: boolean;
  error: string | null;
  isMinimized: boolean;
  isLocal?: boolean;
  channel?: string | null;
  isPreviewFallback?: boolean;
  requiresConfirmation?: boolean;
  isPasswordBlocked?: boolean;
}

export class CloudBrowserController {
  private state: CloudBrowserState = {
    isOpen: false,
    liveViewUrl: null,
    url: null,
    title: null,
    isLoading: false,
    error: null,
    isMinimized: false,
    isLocal: false,
    channel: null,
    isPreviewFallback: false,
  };

  private onStateChangeCallback: ((state: CloudBrowserState) => void) | null = null;

  constructor() {}

  public setOnStateChange(cb: (state: CloudBrowserState) => void) {
    this.onStateChangeCallback = cb;
  }

  public getState(): CloudBrowserState {
    return { ...this.state };
  }

  /**
   * Opens URL in Local Real Browser or in-app preview panel
   */
  public async openUrl(url: string): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
    isLocal?: boolean;
    liveViewUrl?: string;
  }> {
    this.state.isOpen = true;
    this.state.isLoading = true;
    this.state.error = null;
    this.state.url = url;
    this.state.title = url;
    this.notifyState();

    try {
      const res = await fetch('/api/cloud-browser/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to open URL in browser session.';
        this.state.isLoading = false;
        this.state.error = errMsg;
        this.notifyState();
        return {
          success: false,
          verified: false,
          message: errMsg,
        };
      }

      this.state.isLoading = false;
      this.state.isLocal = Boolean(data.isLocal);
      this.state.channel = data.channel || null;
      this.state.isPreviewFallback = Boolean(data.isPreviewFallback);
      this.state.liveViewUrl = data.liveViewUrl || (data.isPreviewFallback ? data.url : null);
      this.state.url = data.url;
      this.state.title = data.title;
      this.state.error = null;
      this.notifyState();

      return {
        success: true,
        verified: true,
        isLocal: data.isLocal,
        liveViewUrl: data.liveViewUrl,
        message: data.message || `Loaded "${data.title || url}".`,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Network error communicating with browser service.';
      this.state.isLoading = false;
      this.state.error = errMsg;
      this.notifyState();
      return {
        success: false,
        verified: false,
        message: errMsg,
      };
    }
  }

  /**
   * Searches Google
   */
  public async searchGoogle(query: string): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
    isLocal?: boolean;
  }> {
    this.state.isOpen = true;
    this.state.isLoading = true;
    this.state.error = null;
    this.state.url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    this.state.title = `Search: ${query}`;
    this.notifyState();

    try {
      const res = await fetch('/api/cloud-browser/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to search Google in browser.';
        this.state.isLoading = false;
        this.state.error = errMsg;
        this.notifyState();
        return {
          success: false,
          verified: false,
          message: errMsg,
        };
      }

      this.state.isLoading = false;
      this.state.isLocal = Boolean(data.isLocal);
      this.state.channel = data.channel || null;
      this.state.isPreviewFallback = Boolean(data.isPreviewFallback);
      this.state.liveViewUrl = data.liveViewUrl || (data.isPreviewFallback ? data.url : null);
      this.state.url = data.url;
      this.state.title = data.title;
      this.state.error = null;
      this.notifyState();

      return {
        success: true,
        verified: true,
        isLocal: data.isLocal,
        message: data.message || `Searched Google for "${query}".`,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Network error searching in browser.';
      this.state.isLoading = false;
      this.state.error = errMsg;
      this.notifyState();
      return {
        success: false,
        verified: false,
        message: errMsg,
      };
    }
  }

  /**
   * Clicks an element by text or selector
   */
  public async click(
    text: string,
    confirmed?: boolean
  ): Promise<{ success: boolean; verified: boolean; message: string; requiresConfirmation?: boolean }> {
    try {
      const res = await fetch('/api/cloud-browser/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, confirmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          verified: false,
          requiresConfirmation: data.requiresConfirmation,
          message: data.message || data.error || `Could not click "${text}".`,
        };
      }
      return { success: true, verified: true, message: data.message || `Clicked "${text}".` };
    } catch (e: any) {
      return { success: false, verified: false, message: e?.message || 'Click failed.' };
    }
  }

  /**
   * Types text into the active field in the browser
   */
  public async typeText(
    text: string
  ): Promise<{ success: boolean; verified: boolean; message: string; isPasswordBlocked?: boolean }> {
    try {
      const res = await fetch('/api/cloud-browser/type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          verified: false,
          isPasswordBlocked: data.isPasswordBlocked,
          message: data.message || data.error || `Could not type "${text}".`,
        };
      }
      return { success: true, verified: true, message: data.message || `Typed "${text}".` };
    } catch (e: any) {
      return { success: false, verified: false, message: e?.message || 'Typing failed.' };
    }
  }

  /**
   * Scrolls the page up or down
   */
  public async scroll(direction: 'up' | 'down'): Promise<{ success: boolean; verified: boolean; message: string }> {
    try {
      const res = await fetch('/api/cloud-browser/scroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, verified: false, message: data.error || `Scroll ${direction} failed.` };
      }
      return { success: true, verified: true, message: data.message || `Scrolled ${direction}.` };
    } catch (e: any) {
      return { success: false, verified: false, message: e?.message || 'Scroll failed.' };
    }
  }

  /**
   * Navigates back in browser history
   */
  public async goBack(): Promise<{ success: boolean; verified: boolean; message: string }> {
    try {
      const res = await fetch('/api/cloud-browser/back', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, verified: false, message: data.error || 'Go back failed.' };
      }
      return { success: true, verified: true, message: data.message || 'Navigated back.' };
    } catch (e: any) {
      return { success: false, verified: false, message: e?.message || 'Go back failed.' };
    }
  }

  /**
   * Closes browser session
   */
  public async closeBrowser(): Promise<{ success: boolean; verified: boolean; message: string }> {
    console.log('[CloudBrowserController] Closing browser session...');
    this.state.isOpen = false;
    this.state.isLoading = false;
    this.state.liveViewUrl = null;
    this.state.url = null;
    this.state.title = null;
    this.state.error = null;
    this.state.isLocal = false;
    this.state.channel = null;
    this.state.isPreviewFallback = false;
    this.notifyState();

    try {
      const res = await fetch('/api/cloud-browser/close', {
        method: 'POST',
      });
      const data = await res.json();
      return { success: true, verified: true, message: data.message || 'Browser session closed.' };
    } catch {
      return { success: true, verified: true, message: 'Browser session closed.' };
    }
  }

  public openInNewTab() {
    const targetUrl = this.state.url || this.state.liveViewUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }

  public toggleMinimize() {
    this.state.isMinimized = !this.state.isMinimized;
    this.notifyState();
  }

  private notifyState() {
    this.onStateChangeCallback?.({ ...this.state });
  }
}

export const cloudBrowserController = new CloudBrowserController();
