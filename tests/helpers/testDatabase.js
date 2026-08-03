const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function getTestDatabase(filename = ':memory:') {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  const schemaPath = path.join(__dirname, '../../src/server/database/schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  return db;
}

module.exports = { getTestDatabase };
