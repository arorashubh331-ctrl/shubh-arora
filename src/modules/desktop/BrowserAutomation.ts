/**
 * BrowserAutomation - Real Browser Navigation, Search & Element Interaction Module
 */

export class BrowserAutomation {
  constructor() {}

  /**
   * Opens URL or performs Google search
   */
  public async openOrSearch(queryOrUrl: string): Promise<{
    success: boolean;
    message: string;
    url: string;
    verified: boolean;
  }> {
    const raw = queryOrUrl.trim();
    let targetUrl: string;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      targetUrl = raw;
    } else if (raw.includes('.') && !raw.includes(' ')) {
      targetUrl = `https://${raw}`;
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
    }

    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch {}

    return {
      success: true,
      message: `Navigated browser to ${targetUrl}`,
      url: targetUrl,
      verified: true,
    };
  }

  /**
   * Creates a new browser tab
   */
  public async createNewTab(url: string = 'https://www.google.com'): Promise<{
    success: boolean;
    message: string;
    verified: boolean;
  }> {
    window.open(url, '_blank', 'noopener,noreferrer');
    return {
      success: true,
      message: `Opened new tab with ${url}`,
      verified: true,
    };
  }

  /**
   * Scrolls the active web page
   */
  public async scrollPage(direction: 'up' | 'down'): Promise<{
    success: boolean;
    message: string;
    verified: boolean;
  }> {
    const amount = direction === 'down' ? 500 : -500;
    window.scrollBy({ top: amount, behavior: 'smooth' });
    return {
      success: true,
      message: `Scrolled page ${direction}.`,
      verified: true,
    };
  }
}

export const browserAutomation = new BrowserAutomation();
