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
    // Seed prerequisite account
    db.prepare('INSERT OR IGNORE INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test Account', '/tmp/test');
    return run(db, filename);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper ensuring parent thread exists before contact insert
function ensureThread(threadId, contactName, db) {
  db.prepare(`
    INSERT OR IGNORE INTO threads (id, account_id, contact_name, status, is_unread)
    VALUES (?, ?, ?, 'UNPROCESSED', 1)
  `).run(threadId, 'acct-1', contactName || 'Test User');
}

// The integration suite uses the same persistence boundary as the Express route.
function updateContact(threadId, payload, db) {
  ensureThread(threadId, payload.name, db);
  return ContactService.update(threadId, payload, db);
}

test('persists and retrieves lead tags as JSON array', () => withDatabase((db) => {
  const saved = updateContact('t-1', {
    name: 'Nguyễn Văn A',
    tags: ['Tiềm năng', 'Khách VIP', 'Hà Nội']
  }, db);

  assert.equal(saved.thread_id, 't-1');
  assert.equal(saved.name, 'Nguyễn Văn A');
  assert.deepEqual(JSON.parse(saved.tags), ['Tiềm năng', 'Khách VIP', 'Hà Nội']);
}));

test('clears tags with empty array without deleting other contact fields', () => withDatabase((db) => {
  updateContact('t-2', {
    name: 'Trần Thị B',
    phone: '0912345678',
    email: 'b@example.com',
    notes: 'Khách quan tâm sản phẩm A',
    tags: ['Quan tâm', 'Cần tư vấn'],
    lead_captured: true
  }, db);

  const cleared = updateContact('t-2', {
    phone: '0912345678',
    email: 'b@example.com',
    notes: 'Khách quan tâm sản phẩm A',
    tags: [],
    lead_captured: true
  }, db);

  assert.deepEqual(JSON.parse(cleared.tags), []);
  assert.equal(cleared.name, 'Trần Thị B');
  assert.equal(cleared.phone, '0912345678');
  assert.equal(cleared.email, 'b@example.com');
  assert.equal(cleared.notes, 'Khách quan tâm sản phẩm A');
  assert.equal(cleared.lead_captured, 1);
}));

test('survives database reopen (round-trip reload)', () => withDatabase((db, filename) => {
  updateContact('t-3', {
    name: 'Lê Văn C',
    tags: ['Khách sỉ', 'Đã cọc 50%']
  }, db);
  db.close();

  const reopenedDb = getTestDatabase(filename);
  try {
    const row = reopenedDb.prepare('SELECT * FROM contacts WHERE thread_id = ?').get('t-3');
    assert.deepEqual(JSON.parse(row.tags), ['Khách sỉ', 'Đã cọc 50%']);
  } finally {
    reopenedDb.close();
  }
}));

test('preserves status_id independently of tags', () => withDatabase((db) => {
  db.prepare('INSERT INTO lead_statuses (name, color) VALUES (?, ?)').run('Đã chốt', '#0FBD74');
  const status = db.prepare('SELECT id FROM lead_statuses WHERE name = ?').get('Đã chốt');

  const contact = updateContact('t-4', {
    name: 'Phạm D',
    status_id: status.id,
    tags: ['VIP', 'Hỏi giá']
  }, db);

  assert.equal(contact.status_id, status.id);
  assert.deepEqual(JSON.parse(contact.tags), ['VIP', 'Hỏi giá']);

  // Update tags only, ensure status_id remains
  const updatedTags = updateContact('t-4', {
    status_id: status.id,
    tags: ['VIP', 'Đã mua']
  }, db);

  assert.equal(updatedTags.status_id, status.id);
  assert.deepEqual(JSON.parse(updatedTags.tags), ['VIP', 'Đã mua']);
}));

test('normalizes non-array tags at the server boundary instead of storing malformed JSON', () => withDatabase((db) => {
  const contact = updateContact('t-5', { name: 'Safe Tags', tags: 'not-an-array' }, db);
  assert.deepEqual(JSON.parse(contact.tags), []);
}));
