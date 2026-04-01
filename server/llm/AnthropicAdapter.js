const { BaseAdapter } = require('./BaseAdapter');

const KNOWN_MODELS = [
  { id: 'claude-opus-4-6',            name: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6',          name: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001',  name: 'Claude Haiku 4.5' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022',  name: 'Claude 3.5 Haiku' },
];

class AnthropicAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  }

  async *chatStream(messages, options = {}) {
    // Anthropic: separate system message from messages array
    let systemContent = '';
    const chatMessages = messages.filter(m => {
      if (m.role === 'system') { systemContent += (systemContent ? '\n\n' : '') + m.content; return false; }
      return true;
    });

    const body = {
      model: this.config.model,
      messages: chatMessages,
      stream: true,
      max_tokens: options.maxTokens || 4096,
    };
    if (systemContent) body.system = systemContent;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { type: 'content', content: parsed.delta.text };
          }
        } catch (_) {}
      }
    }
  }

  async listModels() {
    // Anthropic has a models list endpoint (beta)
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (res.ok) {
        const data = await res.json();
        return (data.data || []).map(m => ({ id: m.id, name: m.display_name || m.id }));
      }
    } catch (_) {}
    return KNOWN_MODELS;
  }

  async testConnection() {
    const start = Date.now();
    try {
      await this.listModels();
      return { ok: true, latency: Date.now() - start };
    } catch (e) {
      return { ok: false, latency: Date.now() - start, error: e.message };
    }
  }
}

module.exports = { AnthropicAdapter };
