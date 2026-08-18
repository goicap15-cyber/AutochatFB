const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ensureMessageDirectionStatus } = require('../../src/server/database/messageDirectionMigration');

test('legacy messages receive confirmed direction status without changing is_outgoing', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, is_outgoing INTEGER NOT NULL DEFAULT 0)');
  db.prepare('INSERT INTO messages (is_outgoing) VALUES (?)').run(1);

  ensureMessageDirectionStatus(db);
  ensureMessageDirectionStatus(db);

  assert.deepEqual(db.prepare('SELECT is_outgoing, direction_status FROM messages').get(), {
    is_outgoing: 1,
    direction_status: 'confirmed'
  });
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  db.close();
});
