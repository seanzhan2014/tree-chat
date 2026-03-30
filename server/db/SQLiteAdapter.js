const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class SQLiteAdapter {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS topics (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT NOT NULL,
        last_node_id INTEGER,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id          INTEGER NOT NULL,
        parent_id         INTEGER,
        path              TEXT NOT NULL,
        node_name         TEXT,
        user_content      TEXT NOT NULL,
        assistant_content TEXT,
        model             TEXT,
        tokens_used       INTEGER,
        summary           TEXT,
        created_at        TEXT NOT NULL,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_topic  ON nodes(topic_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_path   ON nodes(path);
      CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
    `);
  }

  // ── Topics ──────────────────────────────────────────────────────────────

  createTopic(title) {
    const now = new Date().toISOString();
    const { lastInsertRowid } = this.db.prepare(
      'INSERT INTO topics (title, created_at, updated_at) VALUES (?, ?, ?)'
    ).run(title, now, now);
    return this.getTopic(lastInsertRowid);
  }

  getTopic(id) {
    return this.db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
  }

  listTopics() {
    return this.db.prepare('SELECT * FROM topics ORDER BY updated_at DESC').all();
  }

  updateTopic(id, patch) {
    const now = new Date().toISOString();
    const sets = ['updated_at = ?'];
    const vals = [now];
    if (patch.title !== undefined)        { sets.push('title = ?');        vals.push(patch.title); }
    if (patch.last_node_id !== undefined) { sets.push('last_node_id = ?'); vals.push(patch.last_node_id); }
    vals.push(id);
    this.db.prepare(`UPDATE topics SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  deleteTopic(id) {
    this.db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  }

  // ── Nodes ────────────────────────────────────────────────────────────────

  createNode({ topic_id, parent_id, user_content, node_name }) {
    const now = new Date().toISOString();
    let parentPath = '/';

    if (parent_id) {
      const parent = this.db.prepare('SELECT path, id FROM nodes WHERE id = ?').get(parent_id);
      if (!parent) throw new Error('Parent node not found');
      parentPath = parent.path + parent.id + '/';
    }

    const { lastInsertRowid } = this.db.prepare(
      'INSERT INTO nodes (topic_id, parent_id, path, node_name, user_content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(topic_id, parent_id || null, parentPath, node_name || null, user_content, now);

    return this.getNode(lastInsertRowid);
  }

  getNode(id) {
    return this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  }

  getTopicTree(topicId) {
    return this.db.prepare(
      'SELECT * FROM nodes WHERE topic_id = ? ORDER BY created_at ASC'
    ).all(topicId);
  }

  // Returns ordered array from root → nodeId
  getPathToNode(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return [];

    // path = "/3/7/" means ancestors are [3, 7]
    const ancestorIds = node.path.split('/').filter(Boolean).map(Number);
    const allIds = [...ancestorIds, nodeId];

    if (allIds.length === 1) return [node];

    const placeholders = allIds.map(() => '?').join(',');
    const nodes = this.db.prepare(
      `SELECT * FROM nodes WHERE id IN (${placeholders})`
    ).all(...allIds);

    // Sort by path depth (shorter = higher), then by id for same depth
    nodes.sort((a, b) => a.path.length - b.path.length || a.id - b.id);
    return nodes;
  }

  updateNode(id, patch) {
    const sets = [];
    const vals = [];
    if (patch.node_name         !== undefined) { sets.push('node_name = ?');         vals.push(patch.node_name); }
    if (patch.assistant_content !== undefined) { sets.push('assistant_content = ?'); vals.push(patch.assistant_content); }
    if (patch.model             !== undefined) { sets.push('model = ?');             vals.push(patch.model); }
    if (patch.tokens_used       !== undefined) { sets.push('tokens_used = ?');       vals.push(patch.tokens_used); }
    if (patch.summary           !== undefined) { sets.push('summary = ?');           vals.push(patch.summary); }
    if (!sets.length) return;
    vals.push(id);
    this.db.prepare(`UPDATE nodes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  deleteSubtree(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return;
    const prefix = node.path + nodeId + '/';
    this.db.prepare('DELETE FROM nodes WHERE id = ? OR path LIKE ?').run(nodeId, prefix + '%');
  }

  countSubtree(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return 0;
    const prefix = node.path + nodeId + '/';
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM nodes WHERE path LIKE ?'
    ).get(prefix + '%');
    return row.cnt; // descendants only (not the node itself)
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value);
  }

  getAllSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  // ── Migration ─────────────────────────────────────────────────────────────

  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      topics:   this.db.prepare('SELECT * FROM topics').all(),
      nodes:    this.db.prepare('SELECT * FROM nodes ORDER BY created_at ASC').all(),
      settings: this.db.prepare('SELECT * FROM settings').all(),
    };
  }

  importAll(data) {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM nodes').run();
      this.db.prepare('DELETE FROM topics').run();
      this.db.prepare('DELETE FROM settings').run();

      for (const t of (data.topics || [])) {
        this.db.prepare(
          'INSERT INTO topics (id, title, last_node_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(t.id, t.title, t.last_node_id, t.created_at, t.updated_at);
      }

      for (const n of (data.nodes || [])) {
        this.db.prepare(
          'INSERT INTO nodes (id, topic_id, parent_id, path, node_name, user_content, assistant_content, model, tokens_used, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(n.id, n.topic_id, n.parent_id, n.path, n.node_name, n.user_content, n.assistant_content, n.model, n.tokens_used, n.summary, n.created_at);
      }

      for (const s of (data.settings || [])) {
        this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
      }
    })();
  }
}

module.exports = { SQLiteAdapter };
