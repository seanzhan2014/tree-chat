class BaseAdapter {
  constructor(config) {
    // config: { apiKey, baseUrl, model }
    this.config = config;
  }

  // Async generator yielding string tokens
  async *chatStream(messages, options = {}) {
    throw new Error('chatStream() not implemented');
  }

  async listModels() {
    throw new Error('listModels() not implemented');
  }

  async testConnection() {
    throw new Error('testConnection() not implemented');
  }
}

module.exports = { BaseAdapter };
