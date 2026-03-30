const { OpenAIAdapter }    = require('./OpenAIAdapter');
const { AnthropicAdapter } = require('./AnthropicAdapter');
const { QianwenAdapter }   = require('./QianwenAdapter');

function createAdapter(providerConfig) {
  const { provider, apiKey, baseUrl, model } = providerConfig;
  const config = { apiKey, baseUrl, model };

  switch (provider) {
    case 'anthropic': return new AnthropicAdapter(config);
    case 'qianwen':   return new QianwenAdapter(config);
    case 'openai':
    default:          return new OpenAIAdapter(config);
  }
}

module.exports = { createAdapter, OpenAIAdapter, AnthropicAdapter, QianwenAdapter };
