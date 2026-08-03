const test = require('node:test');
const assert = require('node:assert/strict');
const HistorySyncManager = require('../../src/server/services/HistorySyncManager');
const ConversationRepository = require('../../src/server/repositories/ConversationRepository');
const { getTestDatabase } = require('../helpers/testDatabase');

test('Incremental Sync - cursor transitions retain checkpoint on failure', () => {
  const db = getTestDatabase();
  db.prepare("INSERT INTO accounts (id, name, profile_dir) VALUES ('acc_1', 'Acc 1', '/tmp')").run();
  db.prepare("INSERT INTO threads (id, account_id) VALUES ('thread_1', 'acc_1')").run();
  const cursor = { mode: 'incremental', newest_timestamp_ms: 1000, oldest_timestamp_ms: 500, newest_message_id: 'msg_10', oldest_message_id: 'msg_1' };
  assert.equal(HistorySyncManager.getSyncState('thread_1', db).sync_status, 'LOCAL');
  HistorySyncManager.updateSyncStatus('thread_1', 'SYNCED', cursor, null, db);
  assert.deepEqual(HistorySyncManager.getSyncState('thread_1', db).sync_cursor, cursor);
  HistorySyncManager.updateSyncStatus('thread_1', 'FAILED', null, 'timeout', db);
  const failed = HistorySyncManager.getSyncState('thread_1', db);
  assert.equal(failed.sync_status, 'FAILED');
  assert.equal(failed.sync_error, 'timeout');
  assert.deepEqual(failed.sync_cursor, cursor);
  db.close();
});

test('Incremental Sync - unchanged batches report skipped and do not duplicate', () => {
  const db = getTestDatabase();
  db.prepare("INSERT INTO accounts (id, name, profile_dir) VALUES ('acc_2', 'Acc 2', '/tmp')").run();
  db.prepare("INSERT INTO threads (id, account_id) VALUES ('thread_2', 'acc_2')").run();
  const batch = [
    { fb_message_id: 'msg_1', content: 'hello', timestamp_ms: 1000, sender_id: 'a' },
    { fb_message_id: 'msg_2', content: 'world', timestamp_ms: 2000, sender_id: 'a' }
  ];
  const first = ConversationRepository.saveMessagesTransaction('thread_2', batch, db);
  assert.deepEqual(first.insertedIds, ['msg_1', 'msg_2']);
  const second = ConversationRepository.saveMessagesTransaction('thread_2', batch, db);
  assert.equal(second.insertedIds.length, 0);
  assert.equal(second.updatedIds.length, 0);
  assert.equal(second.skippedCount, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM messages WHERE thread_id = 'thread_2'").get().count, 2);
  db.close();
});
