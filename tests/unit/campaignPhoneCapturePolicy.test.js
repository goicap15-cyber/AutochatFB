const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const { seedPageThread } = require('../integration/campaignTestUtils');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignPhoneCaptureService = require('../../src/server/services/CampaignPhoneCaptureService');
const PhoneCaptureService = require('../../src/server/services/PhoneCaptureService');

async function withDatabase(run) {
  const db = getTestDatabase(':memory:');
  try {
    return await run(db);
  } finally {
    db.close();
  }
}

const fastSleep = () => Promise.resolve();

function createRunningCampaign(db, threadId, extra = {}) {
  const campaign = CampaignRepository.createDraft({
    name: 'Test campaign',
    recipients: [{ thread_id: threadId, account_id: 'acct-1', source_id: 'src-page-1', eligibility_status: 'eligible' }],
    messages: [{ text_content: 'Msg 1' }, { text_content: 'Msg 2' }],
    ...extra
  }, db);
  const recipientId = campaign.recipients[0].id;
  db.prepare("UPDATE campaign_recipients SET execution_order = 1 WHERE id = ?").run(recipientId);
  db.prepare("UPDATE campaigns SET status = 'running' WHERE id = ?").run(campaign.id);
  return { campaign, recipientId };
}

function captureFor(db, threadId, messageId = 'mid.1', phone = '0912345678') {
  return PhoneCaptureService.processIncomingMessage({
    threadId, accountId: 'acct-1', messageId, content: phone, messageTimestampMs: 1000
  }, { database: db }).captures[0];
}

test('createDraft defaults phone_capture_policy to continue', () => withDatabase((db) => {
  seedPageThread(db, { id: 't-default' });
  const campaign = CampaignRepository.createDraft({ name: 'X', recipients: [], messages: [] }, db);
  assert.equal(campaign.phone_capture_policy, 'continue');
}));

test('createDraft rejects thank_then_stop without thank-you text', () => withDatabase((db) => {
  assert.throws(() => CampaignRepository.createDraft({
    name: 'X', recipients: [], messages: [], phone_capture_policy: 'thank_then_stop'
  }, db), /PHONE_CAPTURE_THANK_YOU_TEXT_REQUIRED/);
}));

test('createDraft rejects an invalid policy value', () => withDatabase((db) => {
  assert.throws(() => CampaignRepository.createDraft({
    name: 'X', recipients: [], messages: [], phone_capture_policy: 'bogus'
  }, db), /INVALID_PHONE_CAPTURE_POLICY/);
}));

test('continue policy only audits, never touches recipient status', () => withDatabase(async (db) => {
  seedPageThread(db, { id: 't-1' });
  const { recipientId, campaign } = createRunningCampaign(db, 't-1');
  const capture = captureFor(db, 't-1');

  await CampaignPhoneCaptureService.handleCaptures('t-1', [capture], { database: db, sleep: fastSleep });

  const recipient = db.prepare('SELECT status FROM campaign_recipients WHERE id = ?').get(recipientId);
  assert.equal(recipient.status, 'pending');
  const audit = db.prepare("SELECT * FROM campaign_audit_events WHERE campaign_id = ? AND event_type = 'phone_captured'").get(campaign.id);
  assert.ok(audit);
}));

test('stop_remaining cancels a pending recipient immediately and applies the configured status', () => withDatabase(async (db) => {
  seedPageThread(db, { id: 't-2' });
  db.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Đã có số', '#0FBD74')").run();
  const statusId = db.prepare("SELECT id FROM lead_statuses WHERE name = 'Đã có số'").get().id;

  const { recipientId, campaign } = createRunningCampaign(db, 't-2', {
    phone_capture_policy: 'stop_remaining',
    phone_capture_status_id: statusId
  });
  const capture = captureFor(db, 't-2');

  await CampaignPhoneCaptureService.handleCaptures('t-2', [capture], { database: db, sleep: fastSleep });

  const recipient = db.prepare('SELECT status FROM campaign_recipients WHERE id = ?').get(recipientId);
  assert.equal(recipient.status, 'cancelled');
  const contact = db.prepare('SELECT status_id FROM contacts WHERE thread_id = ?').get('t-2');
  assert.equal(contact.status_id, statusId);
  const audit = db.prepare("SELECT * FROM campaign_audit_events WHERE campaign_id = ? AND event_type = 'phone_capture_stop_applied'").get(campaign.id);
  assert.ok(audit);
  const action = db.prepare('SELECT state FROM campaign_phone_capture_actions WHERE campaign_recipient_id = ?').get(recipientId);
  assert.equal(action.state, 'stop_applied');
}));

test('stop_remaining never interrupts a recipient already mid-dispatch, then finalizes once it settles', () => withDatabase(async (db) => {
  seedPageThread(db, { id: 't-3' });
  const { recipientId, campaign } = createRunningCampaign(db, 't-3', { phone_capture_policy: 'stop_remaining' });
  db.prepare("UPDATE campaign_recipients SET status = 'processing', attempt_count = 1 WHERE id = ?").run(recipientId);
  const message = db.prepare('SELECT id FROM campaign_messages WHERE campaign_id = ? ORDER BY sequence_order ASC LIMIT 1').get(campaign.id);
  db.prepare(`
    INSERT INTO campaign_attempts (id, campaign_recipient_id, campaign_message_id, attempt_number, idempotency_key, status)
    VALUES ('attempt-1', ?, ?, 1, 'idem-1', 'dispatched')
  `).run(recipientId, message.id);

  const capture = captureFor(db, 't-3');
  await CampaignPhoneCaptureService.handleCaptures('t-3', [capture], { database: db, sleep: fastSleep });

  // Not stopped yet - the recipient was mid-dispatch.
  let recipient = db.prepare('SELECT status FROM campaign_recipients WHERE id = ?').get(recipientId);
  assert.equal(recipient.status, 'processing');
  let action = db.prepare('SELECT state FROM campaign_phone_capture_actions WHERE campaign_recipient_id = ?').get(recipientId);
  assert.equal(action.state, 'pending');

  // The in-flight attempt now settles (confirmed) - there's still a second
  // campaign message left, so without the deferred-stop check this would
  // normally revert to 'pending' and go on to send it.
  CampaignRepository.finishAttempt('attempt-1', 'confirmed', null, null, db);

  recipient = db.prepare('SELECT status FROM campaign_recipients WHERE id = ?').get(recipientId);
  assert.equal(recipient.status, 'cancelled');
  action = db.prepare('SELECT state FROM campaign_phone_capture_actions WHERE campaign_recipient_id = ?').get(recipientId);
  assert.equal(action.state, 'stop_applied');
  const audit = db.prepare("SELECT * FROM campaign_audit_events WHERE campaign_id = ? AND event_type = 'phone_capture_stop_applied'").get(campaign.id);
  assert.ok(audit);
}));

test('missing configured status is audited as unavailable but stop still completes', () => withDatabase(async (db) => {
  seedPageThread(db, { id: 't-4' });
  db.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Sẽ bị xóa', '#000000')").run();
  const statusId = db.prepare("SELECT id FROM lead_statuses WHERE name = 'Sẽ bị xóa'").get().id;
  const { recipientId, campaign } = createRunningCampaign(db, 't-4', {
    phone_capture_policy: 'stop_remaining',
    phone_capture_status_id: statusId
  });
  // The target status existed when the campaign was saved (FR-012) but was
  // since removed - campaigns.phone_capture_status_id deliberately has no FK
  // (see db.js migration v21), so this keeps pointing at a now-deleted row
  // instead of the campaign forgetting a status was ever configured.
  db.prepare('DELETE FROM lead_statuses WHERE id = ?').run(statusId);
  const capture = captureFor(db, 't-4');

  await CampaignPhoneCaptureService.handleCaptures('t-4', [capture], { database: db, sleep: fastSleep });

  const recipient = db.prepare('SELECT status FROM campaign_recipients WHERE id = ?').get(recipientId);
  assert.equal(recipient.status, 'cancelled');
  const audit = db.prepare("SELECT * FROM campaign_audit_events WHERE campaign_id = ? AND event_type = 'phone_capture_status_unavailable'").get(campaign.id);
  assert.ok(audit);
}));

test('handling the same capture twice never double-applies (idempotent)', () => withDatabase(async (db) => {
  seedPageThread(db, { id: 't-5' });
  const { recipientId } = createRunningCampaign(db, 't-5', { phone_capture_policy: 'stop_remaining' });
  const capture = captureFor(db, 't-5');

  await CampaignPhoneCaptureService.handleCaptures('t-5', [capture], { database: db, sleep: fastSleep });
  await CampaignPhoneCaptureService.handleCaptures('t-5', [capture], { database: db, sleep: fastSleep });

  const actionCount = db.prepare('SELECT COUNT(*) AS c FROM campaign_phone_capture_actions WHERE campaign_recipient_id = ?').get(recipientId);
  assert.equal(actionCount.c, 1);
  const auditCount = db.prepare("SELECT COUNT(*) AS c FROM campaign_audit_events WHERE campaign_recipient_id = ? AND event_type = 'phone_capture_stop_applied'").get(recipientId);
  assert.equal(auditCount.c, 1);
}));

test('a campaign not currently active (completed) is not affected by a new capture', () => withDatabase(async (db) => {
  seedPageThread(db, { id: 't-6' });
  const { recipientId, campaign } = createRunningCampaign(db, 't-6', { phone_capture_policy: 'stop_remaining' });
  db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(campaign.id);
  const capture = captureFor(db, 't-6');

  await CampaignPhoneCaptureService.handleCaptures('t-6', [capture], { database: db, sleep: fastSleep });

  const recipient = db.prepare('SELECT status FROM campaign_recipients WHERE id = ?').get(recipientId);
  assert.equal(recipient.status, 'pending'); // untouched
  const actionCount = db.prepare('SELECT COUNT(*) AS c FROM campaign_phone_capture_actions WHERE campaign_recipient_id = ?').get(recipientId);
  assert.equal(actionCount.c, 0);
}));


test('CampaignService forwards phone-capture policy, thank-you text and target status to the persisted draft', () => withDatabase((db) => {
  db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (1, 'admin', 'test', 'ADMIN')").run();
  seedPageThread(db, { id: 't-service' });
  const statusId = db.prepare("INSERT INTO lead_statuses (name, color) VALUES ('Đã có số', '#0FBD74')").run().lastInsertRowid;

  const campaign = CampaignService.createDraft({
    name: 'Tự dừng khi có số',
    thread_ids: ['t-service'],
    messages: [{ text_content: 'Bạn để lại số giúp mình nhé.' }],
    phone_capture_policy: 'thank_then_stop',
    phone_capture_thank_you_text: 'Cảm ơn bạn, mình đã nhận số.',
    phone_capture_status_id: Number(statusId)
  }, db, { maxRecipients: 10 });

  assert.equal(campaign.phone_capture_policy, 'thank_then_stop');
  assert.equal(campaign.phone_capture_thank_you_text, 'Cảm ơn bạn, mình đã nhận số.');
  assert.equal(campaign.phone_capture_status_id, Number(statusId));

  const updated = CampaignService.updateDraft(campaign.id, {
    phone_capture_policy: 'stop_remaining',
    phone_capture_thank_you_text: null,
    phone_capture_status_id: Number(statusId)
  }, db, { maxRecipients: 10 });
  assert.equal(updated.phone_capture_policy, 'stop_remaining');
  assert.equal(updated.phone_capture_thank_you_text, null);
  assert.equal(updated.phone_capture_status_id, Number(statusId));
}));

test('CampaignService rejects a target status that no longer exists', () => withDatabase((db) => {
  seedPageThread(db, { id: 't-missing-status' });
  assert.throws(() => CampaignService.createDraft({
    name: 'Target status missing',
    thread_ids: ['t-missing-status'],
    messages: [{ text_content: 'Nội dung' }],
    phone_capture_policy: 'stop_remaining',
    phone_capture_status_id: 99999
  }, db, { maxRecipients: 10 }), (error) => error?.code === 'INVALID_PHONE_CAPTURE_STATUS');
}));
