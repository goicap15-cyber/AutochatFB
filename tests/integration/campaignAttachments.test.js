const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignAttachmentService = require('../../src/server/services/CampaignAttachmentService');
const { seedPageThread, withCampaignDatabase } = require('./campaignTestUtils');

test('valid image is stored once and invalid media fails before preview', () => withCampaignDatabase((db) => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-attachments-'));
  try {
    seedPageThread(db, { id: 'thread-1' });
    const campaign = CampaignService.createDraft({
      name: 'Image',
      thread_ids: ['thread-1'],
      message: 'Caption',
      send_cap: 1
    }, db);
    const messageId = campaign.messages[0].id;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

    const saved = CampaignAttachmentService.saveUpload({
      campaignId: campaign.id,
      campaignMessageId: messageId,
      originalName: 'photo.jpg',
      declaredMimeType: 'image/jpeg',
      buffer: jpeg
    }, { database: db, storageDir, imageEnabled: true });
    const duplicate = CampaignAttachmentService.saveUpload({
      campaignId: campaign.id,
      campaignMessageId: messageId,
      originalName: 'copy.jpg',
      declaredMimeType: 'image/jpeg',
      buffer: jpeg
    }, { database: db, storageDir, imageEnabled: true });

    assert.equal(saved.id, duplicate.id);
    assert.equal(saved.validation_status, 'valid');
    assert.equal(fs.existsSync(saved.storage_path), true);
    assert.throws(() => CampaignAttachmentService.saveUpload({
      campaignId: campaign.id,
      campaignMessageId: messageId,
      originalName: 'malware.exe',
      declaredMimeType: 'application/octet-stream',
      buffer: Buffer.from('not an image')
    }, { database: db, storageDir, imageEnabled: true }), (error) => error.code === 'ATTACHMENT_INVALID');

    const preview = CampaignService.preview(campaign.id, db, { imageEnabled: true });
    assert.equal(preview.attachments.length, 1);
  } finally {
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}));
