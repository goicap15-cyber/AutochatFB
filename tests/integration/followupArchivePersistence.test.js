const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const FollowupService = require('../../src/server/services/FollowupService');

function withService(run) {
  const db = getTestDatabase();
  try {
    db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('account-followup', 'Follow-up test', '/tmp/followup');
    db.prepare(`INSERT INTO threads (id, account_id, contact_name, status)
      VALUES (?, ?, ?, 'UNPROCESSED')`).run('thread-followup', 'account-followup', 'Khách hàng test');
    return run(new FollowupService(db), db);
  } finally {
    db.close();
  }
}

test('creates and updates the one active reminder for a conversation', () => withService((service) => {
  const now = Date.parse('2026-08-14T08:00:00.000Z');
  const first = service.setReminder('thread-followup', '2026-08-14T09:00:00.000Z', 'Gọi lại', now);
  const second = service.setReminder('thread-followup', '2026-08-14T10:00:00.000Z', 'Báo giá', now);
  assert.equal(first.status, 'active');
  assert.equal(second.note, 'Báo giá');
  assert.equal(service.db.prepare('SELECT COUNT(*) AS count FROM conversation_reminders').get().count, 1);
}));

test('rejects past reminders and notes longer than 200 characters', () => withService((service) => {
  const now = Date.parse('2026-08-14T08:00:00.000Z');
  assert.throws(() => service.setReminder('thread-followup', '2026-08-14T07:59:59.000Z', '', now), /tương lai/);
  assert.throws(() => service.setReminder('thread-followup', '2026-08-14T09:00:00.000Z', 'x'.repeat(201), now), /200/);
}));

test('completes or cancels an active reminder and permits a later replacement', () => withService((service) => {
  const now = Date.parse('2026-08-14T08:00:00.000Z');
  service.setReminder('thread-followup', '2026-08-14T09:00:00.000Z', '', now);
  assert.deepEqual(service.completeReminder('thread-followup'), { success: true });
  assert.equal(service.db.prepare('SELECT status FROM conversation_reminders WHERE thread_id=?').get('thread-followup').status, 'completed');
  service.setReminder('thread-followup', '2026-08-14T10:00:00.000Z', '', now);
  assert.deepEqual(service.cancelReminder('thread-followup'), { success: true });
  assert.equal(service.db.prepare('SELECT status FROM conversation_reminders WHERE thread_id=?').get('thread-followup').status, 'cancelled');
}));

test('archives locally, restores manually, and restores automatically only when an incoming message arrives', () => withService((service) => {
  assert.ok(service.archive('thread-followup').archived_at);
  assert.equal(service.restoreOnIncoming('thread-followup'), true);
  assert.equal(service.db.prepare('SELECT archived_at FROM threads WHERE id=?').get('thread-followup').archived_at, null);
  service.archive('thread-followup');
  assert.deepEqual(service.restore('thread-followup'), { archived_at: null });
  assert.equal(service.restoreOnIncoming('thread-followup'), false);
}));
