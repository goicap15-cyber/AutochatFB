const test = require('node:test');
const assert = require('node:assert/strict');
const MessageQueueRepository = require('../../src/server/repositories/MessageQueueRepository');
const { seedPageThread, withCampaignDatabase } = require('./campaignTestUtils');

function dispatchPayload() {
  return {
    thread_id: 'thread-atomic',
    account_id: 'acct-1',
    source_id: 'src-page-1',
    source_type: 'page_messenger',
    page_id: 'page-1',
    content: 'Atomic campaign send',
    campaign_id: 'campaign-atomic',
    campaign_recipient_id: 'recipient-atomic',
    campaign_attempt_id: 'attempt-atomic',
    idempotency_key: 'campaign-atomic:recipient-atomic:attempt-1'
  };
}

test('campaign enqueue atomically persists one queue row and one pending message', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-atomic' });
  const first = MessageQueueRepository.insertCampaignDispatch(dispatchPayload(), db);
  const duplicate = MessageQueueRepository.insertCampaignDispatch(dispatchPayload(), db);

  assert.equal(duplicate.queueId, first.queueId);
  assert.equal(duplicate.messageId, first.messageId);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM message_queue').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages').get().count, 1);
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(first.messageId);
  assert.equal(message.sender_id, 'SYSTEM');
  assert.equal(message.delivery_status, 'pending');
  assert.equal(message.client_message_id, 'queue_' + first.queueId);
}));

test('campaign enqueue rolls the queue back when pending-message persistence fails', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-atomic' });
  db.exec("CREATE TRIGGER fail_campaign_pending BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'forced pending failure'); END");

  assert.throws(
    () => MessageQueueRepository.insertCampaignDispatch(dispatchPayload(), db),
    /forced pending failure/
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM message_queue').get().count, 0);
}));
