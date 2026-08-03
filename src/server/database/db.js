const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MEDIA_DIR = path.join(DATA_DIR, 'media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.db');
const dbExistedBeforeOpen = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0;
const db = new Database(DB_PATH);

// Bật WAL Mode & Synchronous Normal cho hiệu năng tối đa
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Backup legacy data before schema/migration code can alter the file.
let preMigrationBackupPath = null;
if (dbExistedBeforeOpen) {
  const migrationTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'").get();
  const currentVersion = migrationTable ? (db.prepare('SELECT MAX(version) AS version FROM migrations').get().version || 0) : 0;
  if (currentVersion < 7) {
    db.pragma('wal_checkpoint(TRUNCATE)');
    preMigrationBackupPath = DB_PATH + '.backup-' + Date.now();
    fs.copyFileSync(DB_PATH, preMigrationBackupPath);
    console.log('[DB] Backup created at ' + preMigrationBackupPath);
  }
}

// Nạp Schema SQL
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Initialize migrations table
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const migrations = [
  {
    version: 1,
    name: 'add_client_message_id',
    up: (db) => {
      try { db.exec("ALTER TABLE messages ADD COLUMN client_message_id TEXT;"); } catch(e) {}
    }
  },
  {
    version: 2,
    name: 'add_thread_url',
    up: (db) => {
      try { db.exec("ALTER TABLE threads ADD COLUMN thread_url TEXT;"); } catch(e) {}
    }
  },
  {
    version: 3,
    name: 'add_timestamp_ms',
    up: (db) => {
      try { db.exec("ALTER TABLE messages ADD COLUMN timestamp_ms INTEGER DEFAULT 0;"); } catch(e) {}
      try { db.exec("ALTER TABLE messages ADD COLUMN timestamp_source TEXT DEFAULT 'unknown';"); } catch(e) {}
    }
  },
  {
    version: 4,
    name: 'add_sync_fields_threads',
    up: (db) => {
      try { db.exec("ALTER TABLE threads ADD COLUMN sync_status TEXT DEFAULT 'LOCAL';"); } catch(e) {}
      try { db.exec("ALTER TABLE threads ADD COLUMN sync_cursor TEXT;"); } catch(e) {}
      try { db.exec("ALTER TABLE threads ADD COLUMN sync_error TEXT;"); } catch(e) {}
    }
  },
  {
    version: 5,
    name: 'update_fts_triggers',
    up: (db) => {
      db.exec("DROP TRIGGER IF EXISTS messages_ai;");
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ai_insert AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content, thread_id, sender_id)
            VALUES (new.id, new.content, new.thread_id, new.sender_id);
        END;
      `);
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ai_update AFTER UPDATE ON messages BEGIN
            UPDATE messages_fts SET content = new.content, thread_id = new.thread_id, sender_id = new.sender_id
            WHERE rowid = old.id;
        END;
      `);
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ai_delete AFTER DELETE ON messages BEGIN
            DELETE FROM messages_fts WHERE rowid = old.id;
        END;
      `);
    }
  },
  {
    version: 6,
    name: 'cleanup_accessibility_label_content',
    up: (db) => {
      const rows = db.prepare("SELECT id, content FROM messages WHERE content LIKE 'Tin nhắn do % gửi lúc %' OR content LIKE 'Message sent by % at %'").all();
      const update = db.prepare('UPDATE messages SET content = ? WHERE id = ?');
      const remove = db.prepare('DELETE FROM messages WHERE id = ?');
      for (const row of rows) {
        const match = String(row.content || '').match(/^(?:Nhập,\s*)?(?:Tin nhắn do [^\n]+? gửi lúc|Message sent by [^\n]+? at) [^:\n]*:\s*([\s\S]*)$/i);
        const clean = match ? match[1].trim() : String(row.content || '').trim();
        if (clean) update.run(clean, row.id);
        else remove.run(row.id);
      }
      console.log('[DB] Cleaned ' + rows.length + ' accessibility-label message rows.');
    }
  },
  {
    version: 7,
    name: 'cleanup_delivery_status_content',
    // This migration intentionally removes known Facebook UI metadata rows.
    allowsMessageRowReduction: true,
    up: (db) => {
      const rows = db.prepare("SELECT id, content FROM messages WHERE content LIKE 'Đã gửi % trước' OR content LIKE 'Đã nhận % trước' OR content LIKE 'Đã xem % trước' OR content LIKE 'Sent % ago'").all();
      const remove = db.prepare('DELETE FROM messages WHERE id = ?');
      for (const row of rows) {
        if (/^(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen)\s+\d+\s+(?:giây|phút|giờ|ngày|tuần|tháng|năm)\s+(?:trước|ago)$/i.test(String(row.content || '').trim())) remove.run(row.id);
      }
      console.log('[DB] Removed ' + rows.length + ' delivery-status message rows.');
    }
  }
];

function runMigrations() {
  const getVersion = db.prepare('SELECT MAX(version) as version FROM migrations').get();
  let currentVersion = getVersion.version || 0;
  
  const pending = migrations.filter(m => m.version > currentVersion);
  if (pending.length > 0) {
    const beforeCounts = {
      threads: db.prepare('SELECT COUNT(*) AS count FROM threads').get().count,
      messages: db.prepare('SELECT COUNT(*) AS count FROM messages').get().count
    };
    console.log(`[DB] Found ${pending.length} pending migrations.`);
    
    const insertMigration = db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)');
    const migrate = db.transaction((pendingMigrations) => {
      for (const m of pendingMigrations) {
        console.log(`[DB] Running migration v${m.version}: ${m.name}`);
        m.up(db);
        insertMigration.run(m.version, m.name);
      }
    });

    try {
      migrate(pending);
      console.log('[DB] Migrations applied successfully.');
      
      // Integrity check
      const integrity = db.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') {
        throw new Error('SQLite integrity check failed: ' + integrity);
      }
      const afterCounts = {
        threads: db.prepare('SELECT COUNT(*) AS count FROM threads').get().count,
        messages: db.prepare('SELECT COUNT(*) AS count FROM messages').get().count
      };
      const expectedMessageReduction = pending.some(m => m.allowsMessageRowReduction);
      if (afterCounts.threads < beforeCounts.threads || (afterCounts.messages < beforeCounts.messages && !expectedMessageReduction)) {
        throw new Error('Migration reduced persisted thread/message row counts');
      }
    } catch (err) {
      console.error('[DB] Migration failed; startup aborted to protect persisted data:', err);
      throw err;
    }
  }
}

runMigrations();

// Tạo index hỗ trợ query messages sau khi đảm bảo các cột đã tồn tại
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_thread_timestamp 
  ON messages(thread_id, timestamp_ms, created_at, id);
`);

// Thêm Admin mặc định nếu CSDL chưa có user
const adminCheck = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'").get();
if (adminCheck.count === 0) {
  const defaultPassword = 'admin';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'ADMIN')").run('admin', passwordHash);
  console.log('[DB] Khởi tạo tài khoản Admin mặc định thành công (username: admin / pass: admin)');
}

console.log('[DB] CSDL SQLite đã sẵn sàng (WAL Mode, FTS5 enabled):', DB_PATH);

module.exports = db;
