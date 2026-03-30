const { OpenAIAdapter } = require('./OpenAIAdapter');

// Qianwen (Alibaba Cloud DashScope) is OpenAI-compatible
class QianwenAdapter extends OpenAIAdapter {
  constructor(config) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode',
    });
  }

  async listModels() {
    // Try the API first, fall back to known models
    try {
      return await super.listModels();
    } catch (_) {
      return [
        { id: 'qwen-max',        name: 'Qwen Max' },
        { id: 'qwen-plus',       name: 'Qwen Plus' },
        { id: 'qwen-turbo',      name: 'Qwen Turbo' },
        { id: 'qwen-long',       name: 'Qwen Long' },
        { id: 'qwq-plus',        name: 'QwQ Plus' },
        { id: 'qwq-32b',         name: 'QwQ 32B' },
      ];
    }
  }
}

module.exports = { QianwenAdapter };
