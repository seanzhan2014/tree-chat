import { create } from 'zustand';
import type { Topic, Node, TreeNode, AppSettings, ProviderConfig } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import * as api from '../services/api';

export function buildTree(nodes: Node[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];
  for (const n of nodes) map.set(n.id, { ...n, children: [] });
  for (const n of nodes) {
    const node = map.get(n.id)!;
    if (n.parent_id === null) roots.push(node);
    else map.get(n.parent_id)?.children.push(node);
  }
  return roots;
}

interface AppState {
  topics: Topic[];
  selectedTopicId: number | null;
  expandedTopicIds: Set<number>;
  nodesByTopic: Record<number, Node[]>;
  selectedNodeId: number | null;
  currentPath: Node[];
  isStreaming: boolean;
  streamingContent: string;
  streamingNodeId: number | null;
  streamingNodeName: string | null;
  abortController: AbortController | null;
  settings: AppSettings;
  settingsOpen: boolean;
  sidebarOpen: boolean;           // mobile sidebar toggle
  sidebarCollapsed: boolean;      // desktop sidebar collapsed

  loadTopics: () => Promise<void>;
  createTopic: (title: string) => Promise<Topic>;
  renameTopic: (id: number, title: string) => Promise<void>;
  deleteTopic: (id: number) => Promise<void>;
  selectTopic: (id: number) => Promise<void>;
  toggleTopicExpanded: (id: number) => Promise<void>;
  selectNode: (nodeId: number) => void;
  deleteNode: (nodeId: number) => Promise<void>;
  sendMessage: (userContent: string) => Promise<void>;
  regenerateMessage: () => Promise<void>;
  stopStreaming: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  topics: [],
  selectedTopicId: null,
  expandedTopicIds: new Set(),
  nodesByTopic: {},
  selectedNodeId: null,
  currentPath: [],
  isStreaming: false,
  streamingContent: '',
  streamingNodeId: null,
  streamingNodeName: null,
  abortController: null,
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,
  sidebarOpen: false,
  sidebarCollapsed: localStorage.getItem('tree-chat:sidebarCollapsed') === 'true',

  // ── Topics ──────────────────────────────────────────────────────────────────

  loadTopics: async () => {
    const topics = await api.listTopics();
    set({ topics });
    // Restore last selected topic
    const lastId = localStorage.getItem('tree-chat:lastTopicId');
    if (lastId && topics.find(t => t.id === Number(lastId))) {
      await get().selectTopic(Number(lastId));
    }
  },

  createTopic: async (title) => {
    const topic = await api.createTopic(title);
    set(s => ({ topics: [topic, ...s.topics] }));
    return topic;
  },

  renameTopic: async (id, title) => {
    await api.updateTopic(id, { title });
    set(s => ({ topics: s.topics.map(t => t.id === id ? { ...t, title } : t) }));
  },

  deleteTopic: async (id) => {
    await api.deleteTopic(id);
    set(s => {
      const expanded = new Set(s.expandedTopicIds);
      expanded.delete(id);
      const { [id]: _, ...rest } = s.nodesByTopic;
      return {
        topics: s.topics.filter(t => t.id !== id),
        expandedTopicIds: expanded,
        nodesByTopic: rest,
        selectedTopicId: s.selectedTopicId === id ? null : s.selectedTopicId,
        selectedNodeId: s.selectedTopicId === id ? null : s.selectedNodeId,
        currentPath: s.selectedTopicId === id ? [] : s.currentPath,
      };
    });
  },

  // ── Selection ────────────────────────────────────────────────────────────────

  selectTopic: async (id) => {
    const topic = get().topics.find(t => t.id === id);
    if (!topic) return;
    set({ selectedTopicId: id, selectedNodeId: null, currentPath: [] });
    if (topic.last_node_id) {
      const path = await api.getNodePath(topic.last_node_id);
      set({ selectedNodeId: topic.last_node_id, currentPath: path });
    }
  },

  toggleTopicExpanded: async (id) => {
    const { expandedTopicIds, nodesByTopic } = get();
    const expanded = new Set(expandedTopicIds);
    if (expanded.has(id)) {
      expanded.delete(id);
      set({ expandedTopicIds: expanded });
    } else {
      expanded.add(id);
      set({ expandedTopicIds: expanded });
      if (!nodesByTopic[id]) {
        const nodes = await api.getTopicTree(id);
        set(s => ({ nodesByTopic: { ...s.nodesByTopic, [id]: nodes } }));
      }
    }
  },

  selectNode: (nodeId) => {
    const { nodesByTopic, selectedTopicId } = get();
    if (!selectedTopicId) return;
    const nodes = nodesByTopic[selectedTopicId] || [];
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const ancestorIds = node.path.split('/').filter(Boolean).map(Number);
    const allIds = new Set([...ancestorIds, nodeId]);
    const pathNodes = nodes
      .filter(n => allIds.has(n.id))
      .sort((a, b) => a.path.length - b.path.length || a.id - b.id);
    set({ selectedNodeId: nodeId, currentPath: pathNodes });
  },

  deleteNode: async (nodeId) => {
    const { selectedTopicId, selectedNodeId } = get();
    await api.deleteNode(nodeId);
    if (selectedTopicId) {
      const nodes = await api.getTopicTree(selectedTopicId);
      set(s => ({ nodesByTopic: { ...s.nodesByTopic, [selectedTopicId]: nodes } }));
      if (selectedNodeId === nodeId || get().currentPath.some(n => n.id === nodeId)) {
        const updatedTopics = await api.listTopics();
        const updatedTopic = updatedTopics.find(t => t.id === selectedTopicId);
        set({ topics: updatedTopics });
        if (updatedTopic?.last_node_id) {
          const path = await api.getNodePath(updatedTopic.last_node_id);
          set({ selectedNodeId: updatedTopic.last_node_id, currentPath: path });
        } else {
          set({ selectedNodeId: null, currentPath: [] });
        }
      }
    }
  },

  // ── Chat ─────────────────────────────────────────────────────────────────────

  sendMessage: async (userContent) => {
    const { settings } = get();
    let { selectedTopicId, selectedNodeId } = get();
    if (!userContent.trim()) return;

    const provider = settings.providers.find(p => p.id === settings.activeProviderId);
    if (!provider?.apiKey) {
      throw new Error('No active provider configured. Please add an API key in Settings.');
    }

    // Auto-create topic if none selected
    if (!selectedTopicId) {
      const title = userContent.trim().split(/\s+/).slice(0, 6).join(' ');
      const topic = await get().createTopic(title);
      selectedTopicId = topic.id;
      selectedNodeId = null;
      set({ selectedTopicId: topic.id, selectedNodeId: null, currentPath: [] });
    }

    const abortController = new AbortController();
    set({ isStreaming: true, streamingContent: '', streamingNodeId: null, streamingNodeName: null, abortController });

    let streamingNodeId: number | null = null;
    let streamingName: string | null = null;
    let accContent = '';

    try {
      await api.chatStream(
        { topic_id: selectedTopicId, parent_node_id: selectedNodeId, user_content: userContent, provider_config: provider },
        (event) => {
          if (event.type === 'node_created') {
            streamingNodeId = event.node_id;
            set({ streamingNodeId: event.node_id });
            const userNode: Node = {
              id: event.node_id, topic_id: selectedTopicId!, parent_id: selectedNodeId,
              path: '', node_name: null, user_content: userContent, assistant_content: null,
              model: provider.model, tokens_used: null, summary: null, created_at: new Date().toISOString(),
            };
            set(s => ({ currentPath: [...s.currentPath, userNode] }));
          } else if (event.type === 'node_name') {
            streamingName = event.name;
            set({ streamingNodeName: event.name });
            set(s => ({ currentPath: s.currentPath.map(n => n.id === streamingNodeId ? { ...n, node_name: event.name } : n) }));
          } else if (event.type === 'token') {
            accContent += event.content;
            set({ streamingContent: accContent });
          } else if (event.type === 'done') {
            set(s => ({
              currentPath: s.currentPath.map(n =>
                n.id === streamingNodeId
                  ? { ...n, assistant_content: accContent, node_name: streamingName, tokens_used: event.tokens }
                  : n
              ),
            }));
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        },
        abortController.signal
      );

      if (streamingNodeId !== null) {
        set({ selectedNodeId: streamingNodeId });

        // Auto-rename topic if it was just created (single node = first message)
        const finishedNode = get().currentPath.find(n => n.id === streamingNodeId);
        const wasAutoCreated = !selectedNodeId; // parent was null → first message
        if (wasAutoCreated && finishedNode?.node_name) {
          await api.updateTopic(selectedTopicId!, { title: finishedNode.node_name });
        }

        const updatedTopics = await api.listTopics();
        set({ topics: updatedTopics });

        // Persist selected topic
        localStorage.setItem('tree-chat:lastTopicId', String(selectedTopicId));

        if (get().expandedTopicIds.has(selectedTopicId!)) {
          const nodes = await api.getTopicTree(selectedTopicId!);
          set(s => ({ nodesByTopic: { ...s.nodesByTopic, [selectedTopicId!]: nodes } }));
        }
      }
    } catch (err) {
      console.error('sendMessage error:', err);
      throw err;
    } finally {
      set({ isStreaming: false, streamingContent: '', streamingNodeId: null, streamingNodeName: null, abortController: null });
    }
  },

  regenerateMessage: async () => {
    const { currentPath, selectedTopicId } = get();
    if (currentPath.length === 0 || !selectedTopicId) return;

    // Last node in path is the one to regenerate
    const lastNode = currentPath[currentPath.length - 1];
    const userContent = lastNode.user_content;
    const parentId = lastNode.parent_id;

    // Delete last node (and its subtree)
    await api.deleteNode(lastNode.id);

    // Set state back to parent
    const newPath = currentPath.slice(0, -1);
    set({ currentPath: newPath, selectedNodeId: parentId });

    // Refresh tree if expanded
    if (get().expandedTopicIds.has(selectedTopicId)) {
      const nodes = await api.getTopicTree(selectedTopicId);
      set(s => ({ nodesByTopic: { ...s.nodesByTopic, [selectedTopicId]: nodes } }));
    }

    // Re-send
    await get().sendMessage(userContent);
  },

  stopStreaming: () => {
    const { abortController, streamingNodeId, streamingContent, streamingNodeName } = get();
    if (abortController) abortController.abort();
    if (streamingNodeId) {
      api.abortChat(streamingNodeId, streamingContent, streamingNodeName || '(stopped)').catch(() => {});
      // Finalize content in path
      set(s => ({
        currentPath: s.currentPath.map(n =>
          n.id === streamingNodeId
            ? { ...n, assistant_content: streamingContent || '[Generation stopped]', node_name: streamingNodeName }
            : n
        ),
        selectedNodeId: streamingNodeId,
      }));
    }
    set({ isStreaming: false, streamingContent: '', streamingNodeId: null, streamingNodeName: null, abortController: null });
  },

  // ── Settings ─────────────────────────────────────────────────────────────────

  loadSettings: async () => {
    const raw = await api.getSettings();
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    if (raw.providers)        settings.providers = JSON.parse(raw.providers);
    if (raw.activeProviderId) settings.activeProviderId = raw.activeProviderId;
    if (raw.systemPrompt)     settings.systemPrompt = raw.systemPrompt;
    if (raw.theme)            settings.theme = raw.theme as AppSettings['theme'];
    if (raw.nodeName)         settings.nodeName = JSON.parse(raw.nodeName);
    set({ settings });
    applyTheme(settings.theme);
  },

  saveSettings: async (settings) => {
    await api.bulkSetSettings({
      providers:        JSON.stringify(settings.providers),
      activeProviderId: settings.activeProviderId,
      systemPrompt:     settings.systemPrompt,
      theme:            settings.theme,
      nodeName:         JSON.stringify(settings.nodeName),
    });
    set({ settings });
    applyTheme(settings.theme);
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('tree-chat:sidebarCollapsed', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
}));

function applyTheme(theme: AppSettings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
