import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit3,
  Download,
  RefreshCw,
  X,
  Tag,
  Calendar,
  Sparkles,
  Layers,
  Network,
  User,
  Heart,
  FolderGit2,
  Workflow,
  BookOpen,
  MessageSquare,
  AlertCircle,
  Pin,
} from 'lucide-react';
import { ThemeConfig } from '../types/assistant';
import {
  MemoryItem,
  MemoryCategory,
  CognitiveGraphData,
  MemoryStats,
} from '../types/memory';
import { cognitiveMemoryManager } from '../modules/memory/CognitiveMemoryManager';

interface MemoryDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
}

type TabType = 'overview' | 'profile' | 'preferences' | 'projects' | 'procedural' | 'episodic' | 'semantic' | 'graph';

export const MemoryDashboardModal: React.FC<MemoryDashboardModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [graphData, setGraphData] = useState<CognitiveGraphData | null>(null);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newContent, setNewContent] = useState<string>('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('semantic');
  const [newImportance, setNewImportance] = useState<number>(7);
  const [newTags, setNewTags] = useState<string>('');
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load memories & stats
  const reloadData = async () => {
    const list = await cognitiveMemoryManager.refreshMemories();
    setMemories(list);
    const s = await cognitiveMemoryManager.getStats();
    setStats(s);
    const g = await cognitiveMemoryManager.getGraphData();
    setGraphData(g);
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
      setConfirmClearAll(false);
    }
  }, [isOpen]);

  // Memory deletion
  const handleDelete = async (id: string) => {
    await cognitiveMemoryManager.forgetMemory(id);
    await reloadData();
  };

  // Memory save (edit or new)
  const handleSaveEdit = async () => {
    if (!editingMemory) return;
    await cognitiveMemoryManager.updateMemory(editingMemory.id, editingMemory.content);
    setEditingMemory(null);
    await reloadData();
  };

  const handleAddNew = async () => {
    if (!newContent.trim()) return;
    const tagsArr = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await cognitiveMemoryManager.rememberFact(newContent, newCategory, newImportance, tagsArr);
    setNewContent('');
    setNewTags('');
    setIsAddOpen(false);
    await reloadData();
  };

  const handleClearAll = async () => {
    await cognitiveMemoryManager.clearAll();
    setConfirmClearAll(false);
    await reloadData();
  };

  // Simple Canvas rendering for Associative Cognitive Graph
  useEffect(() => {
    if (activeTab === 'graph' && canvasRef.current && graphData) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
      const height = (canvas.height = 360);

      ctx.clearRect(0, 0, width, height);

      const nodeCount = graphData.nodes.length;
      if (nodeCount === 0) {
        ctx.fillStyle = '#71717a';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No cognitive graph nodes yet.', width / 2, height / 2);
        return;
      }

      // Arrange nodes in circle or pseudo-force layout
      const radius = Math.min(width, height) * 0.35;
      const centerX = width / 2;
      const centerY = height / 2;

      const nodePositions = new Map<string, { x: number; y: number }>();
      graphData.nodes.forEach((node, i) => {
        const angle = (i / nodeCount) * 2 * Math.PI;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        nodePositions.set(node.id, { x, y });
      });

      // Draw edges
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `${theme.primary}40`;
      graphData.edges.forEach((edge) => {
        const p1 = nodePositions.get(edge.source);
        const p2 = nodePositions.get(edge.target);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      graphData.nodes.forEach((node) => {
        const pos = nodePositions.get(node.id);
        if (!pos) return;

        // Glowing outer circle
        ctx.fillStyle = `${theme.primary}20`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 16, 0, 2 * Math.PI);
        ctx.fill();

        // Node center
        ctx.fillStyle = theme.primary;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Label
        ctx.fillStyle = '#e4e4e7';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, pos.x, pos.y - 12);
      });
    }
  }, [activeTab, graphData, theme]);

  if (!isOpen) return null;

  // Filter memories
  const filtered = memories.filter((m) => {
    const matchesQuery =
      searchQuery === '' ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.relatedEntities.some((e) => e.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat =
      activeTab === 'overview' || activeTab === 'graph'
        ? selectedCategory === 'all' || m.category === selectedCategory
        : m.category === activeTab;

    return matchesQuery && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl h-[88vh] max-h-[780px] rounded-3xl overflow-hidden flex flex-col bg-zinc-950/95 border shadow-2xl"
        style={{
          borderColor: `${theme.primary}45`,
          boxShadow: `0 0 50px ${theme.primary}25`,
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-lg"
              style={{
                backgroundColor: `${theme.primary}20`,
                borderColor: `${theme.primary}50`,
                color: theme.primary,
              }}
            >
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Lucy Cognitive Memory Architecture
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30">
                  {memories.length} Memories Active
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Human-brain-inspired persistent storage, episodic recall, and associative graph
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer hover:opacity-90 active:scale-95"
              style={{ backgroundColor: theme.primary }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>

            <button
              onClick={() => cognitiveMemoryManager.exportData()}
              className="p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Export Memories as JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={reloadData}
              className="p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Reload from Storage"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-white/5 bg-zinc-900/40 overflow-x-auto no-scrollbar text-xs shrink-0">
          {[
            { id: 'overview', label: 'Overview & All', icon: Layers },
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'preferences', label: 'Preferences', icon: Heart },
            { id: 'projects', label: 'Projects', icon: FolderGit2 },
            { id: 'procedural', label: 'Workflows', icon: Workflow },
            { id: 'episodic', label: 'Episodic', icon: MessageSquare },
            { id: 'semantic', label: 'Semantic Facts', icon: BookOpen },
            { id: 'graph', label: 'Cognitive Graph', icon: Network },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
                style={{
                  backgroundColor: isActive ? `${theme.primary}30` : undefined,
                  border: isActive ? `1px solid ${theme.primary}60` : '1px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? theme.primary : undefined }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Toolbar */}
        {activeTab !== 'graph' && (
          <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between gap-3 bg-zinc-950">
            <div className="flex-1 max-w-md relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories by keyword, entity, or tag..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'overview' && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-300 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="profile">Profile</option>
                  <option value="preference">Preferences</option>
                  <option value="project">Projects</option>
                  <option value="procedural">Procedural</option>
                  <option value="episodic">Episodic</option>
                  <option value="semantic">Semantic</option>
                </select>
              )}

              {confirmClearAll ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-rose-400">Confirm?</span>
                  <button
                    onClick={handleClearAll}
                    className="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                  >
                    Yes, Clear All
                  </button>
                  <button
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearAll(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/30 border border-rose-500/20 transition-colors cursor-pointer"
                  title="Clear all stored memories"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'graph' ? (
            /* Cognitive Associative Graph */
            <div className="w-full flex flex-col items-center justify-center p-4 bg-zinc-900/50 rounded-2xl border border-white/10">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-cyan-400" />
                  Associative Memory Graph (Connected Entities & Topics)
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  {graphData?.nodes.length || 0} Nodes • {graphData?.edges.length || 0} Associations
                </span>
              </div>
              <div className="w-full h-[360px] relative rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-2 text-center">
                Memories automatically form associative connections when they share entities, topics, or workflows.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Brain className="w-12 h-12 text-zinc-600 mb-3" />
              <h4 className="text-sm font-semibold text-white mb-1">No Memories Found</h4>
              <p className="text-xs text-zinc-400 max-w-sm">
                {searchQuery
                  ? `No memories matched "${searchQuery}". Try different keywords.`
                  : 'Start talking to Lucy or click "Add Memory" to store facts, preferences, and projects!'}
              </p>
            </div>
          ) : (
            /* Memory Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between group shadow-lg"
                  style={{
                    borderLeftColor:
                      item.category === 'profile'
                        ? '#38bdf8'
                        : item.category === 'preference'
                        ? '#f43f5e'
                        : item.category === 'project'
                        ? '#a855f7'
                        : item.category === 'procedural'
                        ? '#10b981'
                        : '#e4e4e7',
                    borderLeftWidth: '3px',
                  }}
                >
                  <div>
                    {/* Header: Category Badge & Importance */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-semibold">
                          {item.category}
                        </span>
                        {item.pinned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Pin className="w-2.5 h-2.5" /> Pinned
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400"
                          title="Importance score (1-10)"
                        >
                          ★ {item.importance}/10
                        </span>
                        <button
                          onClick={() => setEditingMemory(item)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-white transition-opacity cursor-pointer"
                          title="Edit Memory"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-400 transition-opacity cursor-pointer"
                          title="Delete Memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-xs text-zinc-200 leading-relaxed font-normal mb-3">
                      {item.content}
                    </p>

                    {/* Entities & Tags */}
                    {item.relatedEntities && item.relatedEntities.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        {item.relatedEntities.map((ent, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-cyan-300 font-mono border border-cyan-500/20"
                          >
                            @{ent}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer metadata */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-600" />
                      {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
                    </span>
                    <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Memory Modal Dialog */}
        {editingMemory && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-2xl">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                Edit Memory Content
              </h4>
              <textarea
                value={editingMemory.content}
                onChange={(e) =>
                  setEditingMemory({ ...editingMemory, content: e.target.value })
                }
                rows={4}
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 mb-3"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditingMemory(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Memory Modal Dialog */}
        {isAddOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-2xl space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-cyan-400" />
                Store New Cognitive Memory
              </h4>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Memory Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. User prefers concise answers and Python over JavaScript..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                    className="w-full p-2 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="profile">Profile</option>
                    <option value="preference">Preference</option>
                    <option value="project">Project</option>
                    <option value="procedural">Procedural</option>
                    <option value="episodic">Episodic</option>
                    <option value="semantic">Semantic</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Importance (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseInt(e.target.value, 10))}
                    className="w-full p-2 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. coding, python, preference"
                  className="w-full p-2 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNew}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 cursor-pointer shadow-md"
                >
                  Store Memory
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
