const test = require('node:test');
const assert = require('node:assert/strict');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const { seedPageThread, withCampaignDatabase } = require('./campaignTestUtils');

test('campaign lifecycle rejects invalid and duplicate transitions atomically', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-1' });
  const campaign = CampaignService.createDraft({
    name: 'Lifecycle',
    thread_ids: ['thread-1'],
    message: 'Hello',
    send_cap: 1
  }, db);

  assert.throws(() => CampaignService.assertTransition(campaign.id, 'start', db), (error) => error.code === 'CAMPAIGN_STATE_CONFLICT');
  CampaignService.preview(campaign.id, db);
  const ready = CampaignService.assertTransition(campaign.id, 'start', db);
  assert.equal(ready.status, 'ready');
  assert.equal(CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db), true);
  assert.equal(CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db), false);
  assert.throws(() => CampaignService.assertTransition(campaign.id, 'resume', db), (error) => error.code === 'CAMPAIGN_STATE_CONFLICT');
}));

test('cancel marks only unsent recipients and preserves sent results', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-1' });
  seedPageThread(db, { id: 'thread-2' });
  const campaign = CampaignService.createDraft({
    name: 'Cancel',
    thread_ids: ['thread-1', 'thread-2'],
    message: 'Hello',
    send_cap: 2
  }, db);
  CampaignService.preview(campaign.id, db);
  const first = CampaignRepository.getNextRecipient(campaign.id, db);
  const attempt = CampaignRepository.createAttempt(first.id, first.campaign_message_id, db);
  CampaignRepository.finishAttempt(attempt.id, 'confirmed', null, null, db);
  CampaignRepository.cancelPending(campaign.id, db);

  const latest = CampaignRepository.getCampaign(campaign.id, db);
  assert.deepEqual(latest.recipients.map((item) => item.status), ['sent', 'cancelled']);
}));
