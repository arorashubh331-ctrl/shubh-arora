/**
 * MemoryStorage - Real Persistent Storage for Lucy's Cognitive Memory
 * 
 * Persists to disk at ./lucy-memory-store/ with atomic writes, ensuring memories
 * survive page reloads, browser closure, server restarts, and system reboots.
 */

import fs from 'fs';
import path from 'path';
import {
  MemoryItem,
  MemoryCategory,
  WorkingMemoryState,
  CognitiveGraphEdge,
  MemoryStats,
} from '../../src/types/memory.ts';

export class MemoryStorage {
  private baseDir: string;
  private memoryFile: string;
  private associationFile: string;
  private workingMemoryFile: string;

  private memories: Map<string, MemoryItem> = new Map();
  private associations: CognitiveGraphEdge[] = [];
  private workingMemory: WorkingMemoryState = {
    currentTask: null,
    activeProject: null,
    recentTopics: [],
    unresolvedQuestions: [],
    recentDecisions: [],
    activeEntities: [],
    lastInteractionTimestamp: Date.now(),
  };

  private lastConsolidatedAt: number = Date.now();

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'lucy-memory-store');
    this.memoryFile = path.join(this.baseDir, 'memories.json');
    this.associationFile = path.join(this.baseDir, 'associations.json');
    this.workingMemoryFile = path.join(this.baseDir, 'working_memory.json');

    this.ensureDirectory();
    this.loadFromDisk();
  }

  private ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (err) {
        console.warn('[MemoryStorage] Error creating memory store directory:', err);
      }
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const raw = fs.readFileSync(this.memoryFile, 'utf-8');
        const items: MemoryItem[] = JSON.parse(raw);
        this.memories.clear();
        for (const item of items) {
          this.memories.set(item.id, item);
        }
        console.log(`[MemoryStorage] Loaded ${this.memories.size} memories from disk`);
      } else {
        this.seedInitialKnowledge();
      }

      if (fs.existsSync(this.associationFile)) {
        const raw = fs.readFileSync(this.associationFile, 'utf-8');
        this.associations = JSON.parse(raw);
      }

      if (fs.existsSync(this.workingMemoryFile)) {
        const raw = fs.readFileSync(this.workingMemoryFile, 'utf-8');
        this.workingMemory = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[MemoryStorage] Error loading memory store from disk:', err);
      this.seedInitialKnowledge();
    }
  }

  private saveToDisk() {
    this.ensureDirectory();
    try {
      // 1. Atomic write for memories
      const memArray = Array.from(this.memories.values());
      const tempMemFile = `${this.memoryFile}.tmp`;
      fs.writeFileSync(tempMemFile, JSON.stringify(memArray, null, 2), 'utf-8');
      fs.renameSync(tempMemFile, this.memoryFile);

      // 2. Atomic write for associations
      const tempAssocFile = `${this.associationFile}.tmp`;
      fs.writeFileSync(tempAssocFile, JSON.stringify(this.associations, null, 2), 'utf-8');
      fs.renameSync(tempAssocFile, this.associationFile);

      // 3. Atomic write for working memory
      const tempWmFile = `${this.workingMemoryFile}.tmp`;
      fs.writeFileSync(tempWmFile, JSON.stringify(this.workingMemory, null, 2), 'utf-8');
      fs.renameSync(tempWmFile, this.workingMemoryFile);
    } catch (err) {
      console.error('[MemoryStorage] Error writing to disk:', err);
    }
  }

  /**
   * Seeds initial baseline profile and preferences
   */
  private seedInitialKnowledge() {
    const now = Date.now();
    const defaults: MemoryItem[] = [
      {
        id: 'mem_profile_comm_style',
        category: 'preference',
        content: 'Prefers natural, warm, and playful Hinglish and English communication with a lively feminine tone.',
        summary: 'Preferred communication style',
        createdAt: now - 86400000,
        updatedAt: now - 86400000,
        lastAccessedAt: now,
        accessCount: 1,
        importance: 8,
        confidence: 0.95,
        relatedEntities: ['Lucy', 'Hinglish', 'Communication'],
        tags: ['preference', 'style', 'speech'],
        sourceContext: 'System Initialization',
        expirationPolicy: 'never',
        associations: ['mem_profile_tools'],
        pinned: true,
      },
      {
        id: 'mem_profile_tools',
        category: 'procedural',
        content: 'Frequently uses Windows 11 desktop controls, Chrome/Edge browser automation, Notepad, and YouTube music.',
        summary: 'Commonly used tools and workflows',
        createdAt: now - 86400000,
        updatedAt: now - 86400000,
        lastAccessedAt: now,
        accessCount: 1,
        importance: 7,
        confidence: 0.9,
        relatedEntities: ['Windows 11', 'Chrome', 'Notepad', 'YouTube'],
        tags: ['tools', 'procedural'],
        sourceContext: 'System Initialization',
        expirationPolicy: 'never',
        associations: ['mem_profile_comm_style'],
        pinned: false,
      },
      {
        id: 'mem_project_lucy_upgrade',
        category: 'project',
        content: 'Working on upgrading Lucy with human-brain-inspired cognitive memory and desktop capabilities.',
        summary: 'Lucy Cognitive Assistant Project',
        createdAt: now - 43200000,
        updatedAt: now - 43200000,
        lastAccessedAt: now,
        accessCount: 2,
        importance: 9,
        confidence: 1.0,
        relatedEntities: ['Lucy', 'Memory', 'AI'],
        tags: ['project', 'upgrade', 'ai'],
        sourceContext: 'System Initialization',
        expirationPolicy: 'never',
        associations: ['mem_profile_comm_style', 'mem_profile_tools'],
        pinned: true,
      },
    ];

    for (const d of defaults) {
      this.memories.set(d.id, d);
    }

    this.associations = [
      {
        id: 'edge_1',
        source: 'mem_profile_comm_style',
        target: 'mem_project_lucy_upgrade',
        relation: 'applies_to',
        weight: 0.85,
      },
      {
        id: 'edge_2',
        source: 'mem_profile_tools',
        target: 'mem_project_lucy_upgrade',
        relation: 'used_in',
        weight: 0.75,
      },
    ];

    this.saveToDisk();
  }

  // --- CRUD Operations ---

  public getAllMemories(filterActiveOnly: boolean = true): MemoryItem[] {
    const list = Array.from(this.memories.values());
    if (filterActiveOnly) {
      return list.filter((m) => !m.supersededBy && !m.isContradicted);
    }
    return list;
  }

  public getMemory(id: string): MemoryItem | undefined {
    return this.memories.get(id);
  }

  public saveMemory(item: MemoryItem): MemoryItem {
    item.updatedAt = Date.now();
    if (!item.createdAt) {
      item.createdAt = Date.now();
    }
    this.memories.set(item.id, item);
    this.saveToDisk();
    return item;
  }

  public updateMemory(id: string, updates: Partial<MemoryItem>): MemoryItem | null {
    const existing = this.memories.get(id);
    if (!existing) return null;

    const updated: MemoryItem = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    this.memories.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  public deleteMemory(id: string): boolean {
    const exists = this.memories.has(id);
    if (!exists) return false;

    this.memories.delete(id);

    // Clean up graph edges
    this.associations = this.associations.filter(
      (a) => a.source !== id && a.target !== id
    );

    // Clean up references in other memories' associations
    for (const item of this.memories.values()) {
      if (item.associations.includes(id)) {
        item.associations = item.associations.filter((aid) => aid !== id);
      }
    }

    this.saveToDisk();
    return true;
  }

  public clearAllMemories() {
    this.memories.clear();
    this.associations = [];
    this.workingMemory = {
      currentTask: null,
      activeProject: null,
      recentTopics: [],
      unresolvedQuestions: [],
      recentDecisions: [],
      activeEntities: [],
      lastInteractionTimestamp: Date.now(),
    };
    this.saveToDisk();
  }

  // --- Working Memory ---

  public getWorkingMemory(): WorkingMemoryState {
    return { ...this.workingMemory };
  }

  public updateWorkingMemory(updates: Partial<WorkingMemoryState>): WorkingMemoryState {
    this.workingMemory = {
      ...this.workingMemory,
      ...updates,
      lastInteractionTimestamp: Date.now(),
    };
    this.saveToDisk();
    return { ...this.workingMemory };
  }

  // --- Associations & Graph ---

  public getAssociations(): CognitiveGraphEdge[] {
    return [...this.associations];
  }

  public addAssociation(source: string, target: string, relation: string, weight: number = 0.7) {
    if (source === target) return;

    const exists = this.associations.some(
      (a) =>
        (a.source === source && a.target === target) ||
        (a.source === target && a.target === source)
    );

    if (!exists) {
      this.associations.push({
        id: `assoc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source,
        target,
        relation,
        weight,
      });

      // Update memory items' association lists
      const sItem = this.memories.get(source);
      if (sItem && !sItem.associations.includes(target)) {
        sItem.associations.push(target);
      }
      const tItem = this.memories.get(target);
      if (tItem && !tItem.associations.includes(source)) {
        tItem.associations.push(source);
      }

      this.saveToDisk();
    }
  }

  // --- Stats & Export ---

  public getStats(): MemoryStats {
    const all = Array.from(this.memories.values()).filter((m) => !m.supersededBy);
    const byCategory: Record<MemoryCategory, number> = {
      profile: 0,
      preference: 0,
      project: 0,
      episodic: 0,
      semantic: 0,
      procedural: 0,
      working: 0,
    };

    let profileName: string | null = null;
    for (const m of all) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
      if (m.category === 'profile' && m.content.toLowerCase().includes('name')) {
        profileName = m.content;
      }
    }

    return {
      total: all.length,
      byCategory,
      totalAssociations: this.associations.length,
      profileName,
      lastConsolidatedAt: this.lastConsolidatedAt,
    };
  }

  public setLastConsolidated(ts: number) {
    this.lastConsolidatedAt = ts;
  }

  public exportData() {
    return {
      version: '1.0',
      exportedAt: Date.now(),
      memories: Array.from(this.memories.values()),
      associations: this.associations,
      workingMemory: this.workingMemory,
    };
  }

  public importData(data: any): boolean {
    if (!data || !Array.isArray(data.memories)) return false;

    this.memories.clear();
    for (const m of data.memories) {
      if (m.id && m.content) {
        this.memories.set(m.id, m);
      }
    }

    if (Array.isArray(data.associations)) {
      this.associations = data.associations;
    }

    if (data.workingMemory) {
      this.workingMemory = data.workingMemory;
    }

    this.saveToDisk();
    return true;
  }
}

export const memoryStorage = new MemoryStorage();
