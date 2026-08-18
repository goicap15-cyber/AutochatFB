const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const { seedPageThread } = require('../integration/campaignTestUtils');
const GlobalPhoneAutomationService = require('../../src/server/services/GlobalPhoneAutomationService');
const PhoneCaptureService = require('../../src/server/services/PhoneCaptureService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const CampaignPhoneCaptureService = require('../../src/server/services/CampaignPhoneCaptureService');

function withDb(run) { const db = getTestDatabase(':memory:'); try { return run(db); } finally { db.close(); } }

test('global phone automation starts disabled and requires a target status to be enabled', () => withDb((db) => {
  assert.deepEqual(GlobalPhoneAutomationService.get(db).enabled, false);
  assert.throws(() => GlobalPhoneAutomationService.update({ enabled: true }, db), /chọn trạng thái đích/i);
}));

test('enabled global automation marks a genuine captured-phone contact without a campaign', () => withDb((db) => {
  const threadId = 'global-phone-thread';
  seedPageThread(db, { id: threadId, accountId: 'acct-global' });
  const statusId = Number(db.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Đã có số', '#8B5CF6')").run().lastInsertRowid);
  GlobalPhoneAutomationService.update({ enabled: true, status_id: statusId }, db);
  const result = PhoneCaptureService.processIncomingMessage({ threadId, accountId: 'acct-global', messageId: 'mid.global.phone', content: 'Số mình 0380 011 226', messageTimestampMs: 1000 }, { database: db });
  const applied = GlobalPhoneAutomationService.applyCaptures(threadId, result.captures, db);
  assert.equal(applied.applied, true);
  assert.deepEqual(db.prepare('SELECT phone, status_id FROM contacts WHERE thread_id = ?').get(threadId), { phone: '0380011226', status_id: statusId });
}));

test('disabled automation stores phone capture but leaves the status unchanged', () => withDb((db) => {
  const threadId = 'global-phone-off';
  seedPageThread(db, { id: threadId, accountId: 'acct-global' });
  const result = PhoneCaptureService.processIncomingMessage({ threadId, accountId: 'acct-global', messageId: 'mid.global.off', content: '0912 345 678', messageTimestampMs: 1000 }, { database: db });
  assert.equal(GlobalPhoneAutomationService.applyCaptures(threadId, result.captures, db).applied, false);
  assert.deepEqual(db.prepare('SELECT phone, status_id FROM contacts WHERE thread_id = ?').get(threadId), { phone: '0912345678', status_id: null });
}));


test('an active campaign target status explicitly overrides the global target', async () => {
  const db = getTestDatabase(':memory:');
  try {
    const threadId = 'global-phone-campaign-override';
    seedPageThread(db, { id: threadId, accountId: 'acct-global' });
    const globalStatusId = Number(db.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Đã có số', '#8B5CF6')").run().lastInsertRowid);
    const campaignStatusId = Number(db.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Đã chốt qua campaign', '#0FBD74')").run().lastInsertRowid);
    GlobalPhoneAutomationService.update({ enabled: true, status_id: globalStatusId }, db);
    const campaign = CampaignRepository.createDraft({
      name: 'Campaign override', phone_capture_policy: 'stop_remaining', phone_capture_status_id: campaignStatusId,
      recipients: [{ thread_id: threadId, account_id: 'acct-global', source_id: 'src-page-1', eligibility_status: 'eligible' }],
      messages: [{ text_content: 'Xin số' }]
    }, db);
    db.prepare("UPDATE campaigns SET status = 'running' WHERE id = ?").run(campaign.id);
    const result = PhoneCaptureService.processIncomingMessage({ threadId, accountId: 'acct-global', messageId: 'mid.global.override', content: '0989 861 561', messageTimestampMs: 1000 }, { database: db });
    GlobalPhoneAutomationService.applyCaptures(threadId, result.captures, db);
    await CampaignPhoneCaptureService.handleCaptures(threadId, result.captures, { database: db, sleep: () => Promise.resolve() });
    assert.equal(db.prepare('SELECT status_id FROM contacts WHERE thread_id = ?').get(threadId).status_id, campaignStatusId);
  } finally { db.close(); }
});
