const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');
const { AssignmentManager } = require('../../src/server/services/AssignmentManager');

test('thread summary exposes tags and contact completeness fields for local filtering', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-filter-summary-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try {
    db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-filter', 'Filter account', '/tmp/filter');
    db.prepare('INSERT INTO inbox_sources (id, owner_account_id, source_type, external_id, display_name, status) VALUES (?, ?, ?, ?, ?, ?)').run('page-filter', 'acct-filter', 'page_messenger', 'page-external-filter', 'Page filter', 'ACTIVE');
    db.prepare('INSERT INTO threads (id, account_id, source_id, contact_name, status, last_activity) VALUES (?, ?, ?, ?, ?, ?)').run('thread-filter', 'acct-filter', 'page-filter', 'Filter customer', 'UNPROCESSED', '2026-08-14T08:00:00.000Z');
    db.prepare('INSERT INTO contacts (thread_id, name, phone, email, address, tags) VALUES (?, ?, ?, ?, ?, ?)').run('thread-filter', 'Filter customer', '0901', null, 'Hà Nội', JSON.stringify(['VIP', 'Quan tâm']));

    const rows = new AssignmentManager(db).getThreadsByFilter('admin', 'ADMIN');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].phone, '0901');
    assert.equal(rows[0].email, null);
    assert.equal(rows[0].address, 'Hà Nội');
    assert.deepEqual(JSON.parse(rows[0].tags), ['VIP', 'Quan tâm']);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
