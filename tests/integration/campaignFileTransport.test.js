const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const CampaignAttachmentService = require('../../src/server/services/CampaignAttachmentService');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignRouteService = require('../../src/server/services/CampaignRouteService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const MessageQueueRepository = require('../../src/server/repositories/MessageQueueRepository');
const OutboundDomCorrelationService = require('../../src/server/services/OutboundDomCorrelationService');
const queueWorker = require('../../src/server/services/QueueWorker');
const { seedPageThread, seedPersonalThread, withCampaignDatabase } = require('./campaignTestUtils');

function withStorage(run) {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-file-transport-'));
  const sentEnvelopes = [];
  const ws = { readyState: 1, send: (value) => sentEnvelopes.push(JSON.parse(value)) };
  return Promise.resolve()
    .then(() => run({ storageDir, sentEnvelopes, ws }))
    .finally(() => fs.rmSync(storageDir, { recursive: true, force: true }));
}

const RICH_CONFIG = {
  enabled: true,
  adapters: {
    page_messenger: { image: true, file: true },
    personal_messenger: { image: true, file: false }
  }
};
const CAMPAIGN_CONFIG = { enabled: true, imageEnabled: true, fileEnabled: true };

// Regression: CampaignService.preview()'s message validation predates
// manifests - it flags ANY message with more than one valid attachment as
// invalid (ATTACHMENT_MANIFEST_REQUIRED), a leftover guard from when spec 039
// only ever supported exactly one attachment per message. Reproduced live:
// previewing a real campaign with a 2-file manifest failed with this exact
// error. Fixed to allow >1 attachment only when every one of them shares the
// same manifest_id.
test('previewing a campaign with a multi-file manifest succeeds (does not require exactly one attachment)', () => withCampaignDatabase((db) => withStorage(({ storageDir }) => {
  seedPageThread(db, { id: 'thread-page-preview', sourceId: 'src-page-preview', pageId: 'page-preview' });
  const campaign = CampaignService.createDraft({
    name: 'Preview manifest', thread_ids: ['thread-page-preview'], message: 'Tài liệu', send_cap: 1
  }, db);
  const messageId = campaign.messages[0].id;
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    files: [
      { originalName: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  const previewed = CampaignService.preview(campaign.id, db, { fileEnabled: true });
  assert.equal(previewed.status, 'ready');
  assert.equal(previewed.messages[0].validation_status, 'valid');
})));

test('previewing a message with attachments split across two different manifests still fails', () => withCampaignDatabase((db) => withStorage(({ storageDir }) => {
  seedPageThread(db, { id: 'thread-page-preview2', sourceId: 'src-page-preview2', pageId: 'page-preview2' });
  const campaign = CampaignService.createDraft({
    name: 'Preview two manifests', thread_ids: ['thread-page-preview2'], message: 'Tài liệu', send_cap: 1
  }, db);
  const messageId = campaign.messages[0].id;
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id, campaignMessageId: messageId,
    files: [
      { originalName: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });
  // A second, independent manifest on the SAME message - this is the one
  // shape that genuinely should stay invalid (CampaignRunner only ever
  // dispatches one manifest per message).
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id, campaignMessageId: messageId,
    files: [
      { originalName: 'c.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('gamma') },
      { originalName: 'd.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('delta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  assert.throws(
    () => CampaignService.preview(campaign.id, db, { fileEnabled: true }),
    (error) => error.code === 'CAMPAIGN_MESSAGE_INVALID'
  );
})));

test('a multi-file manifest dispatches as one queue item and the envelope carries every file', () => withCampaignDatabase((db) => withStorage(async ({ storageDir, sentEnvelopes, ws }) => {
  seedPageThread(db, { id: 'thread-page-1', sourceId: 'src-page-1', pageId: 'page-1' });
  const campaign = CampaignService.createDraft({
    name: 'Files', thread_ids: ['thread-page-1'], message: 'Tài liệu', send_cap: 1
  }, db);
  const messageId = campaign.messages[0].id;
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    files: [
      { originalName: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifest = hydrated.messages[0].manifests[0];
  assert.equal(manifest.kind, 'files');
  const recipient = hydrated.recipients[0];

  const { queueId } = MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id,
    account_id: recipient.account_id,
    source_id: 'src-page-1',
    source_type: 'page_messenger',
    page_id: 'page-1',
    content: 'Tài liệu',
    manifest_id: manifest.id,
    campaign_id: campaign.id,
    campaign_recipient_id: recipient.id,
    campaign_attempt_id: 'attempt-1',
    idempotency_key: 'campaign:' + campaign.id + ':recipient:' + recipient.id + ':attempt:1'
  }, db);

  queueWorker.configure({ database: db, getConnection: () => ws, campaignEnabled: () => true, onQueueFail: () => {} });
  const dispatch = await queueWorker.processNext();

  assert.equal(dispatch.outcome, 'dispatched');
  assert.equal(sentEnvelopes.length, 1);
  const envelope = sentEnvelopes[0].data;
  assert.equal(envelope.attachment, null);
  assert.equal(envelope.attachment_manifest.length, 2);
  assert.deepEqual(envelope.attachment_manifest.map((item) => item.name).sort(), ['a.txt', 'b.txt']);
  envelope.attachment_manifest.forEach((item) => {
    assert.ok(fs.existsSync(item.local_path));
    assert.equal(item.media_type, 'file');
  });

  const row = MessageQueueRepository.getStatus(queueId, db);
  assert.equal(row.status, 'processing', 'dispatch must not mark the queue sent before Facebook confirmation');
})));

test('a tampered file inside a manifest fails the whole dispatch, not just that one file', () => withCampaignDatabase((db) => withStorage(async ({ storageDir, sentEnvelopes, ws }) => {
  seedPageThread(db, { id: 'thread-page-2', sourceId: 'src-page-2', pageId: 'page-2' });
  const campaign = CampaignService.createDraft({ name: 'Files2', thread_ids: ['thread-page-2'], message: 'x', send_cap: 1 }, db);
  const messageId = campaign.messages[0].id;
  const saved = CampaignAttachmentService.saveUploads({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    files: [
      { originalName: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });
  fs.writeFileSync(saved[1].storage_path, Buffer.from('tampered'));

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifest = hydrated.messages[0].manifests[0];
  const recipient = hydrated.recipients[0];
  const { queueId } = MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id, account_id: recipient.account_id,
    source_id: 'src-page-2', source_type: 'page_messenger', page_id: 'page-2',
    content: 'x', manifest_id: manifest.id, campaign_id: campaign.id,
    campaign_recipient_id: recipient.id, campaign_attempt_id: 'attempt-1',
    idempotency_key: 'campaign:' + campaign.id + ':recipient:' + recipient.id + ':attempt:1'
  }, db);

  queueWorker.configure({ database: db, getConnection: () => ws, campaignEnabled: () => true, onQueueFail: () => {} });
  const dispatch = await queueWorker.processNext();

  assert.equal(dispatch.outcome, 'failed');
  assert.equal(sentEnvelopes.length, 0, 'a manifest with a tampered member must never reach the extension');
  assert.equal(MessageQueueRepository.getStatus(queueId, db).status, 'failed');
})));

test('a personal route without file capability fails closed before a manifest dispatch, independent of image capability', () => withCampaignDatabase((db) => {
  seedPersonalThread(db, { id: 'personal-1', accountId: 'acct-personal-1' });
  const route = CampaignRouteService.inspectThreadRoute('personal-1', db, { richConfig: RICH_CONFIG, campaignConfig: CAMPAIGN_CONFIG });
  assert.equal(route.capabilities.image, true);
  assert.equal(route.capabilities.file, false);

  const recipient = {
    thread_id: 'personal-1',
    account_id: 'acct-personal-1',
    source_id: 'src-personal-acct-personal-1',
    source_type_snapshot: 'personal_messenger',
    source_external_id_snapshot: null
  };
  assert.throws(
    () => CampaignRouteService.revalidateSnapshotRecipient(recipient, db, {
      hasAttachment: true,
      attachmentMediaType: 'file',
      richConfig: RICH_CONFIG,
      campaignConfig: CAMPAIGN_CONFIG
    }),
    (error) => error.code === 'ATTACHMENT_INVALID'
  );
}));

test('Facebook confirmation of a manifest dispatch flips the queue and pending message to sent exactly once', () => withCampaignDatabase((db) => withStorage(async ({ storageDir, sentEnvelopes, ws }) => {
  seedPageThread(db, { id: 'thread-page-3', sourceId: 'src-page-3', pageId: 'page-3' });
  const campaign = CampaignService.createDraft({ name: 'Files3', thread_ids: ['thread-page-3'], message: 'Tài liệu gửi bạn', send_cap: 1 }, db);
  const messageId = campaign.messages[0].id;
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id, campaignMessageId: messageId,
    files: [
      { originalName: 'doc.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('noi dung') },
      { originalName: 'doc2.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('noi dung 2') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifest = hydrated.messages[0].manifests[0];
  const recipient = hydrated.recipients[0];
  const { queueId, clientMessageId } = MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id, account_id: recipient.account_id,
    source_id: 'src-page-3', source_type: 'page_messenger', page_id: 'page-3',
    content: 'Tài liệu gửi bạn', manifest_id: manifest.id, campaign_id: campaign.id,
    campaign_recipient_id: recipient.id, campaign_attempt_id: 'attempt-1',
    idempotency_key: 'campaign:' + campaign.id + ':recipient:' + recipient.id + ':attempt:1'
  }, db);

  queueWorker.configure({ database: db, getConnection: () => ws, campaignEnabled: () => true, onQueueFail: () => {} });
  await queueWorker.processNext();
  assert.equal(MessageQueueRepository.getStatus(queueId, db).status, 'processing');

  // Facebook's DOM observer reports the file was accepted - correlation is
  // generic on "an attachment is pending in this thread" (no manifest-id
  // filter needed - there is exactly one active attempt per thread here).
  const pending = OutboundDomCorrelationService.matchPendingImageOutbound(db, 'thread-page-3');
  assert.ok(pending, 'must find the manifest dispatch pending outbound row');
  assert.equal(pending.client_message_id, clientMessageId);

  const confirmed = OutboundDomCorrelationService.confirmPendingOutbound(db, null, pending, {
    fbMessageId: 'mid.$manifest1',
    tsMs: Date.now(),
    tsSource: 'dom_order',
    rawMessage: { thread_id: 'thread-page-3', content: 'Tài liệu gửi bạn' }
  });
  assert.equal(confirmed, true);
  assert.equal(MessageQueueRepository.getStatus(queueId, db).status, 'sent');

  const messageRow = db.prepare('SELECT delivery_status, fb_message_id FROM messages WHERE client_message_id = ?').get(clientMessageId);
  assert.equal(messageRow.delivery_status, 'sent');
  assert.equal(messageRow.fb_message_id, 'mid.$manifest1');

  // A replayed observation for the same manifest dispatch must not create a
  // second confirmation or duplicate message.
  const replay = OutboundDomCorrelationService.confirmPendingOutbound(db, null, pending, {
    fbMessageId: 'mid.$manifest1',
    tsMs: Date.now(),
    tsSource: 'dom_order',
    rawMessage: { thread_id: 'thread-page-3', content: 'Tài liệu gửi bạn' }
  });
  assert.equal(replay, false);
})));

// Regression: live-tested on 2026-08-17 (real Business Suite send to a page
// thread, 2-file manifest + caption). Facebook posted the caption but the
// files never visibly attached, yet the DOM observer's text-only scrape of
// the caption matched the pending manifest row by content alone and the
// whole dispatch (including the unverified files) got marked 'sent'. A
// caption match proves the text rendered, not that the attachment/manifest
// riding with it actually sent - matchPendingOutboundByRawContent (and the
// equivalent legacy content-match query in server.js) must refuse to match
// any pending row whose queue entry carries an attachment_id or manifest_id;
// only an explicit media observation (matchPendingImageOutbound) may confirm
// those. Refusing to match here means the dispatch times out to 'unknown'
// instead of falsely reporting 'sent'.
test('a caption-only DOM text match never confirms a pending manifest dispatch (must fail safe, not falsely "sent")', () => withCampaignDatabase((db) => withStorage(({ storageDir }) => {
  seedPageThread(db, { id: 'thread-page-caption', sourceId: 'src-page-caption', pageId: 'page-caption' });
  const campaign = CampaignService.createDraft({ name: 'CaptionManifest', thread_ids: ['thread-page-caption'], message: 'Tai lieu dinh kem', send_cap: 1 }, db);
  const messageId = campaign.messages[0].id;
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id, campaignMessageId: messageId,
    files: [
      { originalName: 'note1.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('a') },
      { originalName: 'note2.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('b') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifest = hydrated.messages[0].manifests[0];
  const recipient = hydrated.recipients[0];
  const { clientMessageId } = MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id, account_id: recipient.account_id,
    source_id: 'src-page-caption', source_type: 'page_messenger', page_id: 'page-caption',
    content: 'Tai lieu dinh kem', manifest_id: manifest.id, campaign_id: campaign.id,
    campaign_recipient_id: recipient.id, campaign_attempt_id: 'attempt-caption',
    idempotency_key: 'campaign:' + campaign.id + ':recipient:' + recipient.id + ':attempt:caption'
  }, db);

  // A DOM observer scrape of ONLY the caption text (no attachment/media
  // evidence) - exactly what Business Suite produced live when the files
  // failed to visibly attach.
  const matched = OutboundDomCorrelationService.matchPendingOutboundByRawContent(db, 'thread-page-caption', 'Tai lieu dinh kem');
  assert.equal(matched, null, 'a caption-only text match must not resolve a manifest-carrying pending row');

  const messageRow = db.prepare('SELECT delivery_status FROM messages WHERE client_message_id = ?').get(clientMessageId);
  assert.equal(messageRow.delivery_status, 'pending', 'must stay pending until a real media confirmation or timeout, never a false "sent"');
})));

test('retrying a failed manifest dispatch preserves the same route and manifest, and only one attempt is ever active', () => withCampaignDatabase((db) => withStorage(async ({ storageDir, sentEnvelopes, ws }) => {
  seedPageThread(db, { id: 'thread-page-4', sourceId: 'src-page-4', pageId: 'page-4' });
  const campaign = CampaignService.createDraft({ name: 'Files4', thread_ids: ['thread-page-4'], message: 'x', send_cap: 1 }, db);
  const messageId = campaign.messages[0].id;
  CampaignAttachmentService.saveUploads({
    campaignId: campaign.id, campaignMessageId: messageId,
    files: [
      { originalName: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifest = hydrated.messages[0].manifests[0];
  const recipient = hydrated.recipients[0];

  // First attempt fails (simulating an extension-reported error before the
  // queue was even claimed for dispatch, e.g. EXTENSION_NOT_CONNECTED).
  MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id, account_id: recipient.account_id,
    source_id: 'src-page-4', source_type: 'page_messenger', page_id: 'page-4',
    content: 'x', manifest_id: manifest.id, campaign_id: campaign.id,
    campaign_recipient_id: recipient.id, campaign_attempt_id: 'attempt-1',
    idempotency_key: 'campaign:' + campaign.id + ':recipient:' + recipient.id + ':attempt:1'
  }, db);
  queueWorker.configure({ database: db, getConnection: () => null, campaignEnabled: () => true, onQueueFail: () => {} });
  const firstAttempt = await queueWorker.processNext();
  assert.equal(firstAttempt.outcome, 'failed', 'no extension connection must fail this attempt');

  // Retry re-dispatches the SAME manifest and route as attempt 2 - this
  // mirrors what CampaignRunner does on automatic/manual retry.
  const { queueId: retryQueueId } = MessageQueueRepository.insertCampaignDispatch({
    thread_id: recipient.thread_id, account_id: recipient.account_id,
    source_id: 'src-page-4', source_type: 'page_messenger', page_id: 'page-4',
    content: 'x', manifest_id: manifest.id, campaign_id: campaign.id,
    campaign_recipient_id: recipient.id, campaign_attempt_id: 'attempt-2',
    idempotency_key: 'campaign:' + campaign.id + ':recipient:' + recipient.id + ':attempt:2'
  }, db);
  queueWorker.configure({ database: db, getConnection: () => ws, campaignEnabled: () => true, onQueueFail: () => {} });
  const retryDispatch = await queueWorker.processNext();

  assert.equal(retryDispatch.outcome, 'dispatched');
  assert.equal(sentEnvelopes.length, 1);
  assert.equal(sentEnvelopes[0].data.page_id, 'page-4');
  assert.equal(sentEnvelopes[0].data.source_type, 'page_messenger');
  assert.deepEqual(sentEnvelopes[0].data.attachment_manifest.map((item) => item.name).sort(), ['a.txt', 'b.txt']);
  assert.equal(MessageQueueRepository.getStatus(retryQueueId, db).status, 'processing');

  // Exactly one queue row for this recipient is ever in-flight at a time.
  const inFlight = db.prepare(
    "SELECT COUNT(*) AS count FROM message_queue WHERE campaign_recipient_id = ? AND status = 'processing'"
  ).get(recipient.id);
  assert.equal(inFlight.count, 1);
})));
