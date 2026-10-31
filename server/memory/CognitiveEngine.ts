/**
 * CognitiveEngine - Cognitive Architecture inspired by Human Brain Memory Systems
 * 
 * Implements:
 * 1. Automatic Memory Extraction (categorization, entity extraction, privacy filters)
 * 2. Hybrid Memory Retrieval (keyword, entity matching, associative graph traversal, recency weighting)
 * 3. Memory Consolidation & Contradiction Resolution
 * 4. Emotional Context Recognition
 * 5. Compact Context Synthesis for Gemini
 */

import { memoryStorage } from './MemoryStorage.ts';
import {
  MemoryItem,
  MemoryCategory,
  MemoryQueryResult,
  EmotionalContext,
  EmotionalTone,
} from '../../src/types/memory.ts';

export class CognitiveEngine {
  private privacyBlocklist = [
    /\b(?:password|passwd|pwd|passcode)\b/i,
    /\b(?:api[_-]?key|secret[_-]?key|auth[_-]?token|bearer\s+[a-z0-9_-]+)\b/i,
    /\b(?:credit[_-]?card|cvv|pin\s+code)\b/i,
    /\b(?:private[_-]?key)\b/i,
  ];

  /**
   * Sanitizes text and checks if it violates privacy (passwords/keys)
   */
  public isPrivacySensitive(text: string): boolean {
    return this.privacyBlocklist.some((regex) => regex.test(text));
  }

  /**
   * Automatic Memory Extraction from user speech/text
   */
  public extractMemoryFromText(
    text: string,
    sourceContext: string = 'User Statement'
  ): MemoryItem | null {
    const cleanText = text.trim();
    if (!cleanText || cleanText.length < 5) return null;

    // Safety: Never store passwords, API keys or secret tokens
    if (this.isPrivacySensitive(cleanText)) {
      console.log('[CognitiveEngine] Blocked sensitive credential from memory storage.');
      return null;
    }

    const lower = cleanText.toLowerCase();

    // Check for explicit "don't remember" / "forget" instructions
    if (
      lower.startsWith("don't remember") ||
      lower.startsWith('do not remember') ||
      lower.startsWith('forget this')
    ) {
      return null;
    }

    // Determine category and importance
    let category: MemoryCategory = 'semantic';
    let importance = 6;
    let confidence = 0.85;

    // 1. Profile information (name, identity)
    if (
      lower.includes('my name is') ||
      lower.includes('call me') ||
      lower.includes('mera naam') ||
      lower.includes('i am an engineer') ||
      lower.includes('i work as')
    ) {
      category = 'profile';
      importance = 10;
      confidence = 0.98;
    }
    // 2. Preferences (likes, dislikes, style)
    else if (
      lower.includes('i like') ||
      lower.includes('i love') ||
      lower.includes('i prefer') ||
      lower.includes('i hate') ||
      lower.includes('my favourite') ||
      lower.includes('mujhe pasand') ||
      lower.includes('mera favourite')
    ) {
      category = 'preference';
      importance = 8;
      confidence = 0.92;
    }
    // 3. Projects and Goals
    else if (
      lower.includes('my project') ||
      lower.includes('working on') ||
      lower.includes('building an app') ||
      lower.includes('goal is to') ||
      lower.includes('developing')
    ) {
      category = 'project';
      importance = 9;
      confidence = 0.9;
    }
    // 4. Procedural & Workflows
    else if (
      lower.includes('always open') ||
      lower.includes('workflow') ||
      lower.includes('step 1') ||
      lower.includes('whenever i say') ||
      lower.includes('first do')
    ) {
      category = 'procedural';
      importance = 8;
      confidence = 0.9;
    }
    // 5. Episodic (events, discussions, past decisions)
    else if (
      lower.includes('yesterday') ||
      lower.includes('last time') ||
      lower.includes('we decided') ||
      lower.includes('in our meeting') ||
      lower.includes('kal humne')
    ) {
      category = 'episodic';
      importance = 7;
      confidence = 0.88;
    }
    // 6. Explicit "Remember this"
    else if (
      lower.includes('remember this') ||
      lower.includes('yaad rakhna') ||
      lower.includes('keep in mind') ||
      lower.includes('note that')
    ) {
      category = 'semantic';
      importance = 9;
      confidence = 0.95;
    } else {
      // General statements only saved if substantial
      if (cleanText.length < 25) return null;
      importance = 5;
    }

    // Extract Entities
    const entities = this.extractEntities(cleanText);
    const tags = [category, ...entities.map((e) => e.toLowerCase())];

    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    const memoryItem: MemoryItem = {
      id,
      category,
      content: cleanText.replace(/^(?:remember this[:\s]*|yaad rakhna[:\s]*)/i, '').trim(),
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      importance,
      confidence,
      relatedEntities: entities,
      tags,
      sourceContext,
      expirationPolicy: 'never',
      associations: [],
    };

    // Save and link
    const saved = memoryStorage.saveMemory(memoryItem);
    this.autoLinkAssociations(saved);
    this.checkForContradictions(saved);

    return saved;
  }

  /**
   * Hybrid Memory Retrieval
   */
  public retrieveMemories(query: string, maxResults: number = 4): MemoryQueryResult[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const allMemories = memoryStorage.getAllMemories(true);
    const queryTokens = cleanQuery.split(/\s+/).filter((t) => t.length > 2);
    const queryEntities = this.extractEntities(query);

    const scored: MemoryQueryResult[] = [];

    for (const mem of allMemories) {
      let score = 0;
      const memTextLower = mem.content.toLowerCase();
      const matchReasons: string[] = [];

      // 1. Exact phrase or substring match
      if (memTextLower.includes(cleanQuery)) {
        score += 0.5;
        matchReasons.push('direct_phrase');
      }

      // 2. Token overlap score
      let tokenMatches = 0;
      for (const t of queryTokens) {
        if (memTextLower.includes(t)) {
          tokenMatches++;
        }
      }
      if (queryTokens.length > 0) {
        const tokenRatio = tokenMatches / queryTokens.length;
        score += tokenRatio * 0.35;
        if (tokenRatio > 0.4) matchReasons.push('keywords');
      }

      // 3. Entity overlap
      let entityOverlap = 0;
      for (const ent of mem.relatedEntities) {
        if (cleanQuery.includes(ent.toLowerCase()) || queryEntities.includes(ent)) {
          entityOverlap++;
        }
      }
      if (entityOverlap > 0) {
        score += Math.min(entityOverlap * 0.25, 0.4);
        matchReasons.push('entity_match');
      }

      // 4. Importance & Confidence bonus
      score += (mem.importance / 10) * 0.15;
      score += mem.confidence * 0.1;

      // 5. Pinned bonus
      if (mem.pinned) {
        score += 0.15;
      }

      // 6. Recency decay (slight boost for recent memories)
      const ageHours = (Date.now() - mem.createdAt) / (1000 * 3600);
      if (ageHours < 24) {
        score += 0.1;
      }

      if (score >= 0.25) {
        scored.push({
          item: mem,
          score,
          matchReason: matchReasons.join(', ') || 'relevance',
        });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Update access counts
    const top = scored.slice(0, maxResults);
    for (const res of top) {
      res.item.lastAccessedAt = Date.now();
      res.item.accessCount = (res.item.accessCount || 0) + 1;
      memoryStorage.saveMemory(res.item);

      // Traversal: Add 1 top associative link if exists and relevant
      for (const assocId of res.item.associations) {
        const linked = memoryStorage.getMemory(assocId);
        if (linked && !top.some((r) => r.item.id === linked.id)) {
          top.push({
            item: linked,
            score: res.score * 0.75,
            matchReason: `associated_with_${res.item.category}`,
          });
          break;
        }
      }
    }

    return top;
  }

  /**
   * Generates a compact, human-like context summary for injection into Gemini Live
   */
  public buildCompactContext(query: string = ''): string {
    const wm = memoryStorage.getWorkingMemory();
    const retrieved = this.retrieveMemories(query, 3);
    const profileMemories = memoryStorage
      .getAllMemories(true)
      .filter((m) => m.category === 'profile' || m.pinned)
      .slice(0, 2);

    const lines: string[] = [];

    // Profile & Core Facts
    if (profileMemories.length > 0) {
      lines.push('User Profile & Directives:');
      for (const p of profileMemories) {
        lines.push(`• ${p.content}`);
      }
    }

    // Relevant Retrieved Memories
    if (retrieved.length > 0) {
      lines.push('Relevant Past Context:');
      for (const r of retrieved) {
        lines.push(`• [${r.item.category.toUpperCase()}] ${r.item.content}`);
      }
    }

    // Working Memory Task Context
    if (wm.currentTask || wm.activeProject) {
      lines.push('Active Task & Focus:');
      if (wm.activeProject) lines.push(`• Project: ${wm.activeProject}`);
      if (wm.currentTask) lines.push(`• Task: ${wm.currentTask}`);
    }

    return lines.join('\n');
  }

  /**
   * Contradiction Resolution & Updating
   */
  public checkForContradictions(newMemory: MemoryItem) {
    const all = memoryStorage.getAllMemories(true);
    const newText = newMemory.content.toLowerCase();

    // Check for conflicting preferences
    if (newMemory.category === 'preference' || newMemory.category === 'profile') {
      for (const old of all) {
        if (old.id === newMemory.id) continue;
        if (old.category !== newMemory.category) continue;

        // Check if both discuss the same topic or entity
        const sharedEntities = old.relatedEntities.filter((e) =>
          newMemory.relatedEntities.includes(e)
        );

        if (sharedEntities.length > 0 || this.isSimilarTopic(old.content, newMemory.content)) {
          console.log(`[CognitiveEngine] Detected updated/contradicting memory. Superseding old: ${old.id}`);
          memoryStorage.updateMemory(old.id, {
            supersededBy: newMemory.id,
            isContradicted: true,
          });
          memoryStorage.addAssociation(old.id, newMemory.id, 'superseded_by', 0.95);
        }
      }
    }
  }

  /**
   * Auto-links memories sharing entities to build Associative Memory Graph
   */
  public autoLinkAssociations(memory: MemoryItem) {
    const all = memoryStorage.getAllMemories(true);
    for (const other of all) {
      if (other.id === memory.id) continue;

      const shared = other.relatedEntities.filter((e) =>
        memory.relatedEntities.includes(e)
      );

      if (shared.length > 0) {
        memoryStorage.addAssociation(
          memory.id,
          other.id,
          `shares_${shared[0].toLowerCase()}`,
          0.8
        );
      }
    }
  }

  /**
   * Emotional Context Detection from conversational signals
   */
  public detectEmotionalContext(text: string): EmotionalContext {
    const lower = text.toLowerCase();

    if (
      lower.includes('wow') ||
      lower.includes('awesome') ||
      lower.includes('amazing') ||
      lower.includes('love it') ||
      lower.includes('yay') ||
      lower.includes('bohot badhiya')
    ) {
      return { tone: 'excitement', intensity: 0.85, cue: 'User is excited or celebrating', timestamp: Date.now() };
    }

    if (
      lower.includes('not working') ||
      lower.includes('frustrated') ||
      lower.includes('error') ||
      lower.includes('stuck') ||
      lower.includes('kharab ho gaya') ||
      lower.includes('pareshan')
    ) {
      return { tone: 'frustration', intensity: 0.8, cue: 'User encountering difficulty or frustration', timestamp: Date.now() };
    }

    if (
      lower.includes('what do you mean') ||
      lower.includes('confused') ||
      lower.includes('samajh nahi aaya') ||
      lower.includes("don't get it")
    ) {
      return { tone: 'confusion', intensity: 0.75, cue: 'User is confused or needs clarity', timestamp: Date.now() };
    }

    if (
      lower.includes('how does') ||
      lower.includes('why is') ||
      lower.includes('tell me more') ||
      lower.includes('kya aap bata sakti ho')
    ) {
      return { tone: 'curiosity', intensity: 0.7, cue: 'User is curious and learning', timestamp: Date.now() };
    }

    if (
      lower.includes('maybe') ||
      lower.includes('not sure') ||
      lower.includes('shayad') ||
      lower.includes('pata nahi')
    ) {
      return { tone: 'uncertainty', intensity: 0.6, cue: 'User is uncertain or hesitant', timestamp: Date.now() };
    }

    if (
      lower.includes('sad') ||
      lower.includes('upset') ||
      lower.includes('disappointed') ||
      lower.includes('mood kharab')
    ) {
      return { tone: 'disappointment', intensity: 0.75, cue: 'User is feeling low or disappointed', timestamp: Date.now() };
    }

    return { tone: 'neutral', intensity: 0.3, cue: 'Normal conversational baseline', timestamp: Date.now() };
  }

  /**
   * Simple entity extractor
   */
  private extractEntities(text: string): string[] {
    const entities = new Set<string>();

    // Recognized keywords and names
    const knownKeywords = [
      'Lucy',
      'Windows',
      'Chrome',
      'Edge',
      'YouTube',
      'Spotify',
      'VS Code',
      'Python',
      'React',
      'TypeScript',
      'JavaScript',
      'Notepad',
      'Excel',
      'Kesariya',
      'Rabba',
      'Arijit',
      'Hinglish',
      'English',
      'AI',
      'Google',
    ];

    for (const kw of knownKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
        entities.add(kw);
      }
    }

    // Capitalized words
    const capitalizedMatches = text.match(/\b[A-Z][a-z0-9_-]+\b/g);
    if (capitalizedMatches) {
      for (const m of capitalizedMatches) {
        if (!['I', 'The', 'A', 'My', 'What', 'How', 'When', 'Where', 'Why'].includes(m)) {
          entities.add(m);
        }
      }
    }

    return Array.from(entities);
  }

  private isSimilarTopic(textA: string, textB: string): boolean {
    const a = textA.toLowerCase();
    const b = textB.toLowerCase();
    const topics = ['music', 'song', 'browser', 'name', 'code', 'theme', 'drink', 'color', 'language'];
    return topics.some((t) => a.includes(t) && b.includes(t));
  }
}

export const cognitiveEngine = new CognitiveEngine();
