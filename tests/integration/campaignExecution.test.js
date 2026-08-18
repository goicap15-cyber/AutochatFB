const test = require('node:test');
const assert = require('node:assert/strict');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const campaignRunnerModule = require('../../src/server/services/CampaignRunner');
const { seedPageThread, withCampaignDatabase } = require('./campaignTestUtils');

const { CampaignRunner } = campaignRunnerModule;

test('descending campaign dispatches 5 -> 1 exactly once per recipient', () => withCampaignDatabase(async (db) => {
  const ids = Array.from({ length: 5 }, (_, index) => seedPageThread(db, { id: 'thread-' + (index + 1) }));
  const campaign = CampaignService.createDraft({
    name: 'Reverse',
    thread_ids: ids,
    message: 'Hello',
    start_position: 5,
    direction: 'desc',
    pacing_ms: 0,
    send_cap: 5
  }, db);
  const preview = CampaignService.preview(campaign.id, db);
  assert.deepEqual(
    preview.recipients.filter((item) => item.execution_order).sort((a, b) => a.execution_order - b.execution_order).map((item) => item.thread_id),
    ['thread-5', 'thread-4', 'thread-3', 'thread-2', 'thread-1']
  );

  CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db);
  const dispatched = [];
  const queue = new Map();
  const runner = new CampaignRunner({ database: db });
  runner.configure({
    enqueueMessage: async ({ recipient }) => {
      const queueId = 'queue-' + recipient.id;
      dispatched.push(recipient.thread_id);
      queue.set(queueId, { id: queueId, status: 'sent' });
      return { queueId, clientMessageId: 'queue_' + queueId };
    },
    getQueueStatus: (queueId) => queue.get(queueId),
    pollIntervalMs: 1,
    confirmationTimeoutMs: 100
  });

  const firstPromise = runner.start(campaign.id);
  assert.equal(runner.start(campaign.id), firstPromise, 'duplicate start returns the active runner');
  await firstPromise;

  assert.deepEqual(dispatched, ['thread-5', 'thread-4', 'thread-3', 'thread-2', 'thread-1']);
  const finished = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.attempts.length, 5);
  assert.equal(new Set(finished.attempts.map((item) => item.idempotency_key)).size, 5);
}));

test('descending campaign executes 50 -> 1 with unique attempts', () => withCampaignDatabase(async (db) => {
  const ids = Array.from(
    { length: 50 },
    (_, index) => seedPageThread(db, { id: 'bulk-thread-' + (index + 1) })
  );
  const expected = [...ids].reverse();
  const campaign = CampaignService.createDraft({
    name: 'Reverse 50',
    thread_ids: ids,
    message: 'Hello 50',
    start_position: 50,
    direction: 'desc',
    pacing_ms: 0,
    send_cap: 50
  }, db);
  const preview = CampaignService.preview(campaign.id, db);
  assert.deepEqual(
    preview.recipients
      .filter((item) => item.execution_order)
      .sort((left, right) => left.execution_order - right.execution_order)
      .map((item) => item.thread_id),
    expected
  );

  CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db);
  const dispatched = [];
  const queue = new Map();
  const runner = new CampaignRunner({ database: db });
  runner.configure({
    enqueueMessage: async ({ recipient, attempt }) => {
      const queueId = 'bulk-queue-' + attempt.id;
      dispatched.push(recipient.thread_id);
      queue.set(queueId, { id: queueId, status: 'sent' });
      return { queueId, clientMessageId: 'queue_' + queueId };
    },
    getQueueStatus: (queueId) => queue.get(queueId),
    pollIntervalMs: 1,
    confirmationTimeoutMs: 100
  });

  await runner.start(campaign.id);

  assert.deepEqual(dispatched, expected);
  const finished = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.attempts.length, 50);
  assert.equal(new Set(finished.attempts.map((item) => item.idempotency_key)).size, 50);
}));

test('pause waits for in-flight result and resume does not duplicate it', () => withCampaignDatabase(async (db) => {
  seedPageThread(db, { id: 'thread-a' });
  seedPageThread(db, { id: 'thread-b' });
  const campaign = CampaignService.createDraft({
    name: 'Pause',
    thread_ids: ['thread-a', 'thread-b'],
    message: 'Hello',
    pacing_ms: 0,
    send_cap: 2
  }, db);
  CampaignService.preview(campaign.id, db);
  CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db);

  const dispatched = [];
  const queue = new Map();
  const runner = new CampaignRunner({ database: db });
  runner.configure({
    enqueueMessage: async ({ recipient }) => {
      const queueId = 'queue-' + recipient.id;
      dispatched.push(recipient.thread_id);
      queue.set(queueId, { id: queueId, status: 'processing' });
      return { queueId, clientMessageId: 'queue_' + queueId };
    },
    getQueueStatus: (queueId) => queue.get(queueId),
    pollIntervalMs: 2,
    confirmationTimeoutMs: 250
  });

  const running = runner.start(campaign.id);
  while (dispatched.length === 0) await new Promise((resolve) => setTimeout(resolve, 2));
  CampaignRepository.updateCampaignStatus(campaign.id, 'running', 'pausing', db);
  const firstQueueId = [...queue.keys()][0];
  queue.set(firstQueueId, { id: firstQueueId, status: 'sent' });
  await running;

  assert.equal(CampaignRepository.getCampaign(campaign.id, db).status, 'paused');
  assert.deepEqual(dispatched, ['thread-a']);

  CampaignRepository.updateCampaignStatus(campaign.id, 'paused', 'running', db);
  const resumed = runner.start(campaign.id);
  while (dispatched.length < 2) await new Promise((resolve) => setTimeout(resolve, 2));
  const secondQueueId = [...queue.keys()][1];
  queue.set(secondQueueId, { id: secondQueueId, status: 'sent' });
  await resumed;

  assert.deepEqual(dispatched, ['thread-a', 'thread-b']);
  assert.equal(CampaignRepository.getCampaign(campaign.id, db).status, 'completed');
}));

test('multiple campaign messages stay sequential within one recipient', () => withCampaignDatabase(async (db) => {
  seedPageThread(db, { id: 'thread-sequence' });
  const campaign = CampaignService.createDraft({
    name: 'Sequence',
    thread_ids: ['thread-sequence'],
    messages: [{ text_content: 'First' }, { text_content: 'Second' }],
    pacing_ms: 0,
    send_cap: 1
  }, db);
  CampaignService.preview(campaign.id, db);
  CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db);
  const dispatched = [];
  const queue = new Map();
  const runner = new CampaignRunner({ database: db });
  runner.configure({
    enqueueMessage: async ({ attempt, content }) => {
      const queueId = 'queue-' + attempt.id;
      dispatched.push(content);
      queue.set(queueId, { id: queueId, status: 'sent' });
      return { queueId, clientMessageId: 'queue_' + queueId };
    },
    getQueueStatus: (queueId) => queue.get(queueId),
    pollIntervalMs: 1,
    confirmationTimeoutMs: 100
  });
  await runner.start(campaign.id);
  const finished = CampaignRepository.getCampaign(campaign.id, db);
  assert.deepEqual(dispatched, ['First', 'Second']);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.attempts.length, 2);
}));
