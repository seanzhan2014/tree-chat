const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Get all nodes for a topic (flat array; client builds the tree)
  router.get('/topic/:topicId', (req, res) => {
    res.json(db.getTopicTree(Number(req.params.topicId)));
  });

  // Get ordered path from root to a node
  router.get('/:id/path', (req, res) => {
    res.json(db.getPathToNode(Number(req.params.id)));
  });

  // Count descendants (for deletion warning)
  router.get('/:id/subtree-count', (req, res) => {
    res.json({ count: db.countSubtree(Number(req.params.id)) });
  });

  router.post('/', (req, res) => {
    const { topic_id, parent_id, user_content, node_name } = req.body;
    if (!topic_id || !user_content) return res.status(400).json({ error: 'topic_id and user_content required' });
    res.json(db.createNode({ topic_id, parent_id, user_content, node_name }));
  });

  router.put('/:id', (req, res) => {
    db.updateNode(Number(req.params.id), req.body);
    res.json({ ok: true });
  });

  router.delete('/:id', (req, res) => {
    db.deleteSubtree(Number(req.params.id));
    res.json({ ok: true });
  });

  return router;
};
