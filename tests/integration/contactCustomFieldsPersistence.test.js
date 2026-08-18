const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');
const ContactService = require('../../src/server/services/ContactService');

function withDatabase(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-test-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try {
    db.prepare('INSERT OR IGNORE INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test Account', '/tmp/test');
    return run(db, filename);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function ensureThread(threadId, contactName, db) {
  db.prepare(`
    INSERT OR IGNORE INTO threads (id, account_id, contact_name, status, is_unread)
    VALUES (?, ?, ?, 'UNPROCESSED', 1)
  `).run(threadId, 'acct-1', contactName || 'Test User');
}

function updateContact(threadId, payload, db) {
  ensureThread(threadId, payload.name, db);
  return ContactService.update(threadId, payload, db);
}

test('persists and retrieves custom fields as JSON array of {label, value} pairs', () => withDatabase((db) => {
  const saved = updateContact('t-1', {
    name: 'Nguyễn Văn A',
    custom_fields: [{ label: 'Công ty', value: 'ABC Corp' }, { label: 'Ngày sinh', value: '01/01/1990' }]
  }, db);

  assert.equal(saved.thread_id, 't-1');
  assert.deepEqual(JSON.parse(saved.custom_fields), [
    { label: 'Công ty', value: 'ABC Corp' },
    { label: 'Ngày sinh', value: '01/01/1990' }
  ]);
}));

test('clears custom fields with empty array without deleting other contact fields', () => withDatabase((db) => {
  updateContact('t-2', {
    name: 'Trần Thị B',
    phone: '0912345678',
    tags: ['Quan tâm'],
    custom_fields: [{ label: 'Công ty', value: 'XYZ' }]
  }, db);

  const cleared = updateContact('t-2', {
    phone: '0912345678',
    tags: ['Quan tâm'],
    custom_fields: []
  }, db);

  assert.deepEqual(JSON.parse(cleared.custom_fields), []);
  assert.equal(cleared.name, 'Trần Thị B');
  assert.equal(cleared.phone, '0912345678');
  assert.deepEqual(JSON.parse(cleared.tags), ['Quan tâm']);
}));

test('survives database reopen (round-trip reload)', () => withDatabase((db, filename) => {
  updateContact('t-3', {
    name: 'Lê Văn C',
    custom_fields: [{ label: 'Ghi chú riêng', value: 'Khách hàng lâu năm' }]
  }, db);
  db.close();

  const reopenedDb = getTestDatabase(filename);
  try {
    const row = reopenedDb.prepare('SELECT * FROM contacts WHERE thread_id = ?').get('t-3');
    assert.deepEqual(JSON.parse(row.custom_fields), [{ label: 'Ghi chú riêng', value: 'Khách hàng lâu năm' }]);
  } finally {
    reopenedDb.close();
  }
}));

test('preserves custom_fields independently of tags and status_id updates', () => withDatabase((db) => {
  db.prepare('INSERT INTO lead_statuses (name, color) VALUES (?, ?)').run('Đã chốt', '#0FBD74');
  const status = db.prepare('SELECT id FROM lead_statuses WHERE name = ?').get('Đã chốt');

  const contact = updateContact('t-4', {
    name: 'Phạm D',
    status_id: status.id,
    tags: ['VIP'],
    custom_fields: [{ label: 'Công ty', value: 'ABC' }]
  }, db);

  assert.deepEqual(JSON.parse(contact.custom_fields), [{ label: 'Công ty', value: 'ABC' }]);

  // Update tags only, ensure custom_fields survives untouched when re-sent unchanged
  const updated = updateContact('t-4', {
    status_id: status.id,
    tags: ['VIP', 'Đã mua'],
    custom_fields: [{ label: 'Công ty', value: 'ABC' }]
  }, db);

  assert.equal(updated.status_id, status.id);
  assert.deepEqual(JSON.parse(updated.tags), ['VIP', 'Đã mua']);
  assert.deepEqual(JSON.parse(updated.custom_fields), [{ label: 'Công ty', value: 'ABC' }]);
}));

test('normalizes non-array custom_fields at the server boundary instead of storing malformed JSON', () => withDatabase((db) => {
  const contact = updateContact('t-5', { name: 'Safe Fields', custom_fields: 'not-an-array' }, db);
  assert.deepEqual(JSON.parse(contact.custom_fields), []);
}));

test('defaults custom_fields to empty array when omitted entirely', () => withDatabase((db) => {
  const contact = updateContact('t-6', { name: 'No Custom Fields' }, db);
  assert.deepEqual(JSON.parse(contact.custom_fields), []);
}));
