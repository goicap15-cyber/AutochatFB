const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignAttachmentService = require('../../src/server/services/CampaignAttachmentService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const { seedPageThread, withCampaignDatabase } = require('./campaignTestUtils');

function jpegBytes() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
}

// Builds a raw multipart/form-data buffer the same shape a browser would
// send from CampaignComposer.jsx's uploadFolder(), so parseMultipartBody is
// exercised against real bytes (including a filename containing '/' for the
// folder's relative path) instead of only ever being called with pre-parsed
// JS objects.
function buildMultipartBody(fields, files) {
  const boundary = '----testBoundary' + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    );
  }
  for (const file of files) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="${file.relativePath}"\r\n` +
      `Content-Type: ${file.declaredMimeType}\r\n\r\n`
    ));
    parts.push(file.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(`--${boundary}--\r\n`);
  const buffer = Buffer.concat(parts.map((part) => (Buffer.isBuffer(part) ? part : Buffer.from(part, 'latin1'))));
  return { buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

function withStorage(run) {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-file-persistence-'));
  return Promise.resolve()
    .then(() => run(storageDir))
    .finally(() => fs.rmSync(storageDir, { recursive: true, force: true }));
}

function makeCampaign(db) {
  seedPageThread(db, { id: 'thread-1' });
  return CampaignService.createDraft({
    name: 'File transport', thread_ids: ['thread-1'], message: 'Tài liệu gửi bạn', send_cap: 1
  }, db);
}

test('a single file upload creates no manifest, matching spec 039 behavior', () => withCampaignDatabase((db) => withStorage((storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;
  const saved = CampaignAttachmentService.saveUploads({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    files: [{ originalName: 'a.csv', declaredMimeType: 'text/csv', buffer: Buffer.from('a,b') }]
  }, { database: db, storageDir, fileEnabled: true });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].manifest_id, null);
  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(hydrated.messages[0].manifests.length, 0);
})));

test('multiple independently-selected files are grouped into one "files" manifest', () => withCampaignDatabase((db) => withStorage((storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;
  const saved = CampaignAttachmentService.saveUploads({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    files: [
      { originalName: 'a.csv', declaredMimeType: 'text/csv', buffer: Buffer.from('a,b') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('hello') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  assert.equal(saved.length, 2);
  assert.ok(saved[0].manifest_id, 'both attachments must share a manifest id');
  assert.equal(saved[0].manifest_id, saved[1].manifest_id);

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifests = hydrated.messages[0].manifests;
  assert.equal(manifests.length, 1);
  assert.equal(manifests[0].kind, 'files');
  assert.equal(manifests[0].item_count, 2);
  assert.equal(manifests[0].total_bytes, Buffer.from('a,b').length + Buffer.from('hello').length);
  assert.equal(hydrated.messages[0].attachments.length, 2);
})));

test('a folder selection is packaged into one folder_zip manifest with a real, extractable ZIP', () => withCampaignDatabase((db) => withStorage(async (storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;
  const attachment = await CampaignAttachmentService.saveFolderAsZip({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    archiveName: 'my folder.zip',
    files: [
      { relativePath: 'my-folder/photo.jpg', declaredMimeType: 'image/jpeg', buffer: jpegBytes() },
      { relativePath: 'my-folder/notes/readme.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('hi') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  assert.equal(attachment.media_type, 'file');
  assert.equal(attachment.mime_type, 'application/zip');
  assert.ok(attachment.manifest_id);

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  const manifest = hydrated.messages[0].manifests[0];
  assert.equal(manifest.kind, 'folder_zip');
  assert.equal(manifest.item_count, 2);
  assert.equal(manifest.archive_name, 'my_folder.zip');

  // The stored ZIP must actually contain the two files with their relative
  // paths preserved, not just be an opaque validated blob.
  const zipBytes = fs.readFileSync(attachment.storage_path);
  const zip = await JSZip.loadAsync(zipBytes);
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
  assert.deepEqual(names, ['my-folder/notes/readme.txt', 'my-folder/photo.jpg']);
})));

test('a folder selection with a path-traversal entry is rejected before any file is saved', () => withCampaignDatabase((db) => withStorage(async (storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;

  await assert.rejects(
    () => CampaignAttachmentService.saveFolderAsZip({
      campaignId: campaign.id,
      campaignMessageId: messageId,
      archiveName: 'evil.zip',
      files: [
        { relativePath: 'ok.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('fine') },
        { relativePath: '../../etc/passwd', declaredMimeType: 'text/plain', buffer: Buffer.from('pwn') }
      ]
    }, { database: db, storageDir, fileEnabled: true }),
    (error) => error.code === 'ATTACHMENT_INVALID'
  );

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(hydrated.messages[0].manifests.length, 0, 'no manifest/attachment must be persisted when the folder is rejected');
  assert.equal(hydrated.messages[0].attachments.length, 0);
})));

test('a real multipart/form-data folder upload round-trips through parseMultipartBody into a working ZIP', () => withCampaignDatabase((db) => withStorage(async (storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;

  const { buffer, contentType } = buildMultipartBody(
    { campaign_message_id: messageId, kind: 'folder_zip', archive_name: 'my folder.zip' },
    [
      { relativePath: 'my-folder/a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { relativePath: 'my-folder/nested/b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  );

  // This mirrors exactly what the /api/campaigns/:id/attachments handler in
  // server.js does with req.body/req.headers['content-type'].
  const parsed = CampaignAttachmentService.parseMultipartBody(buffer, contentType);
  assert.equal(parsed.fields.kind, 'folder_zip');
  assert.equal(parsed.fields.campaign_message_id, messageId);
  assert.equal(parsed.files.length, 2);
  assert.equal(parsed.files[0].originalName, 'my-folder/a.txt');

  const attachment = await CampaignAttachmentService.saveFolderAsZip({
    campaignId: campaign.id,
    campaignMessageId: parsed.fields.campaign_message_id,
    archiveName: parsed.fields.archive_name,
    files: parsed.files.map((file) => ({
      relativePath: file.originalName,
      declaredMimeType: file.declaredMimeType,
      buffer: file.buffer
    }))
  }, { database: db, storageDir, fileEnabled: true });

  assert.equal(attachment.mime_type, 'application/zip');
  const zip = await JSZip.loadAsync(fs.readFileSync(attachment.storage_path));
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
  assert.deepEqual(names, ['my-folder/a.txt', 'my-folder/nested/b.txt']);
  assert.equal(await zip.files['my-folder/a.txt'].async('string'), 'alpha');
})));

test('folder attachment is rejected when CAMPAIGN_FILE_ENABLED is off', () => withCampaignDatabase((db) => withStorage(async (storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;

  await assert.rejects(
    () => CampaignAttachmentService.saveFolderAsZip({
      campaignId: campaign.id,
      campaignMessageId: messageId,
      archiveName: 'folder.zip',
      files: [{ relativePath: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('x') }]
    }, { database: db, storageDir, fileEnabled: false })
  );
})));

// Regression: removing a folder ZIP's only attachment used to leave the now-
// empty campaign_attachment_manifests row behind. CampaignRunner picks
// message.manifests[0] for dispatch, so a stale empty manifest sitting next
// to a real, populated one (e.g. a "files" manifest added afterward) could
// get selected instead and fail the whole send with
// ATTACHMENT_MANIFEST_EMPTY - reproduced live before this fix.
test('removing a folder ZIP attachment also removes its now-empty manifest row', () => withCampaignDatabase((db) => withStorage(async (storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;
  const zipAttachment = await CampaignAttachmentService.saveFolderAsZip({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    archiveName: 'folder.zip',
    files: [{ relativePath: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') }]
  }, { database: db, storageDir, fileEnabled: true });

  let hydrated = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(hydrated.messages[0].manifests.length, 1);

  CampaignAttachmentService.removeAttachment(campaign.id, zipAttachment.id, { database: db });

  hydrated = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(hydrated.messages[0].manifests.length, 0, 'the emptied manifest row must be cleaned up, not left orphaned');
  assert.equal(hydrated.messages[0].attachments.length, 0);
})));

test('removing one member of a multi-file manifest keeps the manifest for the remaining member', () => withCampaignDatabase((db) => withStorage((storageDir) => {
  const campaign = makeCampaign(db);
  const messageId = campaign.messages[0].id;
  const saved = CampaignAttachmentService.saveUploads({
    campaignId: campaign.id,
    campaignMessageId: messageId,
    files: [
      { originalName: 'a.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('alpha') },
      { originalName: 'b.txt', declaredMimeType: 'text/plain', buffer: Buffer.from('beta') }
    ]
  }, { database: db, storageDir, fileEnabled: true });

  CampaignAttachmentService.removeAttachment(campaign.id, saved[0].id, { database: db });

  const hydrated = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(hydrated.messages[0].manifests.length, 1, 'the manifest must survive while a member still references it');
  assert.equal(hydrated.messages[0].attachments.length, 1);
  assert.equal(hydrated.messages[0].attachments[0].original_name, 'b.txt');
})));
