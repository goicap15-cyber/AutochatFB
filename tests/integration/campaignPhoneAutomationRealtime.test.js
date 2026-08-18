const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const { seedPageThread } = require('./campaignTestUtils');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const CampaignPhoneCaptureService = require('../../src/server/services/CampaignPhoneCaptureService');
const PhoneCaptureService = require('../../src/server/services/PhoneCaptureService');

async function withDatabase(run) {
  const database = getTestDatabase(':memory:');
  try { return await run(database); } finally { database.close(); }
}

function createRunningCampaign(database, threadId, statusId) {
  const campaign = CampaignRepository.createDraft({
    name: 'Tự dừng khi khách để số',
    recipients: [{ thread_id: threadId, account_id: 'acct-page', source_id: 'page-1', eligibility_status: 'eligible' }],
    messages: [{ text_content: 'Bạn để lại số giúp mình nhé.' }],
    phone_capture_policy: 'stop_remaining',
    phone_capture_status_id: statusId
  }, database);
  database.prepare("UPDATE campaigns SET status = 'running' WHERE id = ?").run(campaign.id);
  return campaign;
}

test('incoming customer phone capture moves the campaign contact into Đã có số, so realtime state and status filters use it immediately', async () => withDatabase(async (database) => {
  const threadId = 'page-phone-auto-realtime';
  seedPageThread(database, { id: threadId, accountId: 'acct-page' });
  const statusId = Number(database.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Đã có số', '#8B5CF6')").run().lastInsertRowid);
  const campaign = createRunningCampaign(database, threadId, statusId);

  const result = PhoneCaptureService.processIncomingMessage({
    threadId,
    accountId: 'acct-page',
    messageId: 'mid.customer-phone',
    content: 'Số của mình là 0989 861 561',
    messageTimestampMs: Date.UTC(2026, 7, 14, 8, 38, 0)
  }, { database });
  assert.equal(result.captures.length, 1);

  await CampaignPhoneCaptureService.handleCaptures(threadId, result.captures, {
    database,
    sleep: () => Promise.resolve()
  });

  const view = database.prepare(`
    SELECT c.phone, c.status_id, ls.name AS status_name, cr.status AS campaign_recipient_status
    FROM contacts c
    JOIN threads t ON t.id = c.thread_id
    JOIN lead_statuses ls ON ls.id = c.status_id
    JOIN campaign_recipients cr ON cr.thread_id = c.thread_id
    WHERE c.thread_id = ? AND cr.campaign_id = ?
  `).get(threadId, campaign.id);

  assert.deepEqual(view, {
    phone: '0989861561',
    status_id: statusId,
    status_name: 'Đã có số',
    campaign_recipient_status: 'cancelled'
  });
}));


test('a captured phone outside an active configured campaign is stored but does not assign a status', () => withDatabase((database) => {
  const threadId = 'page-phone-capture-only';
  seedPageThread(database, { id: threadId, accountId: 'acct-page' });
  const result = PhoneCaptureService.processIncomingMessage({
    threadId,
    accountId: 'acct-page',
    messageId: 'mid.customer-phone-capture-only',
    content: 'Liên hệ mình qua 0912.345.678',
    messageTimestampMs: Date.UTC(2026, 7, 14, 8, 39, 0)
  }, { database });

  assert.equal(result.captures.length, 1);
  const contact = database.prepare('SELECT phone, phone_source, status_id FROM contacts WHERE thread_id = ?').get(threadId);
  assert.deepEqual(contact, { phone: '0912345678', phone_source: 'message_capture', status_id: null });
}));
