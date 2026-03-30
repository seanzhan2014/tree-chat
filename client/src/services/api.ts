import type { Topic, Node, ProviderConfig, SSEEvent } from '../types';

const BASE = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Topics ────────────────────────────────────────────────────────────────────

export const listTopics = () => req<Topic[]>('GET', '/topics');
export const createTopic = (title: string) => req<Topic>('POST', '/topics', { title });
export const updateTopic = (id: number, patch: Partial<Topic>) => req<void>('PUT', `/topics/${id}`, patch);
export const deleteTopic = (id: number) => req<void>('DELETE', `/topics/${id}`);

// ── Nodes ─────────────────────────────────────────────────────────────────────

export const getTopicTree = (topicId: number) => req<Node[]>('GET', `/nodes/topic/${topicId}`);
export const getNodePath = (nodeId: number) => req<Node[]>('GET', `/nodes/${nodeId}/path`);
export const getSubtreeCount = (nodeId: number) => req<{ count: number }>('GET', `/nodes/${nodeId}/subtree-count`);
export const deleteNode = (nodeId: number) => req<void>('DELETE', `/nodes/${nodeId}`);
export const updateNode = (nodeId: number, patch: Partial<Node>) => req<void>('PUT', `/nodes/${nodeId}`, patch);

// ── Settings ──────────────────────────────────────────────────────────────────

export const getSettings = () => req<Record<string, string>>('GET', '/settings');
export const setSetting = (key: string, value: unknown) => req<void>('POST', '/settings', { key, value });
export const bulkSetSettings = (entries: Record<string, unknown>) => req<void>('POST', '/settings/bulk', entries);

// ── Providers ─────────────────────────────────────────────────────────────────

export const testProvider = (config: Partial<ProviderConfig>) =>
  req<{ ok: boolean; latency: number; error?: string }>('POST', '/providers/test', config);

export const fetchModels = (config: Partial<ProviderConfig>) =>
  req<{ id: string; name: string }[]>('POST', '/providers/models', config);

// ── Export / Import ───────────────────────────────────────────────────────────

export const exportData = () => req<unknown>('GET', '/export');
export const importData = (data: unknown) => req<void>('POST', '/import', data);

// ── Chat stream ───────────────────────────────────────────────────────────────

export interface ChatStreamParams {
  topic_id: number;
  parent_node_id: number | null;
  user_content: string;
  provider_config: ProviderConfig;
}

export function chatStream(
  params: ChatStreamParams,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(`${BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;
            onEvent(event);
          } catch (_) {}
        }
      }

      resolve();
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') resolve();
      else reject(err);
    }
  });
}

export const abortChat = (nodeId: number, partialContent: string, nodeName: string) =>
  req<void>('POST', `/chat/abort/${nodeId}`, {
    partial_content: partialContent,
    node_name: nodeName,
  });
