const path = require('path');
const fs = require('fs');
const os = require('os');

// Config stored in ~/.tree-chat/ — isolated from all other projects
const CONFIG_DIR = path.join(os.homedir(), '.tree-chat');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default DB: next to server/index.js (project-local, not cloud-synced)
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'treechat.db');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getDbPath() {
  // Environment variable takes highest priority (Docker / CLI usage)
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const config = readConfig();
  return config.dbPath || DEFAULT_DB_PATH;
}

function setDbPath(newPath) {
  const config = readConfig();
  config.dbPath = newPath;
  writeConfig(config);
}

module.exports = { getDbPath, setDbPath, readConfig, DEFAULT_DB_PATH };
