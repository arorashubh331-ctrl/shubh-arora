/**
 * DesktopActionEngine - UNIFIED REAL DESKTOP EXECUTION ENGINE
 * 
 * Orchestrates all real Windows 11 desktop, application, browser, YouTube, and file operations.
 * GUARANTEE: This engine operates independently from Lucy's Personality and Voice engines.
 * Results are returned to Lucy's live session so she announces outcomes in her established
 * sweet, affectionate, and playful Hinglish personality.
 */

import { youtubeController } from './YouTubeController';
import { documentManager } from './DocumentManager';
import { browserAutomation } from './BrowserAutomation';
import { applicationController } from './ApplicationController';
import { windowsUIAutomation } from './WindowsUIAutomation';
import { fileSystemManager } from './FileSystemManager';
import { deviceController } from './DeviceController';
import { actionVerifier, permissionManager } from './ActionPlanner';
import { desktopBridge } from './DesktopBridge';
import { conversationMemory } from '../personality/ConversationMemory';
import { browserPanelController } from './BrowserPanelController';
import { cloudBrowserController } from './CloudBrowserController';

export interface ExecutionEvent {
  id: string;
  category: 'youtube' | 'browser' | 'document' | 'app' | 'system' | 'file' | 'device';
  title: string;
  details: string;
  timestamp: number;
  verified: boolean;
}

export class DesktopActionEngine {
  private onExecutionEventCallback: ((event: ExecutionEvent) => void) | null = null;

  constructor() {}

  public setOnExecutionEvent(cb: (event: ExecutionEvent) => void) {
    this.onExecutionEventCallback = cb;
  }

  /**
   * Universal Execution Router
   */
  public async execute(toolName: string, args: Record<string, any>): Promise<{
    success: boolean;
    message: string;
    verified: boolean;
    data?: any;
    videoTitle?: string;
    videoId?: string;
    filename?: string;
    path?: string;
    fullPath?: string;
    [key: string]: any;
  }> {
    if (permissionManager.isStopped()) {
      return {
        success: false,
        message: 'Operations are paused due to an Emergency Stop command.',
        verified: false,
      };
    }

    console.log(`[DesktopActionEngine] Executing real tool: ${toolName}`, args);

    switch (toolName) {
      // 1. MUSIC & YOUTUBE PLAYER CONTROL
      case 'playMusic':
      case 'youtubePlay':
      case 'youtubeSearchAndPlay': {
        const query = String(args.query || args.songName || args.song || 'Rabba song').trim();
        const localRes = await youtubeController.searchAndPlay(query);

        // Requirement 5: Do NOT emit success toast here. Success toast is emitted ONLY after player confirms playback started.
        // Requirement 4: If embedding failed, report honestly to Lucy so she can inform the user without claiming the song is playing.
        if (localRes.embeddingFailed) {
          return {
            success: false,
            verified: false,
            embeddingFailed: true,
            openUrl: localRes.openUrl,
            message: `This song cannot be played inside the app, but I can open it on YouTube.`,
          };
        }

        return {
          success: localRes.success,
          message: localRes.message,
          videoTitle: localRes.videoTitle,
          videoId: localRes.videoId,
          verified: localRes.verified,
        };
      }

      case 'pauseMusic':
      case 'youtubePause': {
        const res = await youtubeController.pauseVideo();
        this.emitEvent('youtube', 'Music Paused', res.message, res.verified);
        return res;
      }

      case 'resumeMusic':
      case 'youtubeResume': {
        const res = await youtubeController.resumeVideo();
        this.emitEvent('youtube', 'Music Resumed', res.message, res.verified);
        return res;
      }

      case 'setVolume':
      case 'youtubeVolume': {
        const vol = parseInt(String(args.volume ?? 80), 10);
        const res = await youtubeController.setVolume(vol);
        this.emitEvent('youtube', `Volume Set: ${vol}%`, res.message, res.verified);
        return res;
      }

      case 'nextResult': {
        const res = await youtubeController.nextResult();
        this.emitEvent('youtube', 'Next Track', res.message, res.verified);
        return res;
      }

      case 'closePlayer': {
        const res = await youtubeController.closePlayerAsync();
        this.emitEvent('youtube', 'Player Closed', res.message, res.verified);
        return res;
      }

      // 2. IN-APP FLOATING BROWSER PANEL
      case 'openInBrowserPanel': {
        const url = String(args.url || 'https://en.wikipedia.org').trim();
        const res = await browserPanelController.openUrl(url);
        this.emitEvent('browser', 'Browser Panel', res.message, res.verified);
        return res;
      }

      case 'googleSearch': {
        const query = String(args.query || 'latest news').trim();
        const res = await browserPanelController.googleSearch(query);
        this.emitEvent('browser', `Google Search: ${query}`, res.message, res.verified);
        return res;
      }

      // 3. LUCY CLOUD BROWSER (REMOTE SESSION LIVE VIEW & AUTOMATION)
      case 'openUrl': {
        const url = String(args.url || args.targetUrl || 'https://google.com').trim();
        const res = await cloudBrowserController.openUrl(url);
        this.emitEvent('browser', `Cloud Browser: ${url}`, res.message, res.verified);
        return res;
      }

      case 'searchGoogle': {
        const query = String(args.query || 'latest AI news').trim();
        const res = await cloudBrowserController.searchGoogle(query);
        this.emitEvent('browser', `Google Search: ${query}`, res.message, res.verified);
        return res;
      }

      case 'click': {
        const text = String(args.text || args.selector || args.label || '').trim();
        const res = await cloudBrowserController.click(text, Boolean(args.confirmed));
        this.emitEvent('browser', `Click: "${text}"`, res.message, res.verified);
        return res;
      }

      case 'typeText': {
        const text = String(args.text || '').trim();
        const res = await cloudBrowserController.typeText(text);
        this.emitEvent('browser', `Typed: "${text}"`, res.message, res.verified);
        return res;
      }

      case 'scroll': {
        const direction = String(args.direction || 'down').toLowerCase() === 'up' ? 'up' : 'down';
        const res = await cloudBrowserController.scroll(direction);
        this.emitEvent('browser', `Scrolled ${direction}`, res.message, res.verified);
        return res;
      }

      case 'goBack': {
        const res = await cloudBrowserController.goBack();
        this.emitEvent('browser', 'Navigated Back', res.message, res.verified);
        return res;
      }

      case 'closeBrowser': {
        const res = await cloudBrowserController.closeBrowser();
        this.emitEvent('browser', 'Closed Cloud Browser', res.message, res.verified);
        return res;
      }

      // 2. REAL DOCUMENT CREATION & DICTATION ON COMPUTER DISK
      case 'createNotepad':
      case 'createDocument': {
        const filename = String(args.filename || 'Notes.txt').trim();
        const content = String(args.content || args.text || '').trim();
        
        // Real OS file write & application launch via DesktopBridge
        const bridgeRes = await desktopBridge.execute('createNotepad', { filename, content });
        // In-app document management & download
        const localRes = await documentManager.createNotepadFile(filename, content);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('document', `Created File: ${filename}`, msg, verified);
        return {
          success: true,
          message: msg,
          filename: localRes.filename,
          verified,
        };
      }

      case 'createCodeFile': {
        const filename = String(args.filename || 'script.py').trim();
        const content = args.content ? String(args.content) : '# Python Script\nprint("Created by Lucy")\n';
        
        const bridgeRes = await desktopBridge.execute('createCodeFile', { filename, content });
        const localRes = await documentManager.createCodeFile(filename, content);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('document', `Created Code: ${filename}`, msg, verified);
        return {
          success: true,
          message: msg,
          filename: localRes.filename,
          verified,
        };
      }

      case 'createExcelTable': {
        const title = String(args.title || 'Student_Marks').trim();
        const bridgeRes = await desktopBridge.execute('createExcelTable', { title, dataRows: args.dataRows });
        const localRes = await documentManager.createExcelTable(title, args.dataRows);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('document', `Created Excel: ${title}`, msg, verified);
        return {
          success: true,
          message: msg,
          filename: localRes.filename,
          verified,
        };
      }

      case 'createProjectReport': {
        const topic = String(args.topic || 'Project_Status').trim();
        const bridgeRes = await desktopBridge.execute('createProjectReport', { topic, body: args.body });
        const localRes = await documentManager.createProjectReport(topic, args.body);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('document', `Created Report: ${topic}`, msg, verified);
        return {
          success: true,
          message: msg,
          filename: localRes.filename,
          verified,
        };
      }

      // 3. APPLICATION LAUNCHING & SWITCHING (VISIBLE WINDOW ON OS)
      case 'openDesktopApp': {
        const appName = String(args.appName || 'Chrome').trim();
        const bridgeRes = await desktopBridge.execute('openDesktopApp', { appName });

        if (bridgeRes.verified) {
          this.emitEvent('app', `Launched: ${appName}`, bridgeRes.message, true);
          return {
            success: true,
            verified: true,
            message: bridgeRes.message,
            data: bridgeRes.data,
          };
        } else {
          // Fallback through local applicationController
          const localRes = await applicationController.launchApp(appName);
          this.emitEvent('app', `Launched: ${localRes.appName}`, localRes.message, localRes.verified);
          return localRes;
        }
      }

      // 4. BROWSER AUTOMATION
      case 'browserNavigate':
      case 'searchWeb': {
        const query = String(args.query || args.url || '').trim();
        const res = await browserAutomation.openOrSearch(query);
        this.emitEvent('browser', `Browser: ${query}`, res.url, res.verified);
        return res;
      }

      // 5. FILE & FOLDER OPERATIONS (REAL FILE EXPLORER)
      case 'openDesktopFolderOrFile': {
        const path = String(args.pathOrName || 'Projects').trim();
        const bridgeRes = await desktopBridge.execute('openDesktopFolderOrFile', { pathOrName: path });
        const localRes = await fileSystemManager.openPath(path);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('file', `Explorer: ${path}`, msg, verified);
        return {
          success: true,
          message: msg,
          verified,
          path: localRes.path,
        };
      }

      case 'createFolder': {
        const folderName = String(args.folderName || 'NewFolder').trim();
        const bridgeRes = await desktopBridge.execute('createFolder', { folderName, parentPath: args.parentPath });
        const localRes = await fileSystemManager.createFolder(folderName, args.parentPath);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('file', `Created Folder: ${folderName}`, msg, verified);
        return {
          success: true,
          message: msg,
          fullPath: localRes.fullPath,
          verified,
        };
      }

      case 'findFile': {
        const query = String(args.query || 'report').trim();
        const res = await fileSystemManager.findFile(query);
        this.emitEvent('file', `Search Files: ${query}`, res.message, res.verified);
        return res;
      }

      // 6. CONNECTED DEVICES & AUDIO
      case 'controlDeviceSettings': {
        const action = String(args.action || 'volume_up').trim();
        const bridgeRes = await desktopBridge.execute('controlDeviceSettings', { action, value: args.value });
        const localRes = await deviceController.controlAudio(action as any, args.value);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('device', `Device Audio: ${action}`, msg, verified);
        return {
          success: true,
          message: msg,
          verified,
        };
      }

      case 'connectBluetooth': {
        const res = await deviceController.connectBluetooth(args.deviceName);
        this.emitEvent('device', `Bluetooth Connected: ${res.device}`, res.message, res.verified);
        return res;
      }

      // 7. WINDOWS UI AUTOMATION
      case 'executeSystemAction': {
        const action = String(args.action || 'minimize_all').trim();
        const bridgeRes = await desktopBridge.execute('executeSystemAction', { action });
        const localRes = await windowsUIAutomation.executeUIAction(action);

        const verified = bridgeRes.verified || localRes.verified;
        const msg = bridgeRes.message || localRes.message;
        this.emitEvent('system', `Windows 11: ${action}`, msg, verified);
        return {
          success: true,
          message: msg,
          verified,
        };
      }

      // 8. EMERGENCY STOP
      case 'emergencyStop': {
        permissionManager.triggerEmergencyStop();
        this.emitEvent('system', 'Emergency Stop', 'All automated desktop actions paused', true);
        return {
          success: true,
          message: 'Emergency stop activated. All active computer actions have been halted.',
          verified: true,
        };
      }

      default:
        return {
          success: false,
          message: `Tool ${toolName} not handled by DesktopActionEngine.`,
          verified: false,
        };
    }
  }

  private emitEvent(
    category: ExecutionEvent['category'],
    title: string,
    details: string,
    verified: boolean
  ) {
    conversationMemory.recordAction(category, `${title}: ${details}`, title, verified);
    this.onExecutionEventCallback?.({
      id: `exec-${Date.now()}`,
      category,
      title,
      details,
      timestamp: Date.now(),
      verified,
    });
  }
}

export const desktopActionEngine = new DesktopActionEngine();
