const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { getTestDatabase } = require('../helpers/testDatabase');
const { seedPageThread } = require('./campaignTestUtils');
const MessageQueueRepository = require('../../src/server/repositories/MessageQueueRepository');
const queueWorker = require('../../src/server/services/QueueWorker');

function jpegBytes() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
}

function withFixture(run) {
  const db = getTestDatabase(':memory:');
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-attachment-integrity-'));
  const sentEnvelopes = [];
  const ws = { readyState: 1, send: (value) => sentEnvelopes.push(JSON.parse(value)) };
  seedPageThread(db, { id: 'thread-campaign-image' });
  queueWorker.configure({
    database: db,
    getConnection: () => ws,
    campaignEnabled: () => true,
    onQueueFail: () => {}
  });
  return Promise.resolve()
    .then(() => run({ db, storageDir, sentEnvelopes }))
    .finally(() => {
      db.close();
      fs.rmSync(storageDir, { recursive: true, force: true });
    });
}

function stageAttachment(storageDir, bytes) {
  const storagePath = path.join(storageDir, 'image.jpg');
  fs.writeFileSync(storagePath, bytes);
  return {
    id: 'attachment-1',
    storage_path: storagePath,
    media_type: 'image',
    byte_size: bytes.length,
    checksum: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

function enqueue(db, attachment, campaignAttemptId) {
  return MessageQueueRepository.insertCampaignDispatch({
    thread_id: 'thread-campaign-image',
    account_id: 'acct-1',
    source_id: 'src-page-1',
    source_type: 'page_messenger',
    page_id: 'page-1',
    content: '',
    attachment_id: attachment.id,
    attachment_path: attachment.storage_path,
    attachment_mime_type: 'image/jpeg',
    attachment_name: 'image.jpg',
    attachment_media_type: attachment.media_type,
    attachment_byte_size: attachment.byte_size,
    attachment_checksum: attachment.checksum,
    campaign_id: 'campaign-1',
    campaign_recipient_id: 'recipient-1',
    campaign_attempt_id: campaignAttemptId,
    idempotency_key: 'campaign:campaign-1:recipient:recipient-1:attempt:' + campaignAttemptId
  }, db);
}

// Regression: MessageQueueRepository.insert() never populated
// attachment_byte_size/attachment_checksum/contract_version for campaign
// dispatches, so QueueWorker.buildAttachment()'s integrity check (gated on
// contract_version === 2) silently never ran for campaign images - a staged
// file tampered with after validation would dispatch unnoticed.
test('campaign image dispatch is stored with contract_version=2 and verified byte_size/checksum', () => withFixture(({ db, storageDir }) => {
  const attachment = stageAttachment(storageDir, jpegBytes());
  const { queueId } = enqueue(db, attachment, 'attempt-1');

  const row = db.prepare(
    'SELECT contract_version, attachment_byte_size, attachment_checksum FROM message_queue WHERE id = ?'
  ).get(queueId);
  assert.equal(row.contract_version, 2);
  assert.equal(row.attachment_byte_size, attachment.byte_size);
  assert.equal(row.attachment_checksum, attachment.checksum);
}));

test('campaign image dispatch with an untampered file dispatches normally', () => withFixture(async ({ db, storageDir, sentEnvelopes }) => {
  const attachment = stageAttachment(storageDir, jpegBytes());
  enqueue(db, attachment, 'attempt-1');

  const dispatch = await queueWorker.processNext();
  assert.equal(dispatch.outcome, 'dispatched');
  assert.equal(sentEnvelopes.length, 1);
  assert.equal(sentEnvelopes[0].data.contract_version, 2);
  assert.equal(sentEnvelopes[0].data.attachment.byte_size, attachment.byte_size);
}));

test('campaign image bytes tampered with after staging fail checksum verification before dispatch', () => withFixture(async ({ db, storageDir, sentEnvelopes }) => {
  const attachment = stageAttachment(storageDir, jpegBytes());
  const { queueId } = enqueue(db, attachment, 'attempt-1');
  fs.writeFileSync(attachment.storage_path, Buffer.from('tampered bytes'));

  const dispatch = await queueWorker.processNext();
  assert.equal(dispatch.outcome, 'failed');
  assert.equal(sentEnvelopes.length, 0, 'a tampered attachment must never reach the extension');
  assert.equal(db.prepare('SELECT status, error_reason FROM message_queue WHERE id = ?').get(queueId).status, 'failed');
}));
