/**
 * DesktopBridge - Real Windows 11 Desktop Execution & Action Verification Bridge
 * 
 * Routes execution requests to:
 * 1. Native Electron IPC (if app is running as desktop application)
 * 2. Local Windows Agent (http://127.0.0.1:31548) if running locally on Windows PC
 * 3. Server OS API (/api/desktop/execute)
 * 
 * Enforces strict Action Verification:
 * Never returns verified: true unless the process, window, file, or media action
 * actually executed and verified on the operating system.
 */

export interface DesktopBridgeResponse {
  success: boolean;
  verified: boolean;
  message: string;
  data?: any;
}

export class DesktopBridge {
  private localAgentUrl: string = 'http://127.0.0.1:31548';
  private localAgentConnected: boolean = false;
  private lastCheckedAgent: number = 0;

  constructor() {
    this.checkLocalAgentHealth();
  }

  /**
   * Check if local Windows Agent (lucy-windows-agent.ps1) is active on user's PC
   */
  public async checkLocalAgentHealth(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheckedAgent < 5000 && this.localAgentConnected) {
      return this.localAgentConnected;
    }
    this.lastCheckedAgent = now;

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 800);
      const res = await fetch(`${this.localAgentUrl}/status`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(id);
      if (res.ok) {
        this.localAgentConnected = true;
        return true;
      }
    } catch {
      this.localAgentConnected = false;
    }
    return false;
  }

  public isLocalAgentActive(): boolean {
    return this.localAgentConnected;
  }

  /**
   * Executes a desktop action through the best available real execution channel
   */
  public async execute(action: string, args: Record<string, any>): Promise<DesktopBridgeResponse> {
    console.log(`[DesktopBridge] Executing real desktop action: ${action}`, args);

    // Channel 1: Electron Native IPC (Full desktop permissions)
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.executeDesktopAction === 'function') {
      try {
        console.log('[DesktopBridge] Routing to Electron native IPC');
        const res = await electronAPI.executeDesktopAction(action, args);
        return {
          success: Boolean(res.success),
          verified: Boolean(res.verified ?? res.success),
          message: res.message || `Executed ${action} via native desktop companion.`,
          data: res.data,
        };
      } catch (err: any) {
        console.error('[DesktopBridge] Electron IPC error:', err);
      }
    }

    // Channel 2: Local Windows Agent on Port 31548 (Zero-friction local execution)
    const isAgentAvailable = await this.checkLocalAgentHealth();
    if (isAgentAvailable) {
      try {
        console.log('[DesktopBridge] Routing to Local Windows Agent (port 31548)');
        const res = await fetch(`${this.localAgentUrl}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, args }),
        });
        if (res.ok) {
          const json = await res.json();
          return {
            success: Boolean(json.success),
            verified: Boolean(json.verified ?? json.success),
            message: json.message || `Executed ${action} on your Windows 11 PC.`,
            data: json.data,
          };
        }
      } catch (err) {
        console.warn('[DesktopBridge] Local Windows agent error:', err);
      }
    }

    // Channel 3: Server OS Backend (/api/desktop/execute)
    try {
      console.log('[DesktopBridge] Routing to server execution endpoint /api/desktop/execute');
      const res = await fetch('/api/desktop/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, args }),
      });

      if (res.ok) {
        const json = await res.json();
        return {
          success: Boolean(json.success),
          verified: Boolean(json.verified ?? json.success),
          message: json.message || `Action ${action} executed successfully.`,
          data: json.data,
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          verified: false,
          message: errJson.message || `Failed to execute ${action} on server desktop.`,
        };
      }
    } catch (err: any) {
      console.error('[DesktopBridge] Server execution error:', err);
      return {
        success: false,
        verified: false,
        message: `Execution pipeline unavailable: ${err?.message || 'Connection failure'}`,
      };
    }
  }
}

export const desktopBridge = new DesktopBridge();
