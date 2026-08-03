const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');
const ConversationRepository = require('../../src/server/repositories/ConversationRepository');

function withDatabase(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-test-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try { return run(db); } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('local-first reload retains conversations and deduplicates history', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-1', account_id: 'acct-1', contact_name: 'Alice' }, db);
  const messages = [
    { fb_message_id: 'fb-1', sender_id: 'alice', content: 'Xin chào', timestamp_ms: 1000 },
    { fb_message_id: 'fb-2', sender_id: 'acct-1', content: 'Chào bạn', timestamp_ms: 2000, is_outgoing: true }
  ];
  ConversationRepository.saveMessagesTransaction('thread-1', messages, db);
  ConversationRepository.saveMessagesTransaction('thread-1', messages, db);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM threads').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages').get().count, 2);
  assert.deepEqual(ConversationRepository.getMessages('thread-1', 50, 0, db).map(m => m.fb_message_id), ['fb-1', 'fb-2']);
}));

test('offline-read retains persisted rows after database reopen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-test-'));
  const filename = path.join(dir, 'database.db');
  let db = getTestDatabase(filename);
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-1', account_id: 'acct-1', contact_name: 'Alice' }, db);
  ConversationRepository.saveMessagesTransaction('thread-1', [{ content: 'Lưu cục bộ', sender_id: 'alice', timestamp_ms: 1000 }], db);
  db.close();
  db = getTestDatabase(filename);
  assert.equal(db.prepare('SELECT contact_name FROM threads WHERE id = ?').get('thread-1').contact_name, 'Alice');
  assert.equal(db.prepare('SELECT content FROM messages WHERE thread_id = ?').get('thread-1').content, 'Lưu cục bộ');
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
