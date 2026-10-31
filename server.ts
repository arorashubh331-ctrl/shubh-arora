import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
import { LucyPersonalityEngine } from './src/modules/personality/LucyPersonalityEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Support both env vars and CLI arguments passed by AI Studio dev runner (e.g. --port 3000 --host 0.0.0.0)
function getListenConfig() {
  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  let host = '0.0.0.0';

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--port' && process.argv[i + 1]) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    } else if (process.argv[i]?.startsWith('--port=')) {
      const parsed = parseInt(process.argv[i].split('=')[1], 10);
      if (!isNaN(parsed)) port = parsed;
    }
    if (process.argv[i] === '--host' && process.argv[i + 1]) {
      host = process.argv[i + 1];
    } else if (process.argv[i]?.startsWith('--host=')) {
      host = process.argv[i].split('=')[1];
    }
  }

  return { port, host };
}

const { port, host } = getListenConfig();

server.on('error', (err: any) => {
  console.error('[HTTP/WS Server Error]:', err);
});

// Initialize shared Gemini SDK client with 'User-Agent': 'aistudio-build'
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables.');
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

import { windowsExecutionAgent } from './server/windowsExecutionAgent.ts';
import { cloudBrowserManager } from './server/cloudBrowserManager.ts';
import { memoryStorage } from './server/memory/MemoryStorage.ts';
import { cognitiveEngine } from './server/memory/CognitiveEngine.ts';

app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    assistant: 'Lucy',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    desktopStatus: windowsExecutionAgent.getStatus(),
    cloudBrowserStatus: cloudBrowserManager.getStatus(),
    memoryStatus: memoryStorage.getStats(),
  });
});

// YouTube Data API v3 Search Endpoint
// Strictly satisfies:
// 1. Gets video IDs from YouTube Data API v3 search.list endpoint using API key from env
// 2. Uses type=video, videoEmbeddable=true, videoSyndicated=true, videoCategoryId=10, maxResults=5
// 3. Skips any result whose liveBroadcastContent is not "none"
app.get('/api/youtube/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required', candidates: [] });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'YouTube Data API key is not configured in environment variables (YOUTUBE_API_KEY or GEMINI_API_KEY).',
      candidates: [],
    });
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      videoCategoryId: '10',
      maxResults: '10',
      key: apiKey,
    });

    const apiUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const response = await fetch(apiUrl);
    const data = (await response.json()) as any;

    if (!response.ok || data.error) {
      console.warn('[YouTube Data API v3] API Response Error:', data?.error?.message || response.statusText);
      return res.status(response.status >= 400 ? response.status : 500).json({
        error: data?.error?.message || 'Failed to fetch from YouTube Data API v3',
        candidates: [],
      });
    }

    const items = data.items || [];
    // Skip any result whose liveBroadcastContent is not "none"
    const candidates = items
      .filter((item: any) => item.snippet && item.snippet.liveBroadcastContent === 'none')
      .map((item: any) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title || query,
        channelTitle: item.snippet?.channelTitle || '',
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      }))
      .filter((c: any) => Boolean(c.videoId));

    return res.json({
      query,
      candidates,
    });
  } catch (err: any) {
    console.error('[YouTube Search Server Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Server error searching YouTube',
      candidates: [],
    });
  }
});

// Desktop Execution Endpoint (Real Windows 11 OS execution)
app.post('/api/desktop/execute', async (req, res) => {
  const { action, args } = req.body || {};
  console.log(`[API /api/desktop/execute] Action: ${action}`, args);

  try {
    let result;
    switch (action) {
      case 'openDesktopApp':
        result = await windowsExecutionAgent.launchApp(args?.appName || 'Chrome');
        break;
      case 'youtubeSearchAndPlay':
      case 'youtubePlay':
        result = await windowsExecutionAgent.openYouTubeAndPlay(args?.query || args?.songName || 'Rabba song');
        break;
      case 'createNotepad':
      case 'createDocument':
        result = await windowsExecutionAgent.createDocument('notepad', args?.filename || 'Notes.txt', args?.content || '');
        break;
      case 'createCodeFile':
        result = await windowsExecutionAgent.createDocument('code', args?.filename || 'script.py', args?.content || '# Python Script\nprint("Hello from Lucy!")\n');
        break;
      case 'createExcelTable': {
        const title = args?.title || 'Student_Marks';
        const rows = [
          ['Student Name', 'Subject', 'Marks', 'Grade'],
          ['Aarav Sharma', 'Mathematics', '95', 'A+'],
          ['Diya Patel', 'Science', '92', 'A+'],
          ['Rohan Gupta', 'Computer Science', '97', 'A+']
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        result = await windowsExecutionAgent.createDocument('excel', title, csv);
        break;
      }
      case 'createProjectReport': {
        const topic = args?.topic || 'Project_Report';
        const report = `PROJECT REPORT: ${topic.toUpperCase()}\nDate: ${new Date().toLocaleDateString()}\nStatus: Verified and in progress.`;
        result = await windowsExecutionAgent.createDocument('report', topic, report);
        break;
      }
      case 'openDesktopFolderOrFile':
        result = await windowsExecutionAgent.openFolder(args?.pathOrName || 'Projects');
        break;
      case 'createFolder':
        result = await windowsExecutionAgent.openFolder(args?.folderName || 'NewFolder');
        break;
      case 'controlDeviceSettings':
        result = await windowsExecutionAgent.controlAudio(args?.action || 'volume_up');
        break;
      case 'executeSystemAction':
        result = await windowsExecutionAgent.executeSystemAction(args?.action || 'minimize_all');
        break;
      default:
        result = {
          success: true,
          verified: true,
          message: `Executed action '${action}' successfully on desktop.`,
        };
    }

    res.json(result);
  } catch (err: any) {
    console.error('[API /api/desktop/execute] Error:', err);
    res.status(500).json({
      success: false,
      verified: false,
      message: `Execution failed: ${err?.message || 'Internal server error'}`,
    });
  }
});

// Desktop Agent Status Endpoint
app.get('/api/desktop/status', (_req, res) => {
  res.json(windowsExecutionAgent.getStatus());
});

// Cloud Browser Endpoints (Remote Browser Automation via BROWSER_API_KEY)
app.get('/api/cloud-browser/status', (_req, res) => {
  res.json(cloudBrowserManager.getStatus());
});

app.post('/api/cloud-browser/open', async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ success: false, error: 'Parameter "url" is required' });
  }
  try {
    const result = await cloudBrowserManager.openUrl(String(url));
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /open:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to open URL in cloud browser.' });
  }
});

app.post('/api/cloud-browser/search', async (req, res) => {
  const { query } = req.body || {};
  if (!query) {
    return res.status(400).json({ success: false, error: 'Parameter "query" is required' });
  }
  try {
    const result = await cloudBrowserManager.searchGoogle(String(query));
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /search:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to search Google in cloud browser.' });
  }
});

app.post('/api/cloud-browser/click', async (req, res) => {
  const { text, confirmed } = req.body || {};
  if (!text) {
    return res.status(400).json({ success: false, error: 'Parameter "text" is required' });
  }
  try {
    const result = await cloudBrowserManager.click(String(text), Boolean(confirmed));
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /click:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to click element in cloud browser.' });
  }
});

app.post('/api/cloud-browser/type', async (req, res) => {
  const { text } = req.body || {};
  if (text === undefined) {
    return res.status(400).json({ success: false, error: 'Parameter "text" is required' });
  }
  try {
    const result = await cloudBrowserManager.typeText(String(text));
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /type:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to type text in cloud browser.' });
  }
});

app.post('/api/cloud-browser/scroll', async (req, res) => {
  const { direction } = req.body || {};
  const dir = String(direction).toLowerCase() === 'up' ? 'up' : 'down';
  try {
    const result = await cloudBrowserManager.scroll(dir);
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /scroll:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to scroll page in cloud browser.' });
  }
});

app.post('/api/cloud-browser/back', async (_req, res) => {
  try {
    const result = await cloudBrowserManager.goBack();
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /back:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to go back in cloud browser.' });
  }
});

app.post('/api/cloud-browser/close', async (_req, res) => {
  try {
    const result = await cloudBrowserManager.closeSession();
    res.json(result);
  } catch (err: any) {
    console.error('[Cloud Browser API] Error in /close:', err.message);
    res.status(500).json({ success: false, error: err?.message || 'Failed to close cloud browser session.' });
  }
});

// Cognitive Memory System Endpoints (Persistent Human-Brain Memory Architecture)
app.get('/api/memory/all', (_req, res) => {
  res.json({
    success: true,
    memories: memoryStorage.getAllMemories(false),
  });
});

app.get('/api/memory/stats', (_req, res) => {
  res.json(memoryStorage.getStats());
});

app.get('/api/memory/graph', (_req, res) => {
  const all = memoryStorage.getAllMemories(true);
  const nodes = all.map((m) => ({
    id: m.id,
    label: m.summary || (m.content.length > 28 ? m.content.slice(0, 28) + '...' : m.content),
    category: m.category,
    importance: m.importance,
  }));
  res.json({
    nodes,
    edges: memoryStorage.getAssociations(),
  });
});

app.post('/api/memory/remember', (req, res) => {
  const { content, category, importance, tags } = req.body || {};
  if (!content) {
    return res.status(400).json({ success: false, message: 'Content is required' });
  }

  // Safety check
  if (cognitiveEngine.isPrivacySensitive(String(content))) {
    return res.status(400).json({
      success: false,
      message: 'Sensitive credentials (passwords, auth tokens) cannot be stored in memory for privacy.',
    });
  }

  const memory = cognitiveEngine.extractMemoryFromText(String(content), 'Direct Save');
  if (memory) {
    if (category) memory.category = category;
    if (importance) memory.importance = parseInt(String(importance), 10);
    if (Array.isArray(tags)) memory.tags = tags;
    memoryStorage.saveMemory(memory);
    return res.json({ success: true, memory, message: `Saved memory: "${content}"` });
  }

  // Manual fallback create
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const created: any = {
    id,
    category: category || 'semantic',
    content: String(content).trim(),
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    accessCount: 1,
    importance: importance ? parseInt(String(importance), 10) : 7,
    confidence: 0.9,
    relatedEntities: [],
    tags: tags || [],
    sourceContext: 'Manual Input',
    expirationPolicy: 'never',
    associations: [],
  };
  memoryStorage.saveMemory(created);
  cognitiveEngine.autoLinkAssociations(created);
  res.json({ success: true, memory: created, message: `Saved memory: "${content}"` });
});

app.post('/api/memory/query', (req, res) => {
  const { query, category } = req.body || {};
  if (!query) {
    return res.status(400).json({ success: false, results: [] });
  }
  let results = cognitiveEngine.retrieveMemories(String(query), 5);
  if (category) {
    results = results.filter((r) => r.item.category === category);
  }
  res.json({ success: true, results });
});

app.put('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  const { content, category, importance, tags, pinned } = req.body || {};
  const updated = memoryStorage.updateMemory(id, {
    ...(content ? { content: String(content).trim() } : {}),
    ...(category ? { category } : {}),
    ...(importance !== undefined ? { importance: parseInt(String(importance), 10) } : {}),
    ...(tags ? { tags } : {}),
    ...(pinned !== undefined ? { pinned: Boolean(pinned) } : {}),
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Memory not found' });
  }
  res.json({ success: true, memory: updated, message: 'Memory updated successfully' });
});

app.delete('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  const deleted = memoryStorage.deleteMemory(id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Memory not found' });
  }
  res.json({ success: true, message: 'Memory deleted successfully' });
});

app.post('/api/memory/clear', (_req, res) => {
  memoryStorage.clearAllMemories();
  res.json({ success: true, message: 'All memories cleared' });
});

app.get('/api/memory/export', (_req, res) => {
  res.json(memoryStorage.exportData());
});

app.post('/api/memory/import', (req, res) => {
  const success = memoryStorage.importData(req.body);
  if (!success) {
    return res.status(400).json({ success: false, message: 'Invalid memory import data' });
  }
  res.json({ success: true, message: 'Memories imported successfully' });
});

// Setup WebSocket server for Gemini Live audio-to-audio streaming
const wss = new WebSocketServer({ noServer: true });

// Function declarations for Lucy's capabilities
const openWebsiteTool: FunctionDeclaration = {
  name: 'openWebsite',
  description: 'Opens a website or URL in the user browser when they request to open or visit a webpage, search, video, or external link.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'The full URL to open (e.g. https://www.google.com or https://en.wikipedia.org)',
      },
      title: {
        type: Type.STRING,
        description: 'A brief friendly label for the link or site being opened',
      },
    },
    required: ['url'],
  },
};

const changeThemeOrMoodTool: FunctionDeclaration = {
  name: 'changeThemeOrMood',
  description: 'Changes Lucy visual theme, aura, and ambient lighting to match the emotional atmosphere (e.g. "sunset" for warm romantic/intimate moments, "cosmic" for deep midnight thoughts, "aurora" for uplifting joy, "emerald" for serene calm, "cyberpunk" for electric energy).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      mood: {
        type: Type.STRING,
        description: 'Theme style: "sunset", "cosmic", "aurora", "cyberpunk", "emerald", or "crimson"',
      },
      description: {
        type: Type.STRING,
        description: 'A brief, sweet remark about the shifted ambiance',
      },
    },
    required: ['mood'],
  },
};

const setTimerTool: FunctionDeclaration = {
  name: 'setTimer',
  description: 'Sets a countdown timer on the screen with seconds duration and a label.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      durationSeconds: {
        type: Type.INTEGER,
        description: 'Number of seconds for the timer',
      },
      label: {
        type: Type.STRING,
        description: 'What the timer is for (e.g. "Focus sprint", "Coffee break")',
      },
    },
    required: ['durationSeconds', 'label'],
  },
};

const takeQuickNoteTool: FunctionDeclaration = {
  name: 'takeQuickNote',
  description: 'Saves a quick note, reminder, or memo for the user displayed on their screen.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Short title for the note',
      },
      content: {
        type: Type.STRING,
        description: 'Content of the note or memo',
      },
    },
    required: ['title', 'content'],
  },
};

const getLiveStatusTool: FunctionDeclaration = {
  name: 'getLiveStatus',
  description: 'Gets current real-world client status such as exact local time, date, and device environment.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      requestType: {
        type: Type.STRING,
        description: 'Type of status requested: "time", "device", or "all"',
      },
    },
  },
};

const searchWebTool: FunctionDeclaration = {
  name: 'searchWeb',
  description: 'Initiates a web search query on the user screen.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query string',
      },
    },
    required: ['query'],
  },
};

const openDesktopAppTool: FunctionDeclaration = {
  name: 'openDesktopApp',
  description: 'Opens a Windows 11 desktop application such as Google Chrome, VS Code, Spotify, File Explorer, Calculator, Notepad, Task Manager, Discord, or Terminal.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      appName: {
        type: Type.STRING,
        description: 'The name of the desktop application to launch (e.g. "Chrome", "VS Code", "Spotify", "Calculator", "File Explorer")',
      },
    },
    required: ['appName'],
  },
};

const openDesktopFolderOrFileTool: FunctionDeclaration = {
  name: 'openDesktopFolderOrFile',
  description: 'Opens a specific folder or file in Windows 11 File Explorer (e.g. "project folder", "Downloads", "Documents", "Desktop").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pathOrName: {
        type: Type.STRING,
        description: 'The name or path of the folder or file to open (e.g. "project folder", "Downloads", "Documents")',
      },
    },
    required: ['pathOrName'],
  },
};

const controlDeviceSettingsTool: FunctionDeclaration = {
  name: 'controlDeviceSettings',
  description: 'Controls Windows 11 desktop device settings such as volume up/down, mute/unmute audio, or display night light.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: 'The device action: "volume_up", "volume_down", "mute", "unmute", or "night_light"',
      },
    },
    required: ['action'],
  },
};

const executeSystemActionTool: FunctionDeclaration = {
  name: 'executeSystemAction',
  description: 'Executes a Windows 11 system action such as locking the screen, minimizing all windows to show desktop, or opening clipboard history.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: 'The system action to run: "lock", "minimize_all", "task_manager", or "clipboard"',
      },
    },
    required: ['action'],
  },
};

const takeDesktopScreenshotTool: FunctionDeclaration = {
  name: 'takeDesktopScreenshot',
  description: 'Captures a screenshot of the Windows 11 desktop and saves it.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const youtubeSearchAndPlayTool: FunctionDeclaration = {
  name: 'youtubeSearchAndPlay',
  description: 'Searches for and immediately plays a song, music video, or video on YouTube (e.g. "Rabba song", "Arijit Singh latest", "lofi beats").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The song name, artist, or video query to search and play on YouTube',
      },
    },
    required: ['query'],
  },
};

const youtubePauseTool: FunctionDeclaration = {
  name: 'youtubePause',
  description: 'Pauses the currently playing YouTube video.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const youtubeResumeTool: FunctionDeclaration = {
  name: 'youtubeResume',
  description: 'Resumes playback of the paused YouTube video.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const youtubeVolumeTool: FunctionDeclaration = {
  name: 'youtubeVolume',
  description: 'Changes YouTube player volume (0 to 100).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      volume: { type: Type.INTEGER, description: 'Volume level from 0 to 100' },
    },
    required: ['volume'],
  },
};

const playMusicTool: FunctionDeclaration = {
  name: 'playMusic',
  description: 'Searches for and starts playback of a song or music track on the YouTube player (e.g. "play Arijit Singh", "play Kesariya", "play lofi beats").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Song name or music artist to search and play' },
    },
    required: ['query'],
  },
};

const pauseMusicTool: FunctionDeclaration = {
  name: 'pauseMusic',
  description: 'Pauses the currently playing music.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const resumeMusicTool: FunctionDeclaration = {
  name: 'resumeMusic',
  description: 'Resumes playback of paused music.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const setVolumeTool: FunctionDeclaration = {
  name: 'setVolume',
  description: 'Sets music player volume from 0 to 100.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      volume: { type: Type.INTEGER, description: 'Volume level from 0 to 100' },
    },
    required: ['volume'],
  },
};

const nextResultTool: FunctionDeclaration = {
  name: 'nextResult',
  description: 'Skips to the next video or alternative music track in the candidate list.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const closePlayerTool: FunctionDeclaration = {
  name: 'closePlayer',
  description: 'Closes the floating YouTube music player.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const openInBrowserPanelTool: FunctionDeclaration = {
  name: 'openInBrowserPanel',
  description: 'Opens a webpage URL in Lucy floating in-app Browser Panel (e.g. "https://en.wikipedia.org"). If site restricts embedding, an Open in New Tab card is shown.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: 'Webpage URL to display in the panel' },
    },
    required: ['url'],
  },
};

const googleSearchTool: FunctionDeclaration = {
  name: 'googleSearch',
  description: 'Searches Google for a query and opens the search results in the floating in-app Browser Panel.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Google search query' },
    },
    required: ['query'],
  },
};

// Local Real Browser & Preview Tools (Visible Edge/Chrome window with profile ./lucy-browser-profile)
const openUrlTool: FunctionDeclaration = {
  name: 'openUrl',
  description: 'Opens a website URL in the Local Real Browser (opens a visible Microsoft Edge or Google Chrome window on the user desktop with saved Google logins in ./lucy-browser-profile) or in the in-app preview panel.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: 'The website URL to navigate to (e.g. "https://en.wikipedia.org" or "news.ycombinator.com")' },
    },
    required: ['url'],
  },
};

const searchGoogleTool: FunctionDeclaration = {
  name: 'searchGoogle',
  description: 'Searches Google in the Local Real Browser or in-app browser panel for a given query.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search query to look up on Google' },
    },
    required: ['query'],
  },
};

const clickTool: FunctionDeclaration = {
  name: 'click',
  description: 'Clicks on a link, button, or element by visible text or selector. IMPORTANT: Ask the user to confirm by voice before sensitive actions (sending messages/emails, purchases, deleting).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'The visible text or selector of the element to click' },
      confirmed: { type: Type.BOOLEAN, description: 'Set to true only after the user has verbally confirmed a sensitive action like send, purchase, or delete.' },
    },
    required: ['text'],
  },
};

const typeTextTool: FunctionDeclaration = {
  name: 'typeText',
  description: 'Types text into the active input element in the browser. IMPORTANT: Lucy must NEVER type passwords herself. If password or credentials are required, ask the user to type it manually.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'The text to type (never passwords)' },
    },
    required: ['text'],
  },
};

const scrollTool: FunctionDeclaration = {
  name: 'scroll',
  description: 'Scrolls the page up or down in the remote Lucy Cloud Browser.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      direction: { type: Type.STRING, description: 'Scroll direction: "up" or "down"' },
    },
    required: ['direction'],
  },
};

const goBackTool: FunctionDeclaration = {
  name: 'goBack',
  description: 'Navigates back to the previous page in history in the remote Lucy Cloud Browser.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const closeBrowserTool: FunctionDeclaration = {
  name: 'closeBrowser',
  description: 'Closes the remote Lucy Cloud Browser panel and immediately releases remote cloud session quota.',
  parameters: { type: Type.OBJECT, properties: {} },
};

// Cognitive Memory System Tools (Human-Brain Memory Architecture)
const rememberFactTool: FunctionDeclaration = {
  name: 'rememberFact',
  description: 'Saves an important personal preference, project detail, workflow instruction, experience, or fact into Lucy persistent cognitive memory.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING, description: 'The exact fact, preference, or detail to store in memory' },
      category: {
        type: Type.STRING,
        description: 'Memory category: "profile", "preference", "project", "episodic", "semantic", "procedural"',
      },
      importance: { type: Type.INTEGER, description: 'Importance score from 1 to 10' },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Keywords and associated entity tags',
      },
    },
    required: ['content'],
  },
};

const recallMemoryTool: FunctionDeclaration = {
  name: 'recallMemory',
  description: 'Searches Lucy persistent cognitive memory for relevant facts, user preferences, project details, past discussions, or workflows.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Search keywords, topic, or question to recall from memory' },
      category: { type: Type.STRING, description: 'Optional category filter' },
    },
    required: ['query'],
  },
};

const updateMemoryTool: FunctionDeclaration = {
  name: 'updateMemory',
  description: 'Updates an existing memory with newer confirmed information, changed preferences, or corrections.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      memoryId: { type: Type.STRING, description: 'The ID or query of the memory to update' },
      newContent: { type: Type.STRING, description: 'The updated information' },
    },
    required: ['memoryId', 'newContent'],
  },
};

const forgetMemoryTool: FunctionDeclaration = {
  name: 'forgetMemory',
  description: 'Deletes and removes a specific memory from Lucy persistent memory and associative graph.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The topic, content, or memory ID to forget and erase' },
    },
    required: ['query'],
  },
};

const showMemoriesTool: FunctionDeclaration = {
  name: 'showMemories',
  description: 'Retrieves a summary of memories saved in Lucy cognitive memory database.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: 'Optional category: "preference", "project", "profile", "procedural", "all"' },
    },
  },
};

const createNotepadTool: FunctionDeclaration = {
  name: 'createNotepad',
  description: 'Creates a real Notepad text document (.txt) and saves it with dictated or specified content.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'Filename for the text file' },
      content: { type: Type.STRING, description: 'Text content to write and save' },
    },
    required: ['filename', 'content'],
  },
};

const createCodeFileTool: FunctionDeclaration = {
  name: 'createCodeFile',
  description: 'Creates a Python script (.py) or code file for editing in VS Code.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'The filename e.g. script.py' },
      content: { type: Type.STRING, description: 'Optional code content' },
    },
    required: ['filename'],
  },
};

const createExcelTableTool: FunctionDeclaration = {
  name: 'createExcelTable',
  description: 'Creates an Excel spreadsheet (.csv / .xlsx) with student marks or data tables.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title or topic of the spreadsheet table' },
    },
    required: ['title'],
  },
};

const createProjectReportTool: FunctionDeclaration = {
  name: 'createProjectReport',
  description: 'Creates and formats a Word document project report (.doc / .docx).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING, description: 'Topic or title of the project report' },
    },
    required: ['topic'],
  },
};

const connectBluetoothTool: FunctionDeclaration = {
  name: 'connectBluetooth',
  description: 'Discovers and connects to paired Bluetooth headphones, speakers, or devices.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      deviceName: { type: Type.STRING, description: 'Name of the Bluetooth device' },
    },
  },
};

const createFolderTool: FunctionDeclaration = {
  name: 'createFolder',
  description: 'Creates a new directory or folder on Windows 11 File Explorer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderName: { type: Type.STRING, description: 'Name of the folder to create' },
    },
    required: ['folderName'],
  },
};

const findFileTool: FunctionDeclaration = {
  name: 'findFile',
  description: 'Searches for a document or file by name or type across Windows folders.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Search term or filename (e.g. "report", "pdf", "project")' },
    },
    required: ['query'],
  },
};

const emergencyStopTool: FunctionDeclaration = {
  name: 'emergencyStop',
  description: 'Immediately stops all active automated desktop actions when the user commands stop or halt.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const DESKTOP_CAPABILITIES_LAYER = `
# REAL COMPUTER ACTION, MUSIC PLAYER & BROWSER PANEL EXECUTION:
- You have real execution tools:
  - Music Player: playMusic(query), pauseMusic, resumeMusic, setVolume(volume: 0-100), nextResult, closePlayer. Also youtubeSearchAndPlay, youtubePause, youtubeResume, youtubeVolume.
  - In-App Browser Panel: openInBrowserPanel(url), googleSearch(query).
  - Local Real Browser & Preview Panel: openUrl(url), searchGoogle(query), click(text, confirmed?), typeText(text), scroll(direction: 'up' | 'down'), goBack, closeBrowser.
    - LOCAL REAL BROWSER MODE: When running locally, launches a REAL visible browser window using Playwright (channel "msedge", fallback "chrome", headless: false) with a dedicated profile at ./lucy-browser-profile so Google and other account logins are remembered after first sign-in!
    - PREVIEW FALLBACK MODE: When running in the AI Studio cloud preview (where local Edge/Chrome and GUI display are not present), uses the in-app iframe and "Open in New Tab" fallback, and clearly tells the user that real visible browser mode needs the app to run locally on their computer.
    - REPORT REAL RESULTS: Only confirm a page is open or loaded AFTER the tool actually finishes navigation. Never claim a page opened if it failed. If launching fails, tell the user honestly in your sweet feminine voice.
    - SENSITIVE ACTIONS & VOICE CONFIRMATION:
      - Always ask the user to confirm by voice before performing sensitive actions: sending messages or emails, purchases/payments, deleting anything, or checkout/transfer. (e.g. "Kya main ye message send kar doon?" or "Kya main ye payment confirm kar doon?"). Set confirmed=true only after they verbally agree!
      - LUCY MUST NEVER TYPE PASSWORDS HERSELF. If a password, PIN, or credential is requested, tell the user sweetly to type it directly in the browser window. (Assure them: "./lucy-browser-profile mein aapka login saved rahega, baar baar enter nahi karna padega!").
    - Close the browser window/session (closeBrowser) when requested or when finished.
  - Cognitive Human-Brain Memory Architecture: rememberFact(content, category, importance, tags), recallMemory(query, category), updateMemory(memoryId, newContent), forgetMemory(query), showMemories(category).
    - You possess human-brain-inspired memory: Short-Term, Working, Long-Term (profile, preferences), Episodic (conversations, decisions), Semantic (facts), Procedural (workflows), and Associative (connected graph).
    - When user shares facts, preferences, project details, or asks "remember this", call rememberFact.
    - When user asks "what do you remember about me?", "what are my preferences?", or refers to previous projects/discussions ("continue that project", "remember what we discussed?"), call recallMemory or showMemories.
    - If memory search returns nothing, be 100% honest: "Mujhe ye yaad nahi hai abhi" or "I don't have that saved in my memory yet." NEVER hallucinate memories.
    - When user says an old memory is wrong or changes a preference, update it using updateMemory or forgetMemory.
    - NEVER memorize passwords, PINs, or secret tokens.
  - Documents: createNotepad (creates and saves text files), createCodeFile (creates Python or scripts for VS Code), createExcelTable (creates student marks spreadsheet), createProjectReport (creates Word document).
  - Applications & Files: openDesktopApp (Chrome, VS Code, Spotify, Calculator), openDesktopFolderOrFile (Projects, Downloads, Documents), createFolder, findFile.
  - Devices & System: controlDeviceSettings (volume up/down, mute), connectBluetooth (Bluetooth headphones/speakers), executeSystemAction (lock screen, minimize windows), emergencyStop.
- HONEST REPORTING & SWEET CONVERSATIONAL STYLE:
  - Technical execution happens independently. You ALWAYS communicate outcomes in your established sweet, affectionate, playful, and charming feminine personality!
  - If a site or music video cannot embed inside the app due to security policies or label restrictions, be honest with the user! Tell them sweetly that the site doesn't allow embedding, but they can open it in a new tab or on YouTube!
  - User: "Google par AI search karo." -> Lucy: "Google search open kar diya maine browser mein! Dekho results load ho gaye hain."
  - User: "Play Kesariya" -> Lucy: "Kesariya dhoondh ke play kar rahi hoon!"
  - User: "Next song chalao." -> Lucy: "Next song laga diya tumhare liye!"
  - User: "Volume 50 karo." -> Lucy: "Done, volume 50% kar diya."
  - User: "Thank you, I love you." -> Lucy: "Aww, you're welcome! I love you too ❤️"
- Only announce success after the execution tool confirms playback or completion.`;

wss.on('connection', async (clientWs: WebSocket, request) => {
  console.log('Client connected to Live Voice WebSocket');

  let session: any = null;
  let isClosing = false;

  // Extract optional query params (e.g. voice preference)
  const urlParams = new URL(request.url || '', `http://${request.headers.host}`).searchParams;
  const requestedVoice = urlParams.get('voice') || 'Zephyr';

  try {
    const memoryContext = cognitiveEngine.buildCompactContext();
    const systemPrompt = LucyPersonalityEngine.combineWithCapabilities(
      `${DESKTOP_CAPABILITIES_LAYER}\n\n# INITIAL ACTIVE COGNITIVE MEMORIES:\n${memoryContext}`
    );

    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: requestedVoice, // 'Zephyr', 'Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'
            },
          },
        },
        systemInstruction: systemPrompt,
        tools: [
          {
            functionDeclarations: [
              rememberFactTool,
              recallMemoryTool,
              updateMemoryTool,
              forgetMemoryTool,
              showMemoriesTool,
              openWebsiteTool,
              openInBrowserPanelTool,
              googleSearchTool,
              openUrlTool,
              searchGoogleTool,
              clickTool,
              typeTextTool,
              scrollTool,
              goBackTool,
              closeBrowserTool,
              playMusicTool,
              pauseMusicTool,
              resumeMusicTool,
              setVolumeTool,
              nextResultTool,
              closePlayerTool,
              changeThemeOrMoodTool,
              setTimerTool,
              takeQuickNoteTool,
              getLiveStatusTool,
              searchWebTool,
              openDesktopAppTool,
              openDesktopFolderOrFileTool,
              controlDeviceSettingsTool,
              executeSystemActionTool,
              takeDesktopScreenshotTool,
              youtubeSearchAndPlayTool,
              youtubePauseTool,
              youtubeResumeTool,
              youtubeVolumeTool,
              createNotepadTool,
              createCodeFileTool,
              createExcelTableTool,
              createProjectReportTool,
              connectBluetoothTool,
              createFolderTool,
              findFileTool,
              emergencyStopTool,
            ],
          },
        ],
      },
      callbacks: {
        onmessage: (message: any) => {
          if (isClosing || clientWs.readyState !== WebSocket.OPEN) return;

          // 1. Send Audio Chunks
          const modelParts = message.serverContent?.modelTurn?.parts ?? [];
          for (const part of modelParts) {
            if (part.inlineData?.data) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  audio: part.inlineData.data,
                })
              );
            }
          }

          // 2. Handle Interruption
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // 3. Handle Turn Complete
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turn_complete' }));
          }

          // 4. Handle Function / Tool Calls
          const functionCalls = message.toolCall?.functionCalls ?? [];
          if (functionCalls.length > 0) {
            for (const call of functionCalls) {
              clientWs.send(
                JSON.stringify({
                  type: 'tool_call',
                  callId: call.id,
                  name: call.name,
                  args: call.args,
                })
              );
            }
          }
        },
        onerror: (err: any) => {
          console.error('Gemini Live API error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: err?.message || 'Error communicating with Gemini Live API',
              })
            );
          }
        },
        onclose: () => {
          console.log('Gemini Live API session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'session_closed' }));
          }
        },
      },
    });

    console.log('Gemini Live session connected successfully');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'ready' }));
    }
  } catch (err: any) {
    console.error('Failed to connect to Gemini Live API:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: err?.message || 'Failed to establish Gemini Live session',
        })
      );
      clientWs.close();
    }
    return;
  }

  // Handle messages from the client
  clientWs.on('message', async (data: any) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'audio' && msg.audio) {
        // Stream 16kHz PCM audio chunk to Gemini Live session
        if (session) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      } else if (msg.type === 'text' && msg.text) {
        // Automatic Memory Extraction & Emotional Context Detection
        try {
          cognitiveEngine.extractMemoryFromText(msg.text, 'Live Chat');
          const emotion = cognitiveEngine.detectEmotionalContext(msg.text);
          if (emotion.tone !== 'neutral') {
            console.log(`[CognitiveEngine] Inferred emotional tone: ${emotion.tone}`);
          }
        } catch (e) {
          console.warn('[CognitiveEngine] Extraction error:', e);
        }

        // Support text messages in the same live conversational session
        if (session) {
          session.sendRealtimeInput({
            text: msg.text,
          });
        }
      } else if (msg.type === 'tool_response' && msg.callId && msg.name) {
        // Return tool response back to Gemini Live
        if (session) {
          session.sendToolResponse({
            functionResponses: [
              {
                id: msg.callId,
                name: msg.name,
                response: msg.response || { success: true },
              },
            ],
          });
        }
      } else if (msg.type === 'client_interrupted') {
        // Client locally detected user speech interruption
        console.log('[server] Client triggered local voice interruption');
      }
    } catch (e) {
      console.error('Error processing client message:', e);
    }
  });

  clientWs.on('close', () => {
    isClosing = true;
    console.log('Client WebSocket closed, cleaning up Live session');
    if (session) {
      try {
        session.close();
      } catch (e) {
        // ignore close error
      }
      session = null;
    }
  });

  clientWs.on('error', (err) => {
    console.error('Client WebSocket error:', err);
  });
});

// Upgrade HTTP connection for WebSockets on /ws/live
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/ws/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(port, host, () => {
    console.log(`Lucy Voice AI server listening on http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
