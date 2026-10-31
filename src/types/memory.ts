/**
 * Cognitive Memory Architecture Types
 * Inspired by Human-Brain Memory Systems:
 * - Short-Term Memory
 * - Working Memory
 * - Long-Term Memory (Profile, Preferences)
 * - Episodic Memory (Events, Discussions, Decisions)
 * - Semantic Memory (Facts, Knowledge, Concepts)
 * - Procedural Memory (Workflows, Instructions)
 * - Associative Memory (Connected Graph of Entities & Contexts)
 */

export type MemoryCategory =
  | 'profile'
  | 'preference'
  | 'project'
  | 'episodic'
  | 'semantic'
  | 'procedural'
  | 'working';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  summary?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  accessCount: number;
  importance: number; // 1 to 10
  confidence: number; // 0.0 to 1.0
  relatedEntities: string[];
  tags: string[];
  sourceContext: string;
  expirationPolicy: 'never' | 'session' | '30d' | '90d';
  associations: string[]; // Connected Memory IDs
  pinned?: boolean;
  supersededBy?: string | null; // For contradiction/superseding
  isContradicted?: boolean;
}

export type EmotionalTone =
  | 'excitement'
  | 'curiosity'
  | 'frustration'
  | 'confusion'
  | 'uncertainty'
  | 'disappointment'
  | 'neutral';

export interface EmotionalContext {
  tone: EmotionalTone;
  intensity: number; // 0 to 1
  cue: string;
  timestamp: number;
}

export interface WorkingMemoryState {
  currentTask: string | null;
  activeProject: string | null;
  recentTopics: string[];
  unresolvedQuestions: string[];
  recentDecisions: string[];
  activeEntities: string[];
  lastInteractionTimestamp: number;
}

export interface CognitiveGraphNode {
  id: string;
  label: string;
  category: MemoryCategory | 'entity';
  importance: number;
  x?: number;
  y?: number;
}

export interface CognitiveGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface CognitiveGraphData {
  nodes: CognitiveGraphNode[];
  edges: CognitiveGraphEdge[];
}

export interface MemoryQueryResult {
  item: MemoryItem;
  score: number;
  matchReason: string;
}

export interface MemoryStats {
  total: number;
  byCategory: Record<MemoryCategory, number>;
  totalAssociations: number;
  profileName: string | null;
  lastConsolidatedAt: number;
}
