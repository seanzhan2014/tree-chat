const express = require('express');
const { createAdapter } = require('../llm');

module.exports = (db) => {
  const router = express.Router();

  // Test a provider connection
  router.post('/test', async (req, res) => {
    const { provider, apiKey, baseUrl, model } = req.body;
    if (!provider || !apiKey || !model) {
      return res.status(400).json({ error: 'provider, apiKey, model required' });
    }
    try {
      const adapter = createAdapter({ provider, apiKey, baseUrl, model });
      const result = await adapter.testConnection();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // Fetch available models for a provider
  router.post('/models', async (req, res) => {
    const { provider, apiKey, baseUrl, model } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider and apiKey required' });
    }
    try {
      const adapter = createAdapter({ provider, apiKey, baseUrl, model: model || 'gpt-4o' });
      const models = await adapter.listModels();
      res.json(models);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
