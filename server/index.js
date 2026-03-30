const express = require('express');
const cors = require('cors');
const path = require('path');
const { SQLiteAdapter } = require('./db/SQLiteAdapter');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'treechat.db');

const db = new SQLiteAdapter(DB_PATH);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/topics', require('./routes/topics')(db));
app.use('/api/nodes', require('./routes/nodes')(db));
app.use('/api/chat', require('./routes/chat')(db));
app.use('/api/settings', require('./routes/settings')(db));
app.use('/api/providers', require('./routes/providers')(db));

// Export/Import for migration
app.get('/api/export', (req, res) => {
  res.json(db.exportAll());
});

app.post('/api/import', (req, res) => {
  try {
    db.importAll(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Serve client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Tree Chat server running on http://localhost:${PORT}`);
});
