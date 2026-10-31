/**
 * CognitiveMemoryManager - Client-side interface to Lucy's Cognitive Memory Architecture
 * 
 * Handles client-side working memory caching, real-time UI synchronization,
 * API proxy calls to the persistent memory store, and natural-language memory tool actions.
 */

import {
  MemoryItem,
  MemoryCategory,
  WorkingMemoryState,
  CognitiveGraphData,
  MemoryStats,
  EmotionalContext,
} from '../../types/memory';

export class CognitiveMemoryManager {
  private memories: MemoryItem[] = [];
  private workingMemory: WorkingMemoryState = {
    currentTask: null,
    activeProject: null,
    recentTopics: [],
    unresolvedQuestions: [],
    recentDecisions: [],
    activeEntities: [],
    lastInteractionTimestamp: Date.now(),
  };

  private currentEmotion: EmotionalContext = {
    tone: 'neutral',
    intensity: 0.3,
    cue: 'Normal conversational baseline',
    timestamp: Date.now(),
  };

  private onMemoriesUpdatedCallback: ((memories: MemoryItem[]) => void) | null = null;
  private onEmotionChangeCallback: ((emotion: EmotionalContext) => void) | null = null;

  constructor() {
    this.refreshMemories();
  }

  public setOnMemoriesUpdated(cb: (memories: MemoryItem[]) => void) {
    this.onMemoriesUpdatedCallback = cb;
  }

  public setOnEmotionChange(cb: (emotion: EmotionalContext) => void) {
    this.onEmotionChangeCallback = cb;
  }

  public getMemories(): MemoryItem[] {
    return [...this.memories];
  }

  public getWorkingMemory(): WorkingMemoryState {
    return { ...this.workingMemory };
  }

  public getCurrentEmotion(): EmotionalContext {
    return { ...this.currentEmotion };
  }

  /**
   * Refreshes memories from the persistent backend store
   */
  public async refreshMemories(): Promise<MemoryItem[]> {
    try {
      const res = await fetch('/api/memory/all');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.memories)) {
          this.memories = data.memories;
          this.onMemoriesUpdatedCallback?.(this.memories);
          return this.memories;
        }
      }
    } catch (err) {
      console.warn('[CognitiveMemoryManager] Error fetching memories:', err);
    }
    return this.memories;
  }

  /**
   * Natural Language / Voice Tool: Remember a Fact or Preference
   */
  public async rememberFact(
    content: string,
    category: MemoryCategory = 'semantic',
    importance: number = 7,
    tags: string[] = []
  ): Promise<{ success: boolean; memoryId?: string; message: string }> {
    try {
      const res = await fetch('/api/memory/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category, importance, tags }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await this.refreshMemories();
        return {
          success: true,
          memoryId: data.memory?.id,
          message: data.message || `Saved to memory: "${content}"`,
        };
      }
      return { success: false, message: data.message || 'Failed to save memory.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error saving memory.' };
    }
  }

  /**
   * Natural Language / Voice Tool: Recall Memory by query or category
   */
  public async recallMemory(
    query: string,
    category?: MemoryCategory
  ): Promise<{ success: boolean; results: MemoryItem[]; message: string }> {
    try {
      const res = await fetch('/api/memory/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, category }),
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.results)) {
        const items = data.results.map((r: any) => r.item || r);
        if (items.length > 0) {
          const topSummary = items.map((i: MemoryItem) => `"${i.content}"`).join('; ');
          return {
            success: true,
            results: items,
            message: `Found memory: ${topSummary}`,
          };
        }
        return {
          success: true,
          results: [],
          message: `I don't have any saved memory matching "${query}".`,
        };
      }
      return { success: false, results: [], message: data.message || 'No memory found.' };
    } catch (err: any) {
      return { success: false, results: [], message: err?.message || 'Error recalling memory.' };
    }
  }

  /**
   * Natural Language / Voice Tool: Update existing memory
   */
  public async updateMemory(
    memoryId: string,
    newContent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(memoryId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await this.refreshMemories();
        return { success: true, message: `Updated memory: "${newContent}"` };
      }
      return { success: false, message: data.message || 'Failed to update memory.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error updating memory.' };
    }
  }

  /**
   * Natural Language / Voice Tool: Forget a specific memory or query
   */
  public async forgetMemory(
    queryOrId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if it matches an ID directly
      let targetId = queryOrId;
      const directMatch = this.memories.find((m) => m.id === queryOrId);

      if (!directMatch) {
        // Query search to find matching ID
        const searchRes = await this.recallMemory(queryOrId);
        if (searchRes.results.length > 0) {
          targetId = searchRes.results[0].id;
        } else {
          return {
            success: false,
            message: `Could not find any memory matching "${queryOrId}" to delete.`,
          };
        }
      }

      const res = await fetch(`/api/memory/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await this.refreshMemories();
        return { success: true, message: `Memory forgotten and removed from storage.` };
      }
      return { success: false, message: data.message || 'Failed to delete memory.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error forgetting memory.' };
    }
  }

  /**
   * Natural Language / Voice Tool: Show saved memories summary
   */
  public async showMemories(
    category?: MemoryCategory
  ): Promise<{ success: boolean; count: number; summary: string }> {
    await this.refreshMemories();
    const filtered = category
      ? this.memories.filter((m) => m.category === category)
      : this.memories;

    if (filtered.length === 0) {
      return {
        success: true,
        count: 0,
        summary: category
          ? `No memories saved in "${category}" yet.`
          : 'No memories saved yet.',
      };
    }

    const items = filtered.slice(0, 5).map((m) => `[${m.category}] ${m.content}`).join(' | ');
    return {
      success: true,
      count: filtered.length,
      summary: `You have ${filtered.length} memories: ${items}`,
    };
  }

  /**
   * Fetches cognitive graph nodes and edges
   */
  public async getGraphData(): Promise<CognitiveGraphData> {
    try {
      const res = await fetch('/api/memory/graph');
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    // Fallback: build locally
    const nodes = this.memories.map((m) => ({
      id: m.id,
      label: m.content.slice(0, 24) + (m.content.length > 24 ? '...' : ''),
      category: m.category,
      importance: m.importance,
    }));
    return { nodes, edges: [] };
  }

  /**
   * Fetches overall memory statistics
   */
  public async getStats(): Promise<MemoryStats | null> {
    try {
      const res = await fetch('/api/memory/stats');
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }

  /**
   * Clears all memories
   */
  public async clearAll(): Promise<boolean> {
    try {
      const res = await fetch('/api/memory/clear', { method: 'POST' });
      if (res.ok) {
        this.memories = [];
        this.onMemoriesUpdatedCallback?.([]);
        return true;
      }
    } catch {}
    return false;
  }

  /**
   * Exports all memories as JSON
   */
  public async exportData(): Promise<void> {
    try {
      const res = await fetch('/api/memory/export');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lucy-cognitive-memories-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  }

  /**
   * Updates detected conversational emotion
   */
  public setDetectedEmotion(emotion: EmotionalContext) {
    this.currentEmotion = emotion;
    this.onEmotionChangeCallback?.(emotion);
  }
}

export const cognitiveMemoryManager = new CognitiveMemoryManager();
