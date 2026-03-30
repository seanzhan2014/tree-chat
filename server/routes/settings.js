const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(db.getAllSettings());
  });

  router.post('/', (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    db.setSetting(key, typeof value === 'string' ? value : JSON.stringify(value));
    res.json({ ok: true });
  });

  // Bulk update
  router.post('/bulk', (req, res) => {
    const entries = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(entries)) {
      db.setSetting(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    res.json({ ok: true });
  });

  return router;
};
