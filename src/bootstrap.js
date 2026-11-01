const SQL = [
"CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,provider TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
"CREATE INDEX IF NOT EXISTS idx_messages_id ON messages(id)",
"CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content,content='messages',content_rowid='id')",
"CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN INSERT INTO messages_fts(rowid,content) VALUES(new.id,new.content); END",
"CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN INSERT INTO messages_fts(messages_fts,rowid,content) VALUES('delete',old.id,old.content); END",
"CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY,content TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,status TEXT DEFAULT 'queued',provider TEXT DEFAULT 'auto',result TEXT DEFAULT '',error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY,mission_id TEXT NOT NULL,agent_id TEXT NOT NULL,status TEXT DEFAULT 'queued',output TEXT DEFAULT '',provider TEXT,started_at TEXT,finished_at TEXT,FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE)",
"CREATE INDEX IF NOT EXISTS idx_agent_runs_mission ON agent_runs(mission_id)",
"CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT,agent_id TEXT NOT NULL,mission_id TEXT,description TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)",
"INSERT OR IGNORE INTO settings(key,value) VALUES('provider','auto')"
];
export async function ensureSchema(db){
 try {await db.prepare('SELECT key FROM settings LIMIT 1').first();return;}
 catch(err){if(!/no such table|does not exist/i.test(String(err.message||err)))throw err;}
 for(const statement of SQL)await db.prepare(statement).run();
}
