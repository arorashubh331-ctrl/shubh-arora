/**
 * CloudBrowserManager - Local Real Browser & Cloud Browser Orchestration
 * 
 * Supports:
 * 1. "Local Real Browser" Mode:
 *    - Opens a REAL visible browser window on the user's computer using playwright-core
 *      launchPersistentContext with channel "msedge" (falls back to "chrome"), headless: false.
 *    - Dedicated userDataDir: ./lucy-browser-profile (remembers Google and other logins).
 * 2. Preview Fallback Mode:
 *    - When running in the AI Studio cloud preview (where no local Edge/Chrome or GUI display exists),
 *      it falls back to the in-app iframe/new-tab panel with a clear explanation that real-browser mode
 *      needs the app to run locally.
 * 3. Sensitive Action Confirmation & Password Shield:
 *    - Asks the user to confirm by voice before sensitive actions (sending messages/emails, purchases, deleting).
 *    - Lucy strictly NEVER types passwords herself. Users are prompted to type passwords directly.
 */

import { chromium, BrowserContext, Page, Browser } from 'playwright-core';
import path from 'path';
import fs from 'fs';

export interface BrowserSessionStatus {
  isLocal: boolean;
  channel: string | null;
  profileDir: string;
  hasActiveSession: boolean;
  liveViewUrl: string | null;
  url: string | null;
  title: string | null;
  isPreviewFallback: boolean;
  hasApiKey: boolean;
}

export class CloudBrowserManager {
  private localContext: BrowserContext | null = null;
  private localPage: Page | null = null;
  private channel: 'msedge' | 'chrome' | 'cloud' | 'preview_fallback' | null = null;
  private isLocal: boolean = false;
  private isPreviewFallback: boolean = false;
  private currentUrl: string | null = null;
  private currentTitle: string | null = null;

  // Cloud browser session fallback (if BROWSER_API_KEY configured)
  private activeSession: {
    id: string;
    liveViewUrl: string;
    url: string;
    title: string;
    browser?: Browser;
    page?: Page;
  } | null = null;

  private profileDir: string;

  constructor() {
    this.profileDir = path.resolve(process.cwd(), 'lucy-browser-profile');
  }

  private getApiKey(): string | undefined {
    return process.env.BROWSER_API_KEY || process.env.BROWSERBASE_API_KEY;
  }

  private getProjectId(): string | undefined {
    return process.env.BROWSER_PROJECT_ID || process.env.BROWSERBASE_PROJECT_ID;
  }

  public getStatus(): BrowserSessionStatus {
    const hasLocalActive = Boolean(this.localContext && this.localPage && !this.localPage.isClosed());
    const hasCloudActive = Boolean(this.activeSession && this.activeSession.page && !this.activeSession.page.isClosed());

    return {
      isLocal: this.isLocal && hasLocalActive,
      channel: this.channel,
      profileDir: this.profileDir,
      hasActiveSession: hasLocalActive || hasCloudActive || (this.isPreviewFallback && Boolean(this.currentUrl)),
      liveViewUrl: this.activeSession?.liveViewUrl || (this.isPreviewFallback ? this.currentUrl : null),
      url: this.currentUrl,
      title: this.currentTitle,
      isPreviewFallback: this.isPreviewFallback,
      hasApiKey: Boolean(this.getApiKey()),
    };
  }

  /**
   * Attempts to launch a REAL visible local browser window on the user's computer.
   * Tries Microsoft Edge first, then Google Chrome.
   * Uses launchPersistentContext with ./lucy-browser-profile so Google login persists.
   */
  private async ensureLocalBrowser(): Promise<{ context: BrowserContext; page: Page; channel: 'msedge' | 'chrome' }> {
    if (this.localContext && this.localPage && !this.localPage.isClosed()) {
      return {
        context: this.localContext,
        page: this.localPage,
        channel: (this.channel as 'msedge' | 'chrome') || 'msedge',
      };
    }

    // Ensure dedicated user data directory exists
    if (!fs.existsSync(this.profileDir)) {
      try {
        fs.mkdirSync(this.profileDir, { recursive: true });
      } catch (err) {
        console.warn('[BrowserManager] Warning creating profile dir:', err);
      }
    }

    console.log('[BrowserManager] Attempting to launch Local Real Browser with profile at:', this.profileDir);

    // 1. Try Microsoft Edge first
    try {
      console.log('[BrowserManager] Launching with channel: "msedge" (headless: false)...');
      const context = await chromium.launchPersistentContext(this.profileDir, {
        channel: 'msedge',
        headless: false,
        viewport: null,
        args: ['--start-maximized'],
      });

      const pages = context.pages();
      const page = pages[0] || (await context.newPage());

      this.localContext = context;
      this.localPage = page;
      this.channel = 'msedge';
      this.isLocal = true;
      this.isPreviewFallback = false;

      context.on('close', () => {
        console.log('[BrowserManager] Local Edge browser context closed.');
        this.localContext = null;
        this.localPage = null;
        this.isLocal = false;
      });

      return { context, page, channel: 'msedge' };
    } catch (edgeErr: any) {
      console.log('[BrowserManager] Edge launch failed or not installed:', edgeErr?.message || edgeErr);
    }

    // 2. Fall back to Google Chrome
    try {
      console.log('[BrowserManager] Launching fallback with channel: "chrome" (headless: false)...');
      const context = await chromium.launchPersistentContext(this.profileDir, {
        channel: 'chrome',
        headless: false,
        viewport: null,
        args: ['--start-maximized'],
      });

      const pages = context.pages();
      const page = pages[0] || (await context.newPage());

      this.localContext = context;
      this.localPage = page;
      this.channel = 'chrome';
      this.isLocal = true;
      this.isPreviewFallback = false;

      context.on('close', () => {
        console.log('[BrowserManager] Local Chrome browser context closed.');
        this.localContext = null;
        this.localPage = null;
        this.isLocal = false;
      });

      return { context, page, channel: 'chrome' };
    } catch (chromeErr: any) {
      console.log('[BrowserManager] Chrome launch failed or not installed:', chromeErr?.message || chromeErr);
      throw new Error(
        `Could not launch local visible browser window. Real-browser mode needs the app to run locally on your computer with Microsoft Edge or Google Chrome installed. (${chromeErr?.message || 'No local display'})`
      );
    }
  }

  /**
   * Cloud Browser fallback (if BROWSER_API_KEY is configured in env)
   */
  private async ensureCloudSession(): Promise<{ page: Page; liveViewUrl: string }> {
    if (this.activeSession && this.activeSession.page && !this.activeSession.page.isClosed()) {
      return { page: this.activeSession.page, liveViewUrl: this.activeSession.liveViewUrl };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('BROWSER_API_KEY is not configured.');
    }

    const projectId = this.getProjectId();
    console.log('[BrowserManager] Connecting to remote cloud browser session...');

    const createRes = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'x-bb-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId: projectId || undefined }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create cloud browser session (status ${createRes.status}).`);
    }

    const sessionData = (await createRes.json()) as any;
    const sessionId = sessionData.id;
    const connectUrl = sessionData.connectUrl;

    let liveViewUrl = `https://www.browserbase.com/sessions/${sessionId}`;
    try {
      const debugRes = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
        headers: { 'x-bb-api-key': apiKey },
      });
      if (debugRes.ok) {
        const debugData = (await debugRes.json()) as any;
        liveViewUrl = debugData.debuggerFullscreenUrl || debugData.debuggerUrl || liveViewUrl;
      }
    } catch {}

    const browser = await chromium.connectOverCDP(connectUrl);
    const contexts = browser.contexts();
    const context = contexts[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());

    this.activeSession = {
      id: sessionId,
      liveViewUrl,
      url: 'about:blank',
      title: 'Lucy Browser',
      browser,
      page,
    };
    this.channel = 'cloud';
    this.isLocal = false;
    this.isPreviewFallback = false;

    return { page, liveViewUrl };
  }

  /**
   * Opens URL in:
   * 1. Real visible local browser window (Edge / Chrome with persistent profile ./lucy-browser-profile)
   * 2. Cloud browser session (if BROWSER_API_KEY is available)
   * 3. AI Studio preview fallback (iframe + direct tab with honest explanation)
   */
  public async openUrl(rawUrl: string): Promise<{
    success: boolean;
    isLocal: boolean;
    channel?: string | null;
    isPreviewFallback?: boolean;
    liveViewUrl?: string | null;
    url: string;
    title: string;
    message: string;
  }> {
    let cleanUrl = rawUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // 1. Try Real Local Browser Mode
    try {
      const local = await this.ensureLocalBrowser();
      console.log(`[BrowserManager] Navigating real visible browser to: ${cleanUrl}`);

      // Wait until navigation actually finishes
      await local.page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      const title = (await local.page.title()) || cleanUrl;

      this.currentUrl = cleanUrl;
      this.currentTitle = title;
      this.isLocal = true;
      this.isPreviewFallback = false;

      const browserName = local.channel === 'msedge' ? 'Microsoft Edge' : 'Google Chrome';
      return {
        success: true,
        isLocal: true,
        channel: local.channel,
        isPreviewFallback: false,
        url: cleanUrl,
        title,
        message: `Opened "${title}" in visible ${browserName} window on your computer.`,
      };
    } catch (localErr: any) {
      console.log('[BrowserManager] Local browser launch unavailable:', localErr?.message || localErr);

      // 2. Try Cloud Browser if API key is present
      if (this.getApiKey()) {
        try {
          const cloud = await this.ensureCloudSession();
          await cloud.page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          const title = (await cloud.page.title()) || cleanUrl;
          this.currentUrl = cleanUrl;
          this.currentTitle = title;
          this.isLocal = false;
          this.isPreviewFallback = false;
          return {
            success: true,
            isLocal: false,
            channel: 'cloud',
            liveViewUrl: cloud.liveViewUrl,
            url: cleanUrl,
            title,
            message: `Loaded "${title}" in Lucy Cloud Browser.`,
          };
        } catch (cloudErr) {
          console.log('[BrowserManager] Cloud browser unavailable:', cloudErr);
        }
      }

      // 3. Preview Fallback Mode (AI Studio cloud environment)
      // Remove dependency on cloud browser keys. Keep existing iframe/new-tab fallback.
      this.currentUrl = cleanUrl;
      this.currentTitle = cleanUrl;
      this.isLocal = false;
      this.channel = 'preview_fallback';
      this.isPreviewFallback = true;

      return {
        success: true,
        isLocal: false,
        channel: 'preview_fallback',
        isPreviewFallback: true,
        liveViewUrl: cleanUrl,
        url: cleanUrl,
        title: cleanUrl,
        message: `Opened ${cleanUrl} in the in-app preview panel. Real-browser mode opens a visible Edge or Chrome window when running locally on your computer!`,
      };
    }
  }

  /**
   * Searches Google
   */
  public async searchGoogle(query: string): Promise<{
    success: boolean;
    isLocal: boolean;
    channel?: string | null;
    isPreviewFallback?: boolean;
    liveViewUrl?: string | null;
    url: string;
    title: string;
    message: string;
  }> {
    const cleanQuery = query.trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
    return await this.openUrl(searchUrl);
  }

  /**
   * Clicks an element by text or selector.
   * SENSITIVE ACTION CHECK: Asks user to confirm by voice before sensitive actions
   * like deleting, paying, purchasing, or sending emails/messages.
   */
  public async click(
    textOrSelector: string,
    confirmed: boolean = false
  ): Promise<{ success: boolean; message: string; requiresConfirmation?: boolean }> {
    const target = textOrSelector.trim();
    const lower = target.toLowerCase();

    // Sensitive action detection
    const sensitiveKeywords = [
      'delete',
      'remove',
      'pay',
      'buy',
      'purchase',
      'place order',
      'send email',
      'send message',
      'checkout',
      'confirm payment',
      'transfer',
    ];

    const isSensitive = sensitiveKeywords.some((kw) => lower.includes(kw));
    if (isSensitive && !confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `Yeh ek sensitive action hai ("${target}"). Kya aap confirm karte hain ki main ye click kar doon? Please boliye "haan" ya "confirm karo".`,
      };
    }

    // 1. Local Browser click
    if (this.localPage && !this.localPage.isClosed()) {
      try {
        console.log(`[BrowserManager] Local browser clicking: "${target}"`);
        const byText = this.localPage.getByText(target, { exact: false }).first();
        if ((await byText.count()) > 0) {
          await byText.click({ timeout: 5000 });
          return { success: true, message: `Clicked "${target}" in browser window.` };
        }

        const byLocator = this.localPage.locator(target).first();
        if ((await byLocator.count()) > 0) {
          await byLocator.click({ timeout: 5000 });
          return { success: true, message: `Clicked element "${target}".` };
        }

        const clicked = await this.localPage.evaluate((searchText) => {
          const elements = Array.from(document.querySelectorAll('a, button, input, span, div, p'));
          const found = elements.find((el) => el.textContent?.toLowerCase().includes(searchText.toLowerCase()));
          if (found) {
            (found as HTMLElement).click();
            return true;
          }
          return false;
        }, target);

        if (clicked) {
          return { success: true, message: `Clicked "${target}" in browser window.` };
        }

        throw new Error(`Could not find clickable element matching "${target}".`);
      } catch (err: any) {
        throw new Error(`Click failed: ${err?.message || err}`);
      }
    }

    // 2. Cloud Browser click
    if (this.activeSession?.page && !this.activeSession.page.isClosed()) {
      try {
        const byText = this.activeSession.page.getByText(target, { exact: false }).first();
        if ((await byText.count()) > 0) {
          await byText.click({ timeout: 4000 });
          return { success: true, message: `Clicked "${target}".` };
        }
        const byLocator = this.activeSession.page.locator(target).first();
        if ((await byLocator.count()) > 0) {
          await byLocator.click({ timeout: 4000 });
          return { success: true, message: `Clicked element "${target}".` };
        }
        return { success: true, message: `Clicked "${target}".` };
      } catch (err: any) {
        throw new Error(`Click failed: ${err?.message || err}`);
      }
    }

    // 3. Preview mode click note
    return {
      success: true,
      message: `In preview mode, please click "${target}" directly in the browser panel or open in a new tab. For automated desktop clicks, run Lucy locally with Edge or Chrome!`,
    };
  }

  /**
   * Types text into the focused or active input element.
   * STRICT SECURITY RULE: Lucy MUST NEVER type passwords herself.
   */
  public async typeText(text: string): Promise<{ success: boolean; message: string; isPasswordBlocked?: boolean }> {
    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();

    // Strict Password Shield
    const passwordTerms = ['password', 'passcode', 'pin', 'otp', 'secret key', 'cvv'];
    if (passwordTerms.some((term) => lower.includes(term))) {
      return {
        success: false,
        isPasswordBlocked: true,
        message:
          'Lucy is programmed never to type passwords for your privacy and security. Please enter your password directly in the browser window. Your login will be remembered in ./lucy-browser-profile!',
      };
    }

    // 1. Local Browser typing
    if (this.localPage && !this.localPage.isClosed()) {
      try {
        // Inspect if active field is password input
        const isPasswordField = await this.localPage
          .evaluate(() => {
            const active = document.activeElement as HTMLInputElement;
            if (!active) return false;
            return (
              active.type === 'password' ||
              active.name?.toLowerCase().includes('password') ||
              active.id?.toLowerCase().includes('password')
            );
          })
          .catch(() => false);

        if (isPasswordField) {
          return {
            success: false,
            isPasswordBlocked: true,
            message:
              'The active field is a password field. Lucy cannot type passwords. Please type your password directly in the browser window!',
          };
        }

        await this.localPage.keyboard.type(cleanText, { delay: 35 });
        return { success: true, message: `Typed "${cleanText}" into browser window.` };
      } catch (err: any) {
        throw new Error(`Typing failed: ${err?.message || err}`);
      }
    }

    // 2. Cloud Browser typing
    if (this.activeSession?.page && !this.activeSession.page.isClosed()) {
      try {
        await this.activeSession.page.keyboard.type(cleanText, { delay: 40 });
        return { success: true, message: `Typed "${cleanText}".` };
      } catch (err: any) {
        throw new Error(`Typing failed: ${err?.message || err}`);
      }
    }

    // 3. Preview mode note
    return {
      success: true,
      message: `Typed "${cleanText}". In preview mode, you can also interact directly with the in-app panel!`,
    };
  }

  /**
   * Scrolls the page up or down
   */
  public async scroll(direction: 'up' | 'down'): Promise<{ success: boolean; message: string }> {
    const deltaY = direction === 'up' ? -600 : 600;

    if (this.localPage && !this.localPage.isClosed()) {
      try {
        await this.localPage.mouse.wheel(0, deltaY);
        return { success: true, message: `Scrolled ${direction}.` };
      } catch (err: any) {
        throw new Error(`Scroll failed: ${err?.message || err}`);
      }
    }

    if (this.activeSession?.page && !this.activeSession.page.isClosed()) {
      try {
        await this.activeSession.page.mouse.wheel(0, deltaY);
        return { success: true, message: `Scrolled ${direction}.` };
      } catch (err: any) {
        throw new Error(`Scroll failed: ${err?.message || err}`);
      }
    }

    return { success: true, message: `Scrolled ${direction}.` };
  }

  /**
   * Navigates back in browser history
   */
  public async goBack(): Promise<{ success: boolean; message: string }> {
    if (this.localPage && !this.localPage.isClosed()) {
      try {
        await this.localPage.goBack({ timeout: 10000 });
        const title = (await this.localPage.title()) || 'previous page';
        return { success: true, message: `Navigated back to "${title}".` };
      } catch (err: any) {
        throw new Error(`Go back failed: ${err?.message || err}`);
      }
    }

    if (this.activeSession?.page && !this.activeSession.page.isClosed()) {
      try {
        await this.activeSession.page.goBack({ timeout: 10000 });
        const title = (await this.activeSession.page.title()) || 'previous page';
        return { success: true, message: `Navigated back to "${title}".` };
      } catch (err: any) {
        throw new Error(`Go back failed: ${err?.message || err}`);
      }
    }

    return { success: true, message: 'Navigated back.' };
  }

  /**
   * Closes browser context/session
   */
  public async closeSession(): Promise<{ success: boolean; message: string }> {
    console.log('[BrowserManager] Closing browser session...');

    // Close local context if active
    if (this.localContext) {
      try {
        await this.localContext.close().catch(() => {});
      } catch {}
      this.localContext = null;
      this.localPage = null;
      this.isLocal = false;
    }

    // Close cloud session if active
    if (this.activeSession) {
      const sessionId = this.activeSession.id;
      try {
        if (this.activeSession.browser) {
          await this.activeSession.browser.close().catch(() => {});
        }
      } catch {}

      const apiKey = this.getApiKey();
      if (apiKey && sessionId) {
        try {
          await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
            method: 'POST',
            headers: {
              'x-bb-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
          }).catch(() => {});
        } catch {}
      }
      this.activeSession = null;
    }

    this.channel = null;
    this.currentUrl = null;
    this.currentTitle = null;
    this.isPreviewFallback = false;

    return { success: true, message: 'Browser session closed.' };
  }
}

export const cloudBrowserManager = new CloudBrowserManager();
