const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function initDb() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, 'statuspulse.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL UNIQUE,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suggestion_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
      ip_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(suggestion_id, ip_hash)
    );

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      services TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_status_log_service
      ON status_log(service_id, checked_at DESC);

    CREATE INDEX IF NOT EXISTS idx_suggestions_normalized
      ON suggestions(name_normalized);
  `);

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

module.exports = { initDb, getDb };
