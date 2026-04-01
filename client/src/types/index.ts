export interface Topic {
  id: number;
  title: string;
  last_node_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Node {
  id: number;
  topic_id: number;
  parent_id: number | null;
  path: string;
  node_name: string | null;
  user_content: string;
  assistant_content: string | null;
  reasoning_content: string | null;
  thinking_seconds: number | null;
  model: string | null;
  tokens_used: number | null;
  summary: string | null;
  created_at: string;
}

// A node enriched with its children for tree rendering
export interface TreeNode extends Node {
  children: TreeNode[];
}

export type Provider = 'openai' | 'anthropic' | 'qianwen' | 'custom';

export interface ProviderConfig {
  id: string;           // unique key, e.g. "openai", "anthropic", "custom_1"
  name: string;         // display name
  provider: Provider;   // adapter type
  apiKey: string;
  baseUrl: string;
  model: string;
  contextLimit: number;
  maxTokens: number;
  // Reserved for future use:
  encrypted?: boolean;
}

export interface AppSettings {
  providers: ProviderConfig[];
  activeProviderId: string;
  systemPrompt: string;
  theme: 'light' | 'dark' | 'system';
  nodeName: {
    language: 'auto' | 'en' | 'zh';
    maxWords: number;    // English
    maxChars: number;    // Chinese
  };
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o',
    contextLimit: 128000,
    maxTokens: 4096,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    contextLimit: 200000,
    maxTokens: 4096,
  },
  {
    id: 'qianwen',
    name: '通义千问',
    provider: 'qianwen',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    model: 'qwen-max',
    contextLimit: 32000,
    maxTokens: 2048,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  providers: DEFAULT_PROVIDERS,
  activeProviderId: 'openai',
  systemPrompt: '',
  theme: 'system',
  nodeName: { language: 'auto', maxWords: 3, maxChars: 5 },
};

// SSE event types from server
export type SSEEvent =
  | { type: 'node_created'; node_id: number }
  | { type: 'node_name'; name: string }
  | { type: 'reasoning_token'; content: string }
  | { type: 'token'; content: string }
  | { type: 'done'; tokens: number; thinking_seconds: number }
  | { type: 'error'; message: string };
