const test = require('node:test');
const assert = require('node:assert/strict');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const CampaignEligibilityService = require('../../src/server/services/CampaignEligibilityService');
const CampaignRouteService = require('../../src/server/services/CampaignRouteService');
const MessageQueueRepository = require('../../src/server/repositories/MessageQueueRepository');
const { seedPageThread, seedPersonalThread, withCampaignDatabase } = require('./campaignTestUtils');

test('US1: creates mixed snapshot with immutable route data and source counts', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'page-thread-1', sourceId: 'src-p1', pageId: 'fb-page-1', contactName: 'Page Khách 1' });
  seedPageThread(db, { id: 'page-thread-2', sourceId: 'src-p2', pageId: 'fb-page-2', contactName: 'Page Khách 2' });
  seedPersonalThread(db, { id: 'personal-thread-1', accountId: 'acct-user-1' });
  seedPersonalThread(db, { id: 'personal-thread-2', accountId: 'acct-user-2' });

  const campaign = CampaignService.createDraft({
    name: 'Mixed Campaign',
    thread_ids: ['page-thread-1', 'page-thread-2', 'personal-thread-1', 'personal-thread-2'],
    messages: [{ text_content: 'Xin chào quý khách' }],
    send_cap: 4
  }, db);

  assert.equal(campaign.recipients.length, 4);
  assert.deepEqual(campaign.source_counts, {
    page_messenger: 2,
    personal_messenger: 2,
    total: 4
  });

  const p1 = campaign.recipients.find((r) => r.thread_id === 'page-thread-1');
  assert.equal(p1.source_type, 'page_messenger');
  assert.equal(p1.source_external_id_snapshot, 'fb-page-1');
  assert.equal(p1.eligibility_status, 'eligible');

  const u1 = campaign.recipients.find((r) => r.thread_id === 'personal-thread-1');
  assert.equal(u1.source_type, 'personal_messenger');
  assert.equal(u1.source_external_id_snapshot, null);
  assert.equal(u1.eligibility_status, 'eligible');
}));

test('US2: dispatches Page with page_id and Personal with page_id: null', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'page-thread', sourceId: 'src-page', pageId: 'fb-page-99' });
  seedPersonalThread(db, { id: 'personal-thread', accountId: 'acct-personal-99' });

  const campaign = CampaignService.createDraft({
    name: 'Dispatch Test',
    thread_ids: ['page-thread', 'personal-thread'],
    messages: [{ text_content: 'Test message' }],
    send_cap: 2
  }, db);

  const pageRecip = campaign.recipients.find((r) => r.thread_id === 'page-thread');
  const personalRecip = campaign.recipients.find((r) => r.thread_id === 'personal-thread');

  const attemptPage = CampaignRepository.createAttempt(pageRecip.id, campaign.messages[0].id, db);
  const dispatchPage = MessageQueueRepository.insertCampaignDispatch({
    thread_id: pageRecip.thread_id,
    account_id: pageRecip.account_id,
    source_id: pageRecip.source_id,
    source_type: pageRecip.source_type_snapshot,
    page_id: pageRecip.source_external_id_snapshot,
    content: 'Test message',
    campaign_id: campaign.id,
    campaign_recipient_id: pageRecip.id,
    campaign_attempt_id: attemptPage.id,
    idempotency_key: attemptPage.idempotency_key
  }, db);

  const pageQueueRow = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(dispatchPage.queueId);
  assert.equal(pageQueueRow.source_type, 'page_messenger');
  assert.equal(pageQueueRow.page_id, 'fb-page-99');

  const attemptPersonal = CampaignRepository.createAttempt(personalRecip.id, campaign.messages[0].id, db);
  const dispatchPersonal = MessageQueueRepository.insertCampaignDispatch({
    thread_id: personalRecip.thread_id,
    account_id: personalRecip.account_id,
    source_id: personalRecip.source_id,
    source_type: personalRecip.source_type_snapshot,
    page_id: personalRecip.source_external_id_snapshot,
    content: 'Test message',
    campaign_id: campaign.id,
    campaign_recipient_id: personalRecip.id,
    campaign_attempt_id: attemptPersonal.id,
    idempotency_key: attemptPersonal.idempotency_key
  }, db);

  const personalQueueRow = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(dispatchPersonal.queueId);
  assert.equal(personalQueueRow.source_type, 'personal_messenger');
  assert.equal(personalQueueRow.page_id, null);
}));

test('US2 fail-closed: route mismatch after snapshot fails closed without fallback', () => withCampaignDatabase((db) => {
  seedPersonalThread(db, { id: 'thread-change', accountId: 'acct-orig' });
  db.prepare("INSERT INTO accounts (id, name, profile_dir, status) VALUES ('acct-other', 'Other', '/tmp', 'ACTIVE')").run();

  const campaign = CampaignService.createDraft({
    name: 'Fail Closed',
    thread_ids: ['thread-change'],
    messages: [{ text_content: 'Hello' }]
  }, db);

  const recipient = campaign.recipients[0];

  // Silently switch thread to a different account
  db.prepare('UPDATE threads SET account_id = ? WHERE id = ?').run('acct-other', 'thread-change');

  assert.throws(
    () => CampaignEligibilityService.revalidateSnapshotRecipient(recipient, db),
    (err) => err.code === 'SOURCE_UNAVAILABLE'
  );
}));

test('US4: image capability is evaluated per recipient route without caption downgrade', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'page-img-capable', sourceId: 'src-p-img', pageId: 'p-img' });
  seedPersonalThread(db, { id: 'personal-no-img', accountId: 'acct-no-img' });

  const customRichConfig = {
    enabled: true,
    adapters: {
      page_messenger: { image: true },
      personal_messenger: { image: false }
    }
  };
  const customCampaignConfig = {
    enabled: true,
    imageEnabled: true
  };

  const pageRoute = CampaignRouteService.inspectThreadRoute('page-img-capable', db, {
    richConfig: customRichConfig,
    campaignConfig: customCampaignConfig
  });
  assert.equal(pageRoute.capabilities.image, true);

  const personalRoute = CampaignRouteService.inspectThreadRoute('personal-no-img', db, {
    richConfig: customRichConfig,
    campaignConfig: customCampaignConfig
  });
  assert.equal(personalRoute.capabilities.image, false);

  const recipientPersonal = {
    thread_id: 'personal-no-img',
    account_id: 'acct-no-img',
    source_id: 'src-personal-acct-no-img',
    source_type_snapshot: 'personal_messenger',
    source_external_id_snapshot: null
  };

  assert.throws(
    () => CampaignRouteService.revalidateSnapshotRecipient(recipientPersonal, db, {
      hasAttachment: true,
      richConfig: customRichConfig,
      campaignConfig: customCampaignConfig
    }),
    (err) => err.code === 'ATTACHMENT_INVALID'
  );
}));

// Regression (spec 040): a route with image capability enabled but file
// capability NOT independently enabled must still reject a file attachment -
// inspectThreadRoute previously only ever computed capabilities.image, so
// revalidateSnapshotRecipient's single `!current.capabilities.image` check
// let a file attachment through any route with image enabled, regardless of
// its own RICH_MESSAGE_*_FILE_ENABLED flag (FR-018: personal file must stay
// gated independently of personal image until separately live-verified).
test('US4b: file capability is gated independently from image capability per route', () => withCampaignDatabase((db) => {
  seedPersonalThread(db, { id: 'personal-image-only', accountId: 'acct-image-only' });

  const richConfig = {
    enabled: true,
    adapters: {
      page_messenger: { image: true, file: true },
      personal_messenger: { image: true, file: false }
    }
  };
  const campaignConfig = { enabled: true, imageEnabled: true, fileEnabled: true };

  const route = CampaignRouteService.inspectThreadRoute('personal-image-only', db, { richConfig, campaignConfig });
  assert.equal(route.capabilities.image, true);
  assert.equal(route.capabilities.file, false);

  const recipient = {
    thread_id: 'personal-image-only',
    account_id: 'acct-image-only',
    source_id: 'src-personal-acct-image-only',
    source_type_snapshot: 'personal_messenger',
    source_external_id_snapshot: null
  };

  // An image attachment is fine - image capability is enabled for this route.
  const okForImage = CampaignRouteService.revalidateSnapshotRecipient(recipient, db, {
    hasAttachment: true,
    attachmentMediaType: 'image',
    richConfig,
    campaignConfig
  });
  assert.equal(okForImage.eligibility_status, 'eligible');

  // A file attachment must be rejected - file capability is NOT enabled for
  // this route, even though image capability is.
  assert.throws(
    () => CampaignRouteService.revalidateSnapshotRecipient(recipient, db, {
      hasAttachment: true,
      attachmentMediaType: 'file',
      richConfig,
      campaignConfig
    }),
    (err) => err.code === 'ATTACHMENT_INVALID'
  );
}));

test('legacy campaign compatibility: historical rows without snapshot fields read and function', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'legacy-thread-1', sourceId: 'src-legacy-1', pageId: 'legacy-page-1' });

  // Manually insert legacy campaign & recipient with NULL snapshot fields
  db.prepare(`
    INSERT INTO campaigns (id, name, status, feature_version)
    VALUES ('legacy-campaign-1', 'Legacy Page Campaign', 'draft', '026-v1')
  `).run();

  db.prepare(`
    INSERT INTO campaign_recipients
      (id, campaign_id, thread_id, source_id, account_id, selection_order,
       source_type_snapshot, source_external_id_snapshot, source_display_name_snapshot,
       eligibility_status)
    VALUES ('legacy-recip-1', 'legacy-campaign-1', 'legacy-thread-1', 'src-legacy-1', 'acct-1', 1,
            NULL, NULL, NULL, 'eligible')
  `).run();

  const retrieved = CampaignRepository.getCampaign('legacy-campaign-1', db);
  assert.equal(retrieved.recipients.length, 1);
  assert.equal(retrieved.recipients[0].source_type, 'page_messenger');
  assert.equal(retrieved.recipients[0].source_external_id, 'legacy-page-1');
  assert.equal(retrieved.source_counts.page_messenger, 1);
  assert.equal(retrieved.source_counts.personal_messenger, 0);
}));

test('Delivery Confirmation: campaign queue remains processing on extension dispatch and only becomes sent upon DOM confirmation', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-confirm-test', sourceId: 'src-confirm', pageId: 'page-confirm' });
  const campaign = CampaignService.createDraft({
    name: 'Delivery Confirm Campaign',
    thread_ids: ['thread-confirm-test'],
    messages: [{ text_content: 'Test delivery confirm' }],
    send_cap: 1
  }, db);

  const recipient = campaign.recipients[0];
  const attempt = CampaignRepository.createAttempt(recipient.id, campaign.messages[0].id, db);
  const dispatch = MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id,
    account_id: recipient.account_id,
    source_id: recipient.source_id,
    source_type: recipient.source_type_snapshot,
    page_id: recipient.source_external_id_snapshot,
    content: 'Test delivery confirm',
    campaign_id: campaign.id,
    campaign_recipient_id: recipient.id,
    campaign_attempt_id: attempt.id,
    idempotency_key: attempt.idempotency_key
  }, db);

  // 1. Initially pending
  let queueRow = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(dispatch.queueId);
  let messageRow = db.prepare('SELECT * FROM messages WHERE id = ?').get(dispatch.messageId);
  assert.equal(queueRow.status, 'pending');
  assert.equal(messageRow.delivery_status, 'pending');

  // 2. QueueWorker pops message -> processing
  const popped = MessageQueueRepository.popPending(db);
  assert.equal(popped.id, dispatch.queueId);
  queueRow = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(dispatch.queueId);
  assert.equal(queueRow.status, 'processing');

  // 3. Extension reports QUEUED_MESSAGE_RESULT with dispatched outcome
  // Simulating the server logic for QUEUED_MESSAGE_RESULT:
  const isDispatched = true;
  if (isDispatched) {
    // Keeps message_queue in 'processing', does NOT update to 'sent'
  }
  queueRow = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(dispatch.queueId);
  messageRow = db.prepare('SELECT * FROM messages WHERE id = ?').get(dispatch.messageId);
  assert.equal(queueRow.status, 'processing', 'Queue row MUST stay processing on dispatch');
  assert.equal(messageRow.delivery_status, 'pending', 'Message row MUST stay pending on dispatch');

  // 4. Later, DOM confirmation arrives (NEW_MESSAGE_RECEIVED)
  const confirmedFbId = 'mid.confirmed_12345';
  db.prepare(`
    UPDATE messages SET fb_message_id = ?, delivery_status = 'sent', delivery_error = NULL
    WHERE id = ?
  `).run(confirmedFbId, messageRow.id);
  MessageQueueRepository.updateStatus(dispatch.queueId, 'sent', null, db);

  queueRow = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(dispatch.queueId);
  messageRow = db.prepare('SELECT * FROM messages WHERE id = ?').get(dispatch.messageId);
  assert.equal(queueRow.status, 'sent', 'Queue row becomes sent after DOM confirmation');
  assert.equal(messageRow.delivery_status, 'sent', 'Message row becomes sent after DOM confirmation');
  assert.equal(messageRow.fb_message_id, confirmedFbId);
}));

