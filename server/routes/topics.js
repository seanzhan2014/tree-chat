const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(db.listTopics());
  });

  router.post('/', (req, res) => {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    res.json(db.createTopic(title.trim()));
  });

  router.put('/:id', (req, res) => {
    db.updateTopic(Number(req.params.id), req.body);
    res.json({ ok: true });
  });

  router.delete('/:id', (req, res) => {
    db.deleteTopic(Number(req.params.id));
    res.json({ ok: true });
  });

  return router;
};
