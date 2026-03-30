const { BaseAdapter } = require('./BaseAdapter');

// Build the full chat completions URL from a user-supplied baseUrl.
// Handles cases like:
//   https://api.openai.com            → .../v1/chat/completions
//   https://api.fireworks.ai/inference/v1 → .../chat/completions  (no double /v1)
//   https://api.fireworks.ai/inference → .../v1/chat/completions
//   https://custom.host/v1/chat/completions → used as-is
function buildChatUrl(baseUrl) {
  let url = (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
  if (url.endsWith('/chat/completions')) return url;
  if (url.endsWith('/v1'))              return `${url}/chat/completions`;
  return `${url}/v1/chat/completions`;
}

function buildModelsUrl(baseUrl) {
  let url = (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
  // Strip /chat/completions if present
  url = url.replace(/\/chat\/completions$/, '');
  if (url.endsWith('/v1')) return `${url}/models`;
  return `${url}/v1/models`;
}

class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.baseUrl = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
  }

  async *chatStream(messages, options = {}) {
    const response = await fetch(buildChatUrl(this.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: options.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${text}`);
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
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch (_) {}
      }
    }
  }

  async listModels() {
    const res = await fetch(buildModelsUrl(this.baseUrl), {
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    return (data.data || []).map(m => ({ id: m.id, name: m.id }));
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

module.exports = { OpenAIAdapter };
