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

const clientUserColumns = db.prepare('PRAGMA table_info(client_users)').all();
if (!clientUserColumns.some((column) => column.name === 'license_id')) {
  db.exec('ALTER TABLE client_users ADD COLUMN license_id INTEGER REFERENCES licenses(id) ON DELETE SET NULL');
}
if (!clientUserColumns.some((column) => column.name === 'company_admin_id')) {
  db.exec('ALTER TABLE client_users ADD COLUMN company_admin_id INTEGER REFERENCES client_users(id) ON DELETE CASCADE');
}
if (!clientUserColumns.some((column) => column.name === 'company_role')) {
  db.exec("ALTER TABLE client_users ADD COLUMN company_role TEXT NOT NULL DEFAULT 'ADMIN' CHECK(company_role IN ('ADMIN','EMPLOYEE'))");
}

const orderColumns = db.prepare('PRAGMA table_info(orders)').all();
if (!orderColumns.some((column) => column.name === 'order_type')) {
  db.exec("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'NEW'");
}
if (!orderColumns.some((column) => column.name === 'target_license_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN target_license_id INTEGER REFERENCES licenses(id)');
}

console.log('[LicenseDB] SQLite Database ready:', DB_PATH);

module.exports = db;
