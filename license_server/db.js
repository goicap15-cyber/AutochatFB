const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'license.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Migration an toàn cho database đã tồn tại trước khi có tên công ty.
const licenseColumns = db.prepare('PRAGMA table_info(licenses)').all();
if (!licenseColumns.some((column) => column.name === 'company_name')) {
  db.exec('ALTER TABLE licenses ADD COLUMN company_name TEXT');
}

// Giữ nguyên cách tính cũ trên database hiện có cho tới khi Admin đổi giá slot.
const pricingColumns = db.prepare('PRAGMA table_info(pricing_settings)').all();
if (!pricingColumns.some((column) => column.name === 'extra_slot_price')) {
  db.exec('ALTER TABLE pricing_settings ADD COLUMN extra_slot_price INTEGER NOT NULL DEFAULT 99000');
}

console.log('[LicenseDB] SQLite Database ready:', DB_PATH);

module.exports = db;
