const test = require('node:test');
const assert = require('node:assert/strict');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const CampaignRecoveryService = require('../../src/server/services/CampaignRecoveryService');
const { seedPageThread, withCampaignDatabase } = require('./campaignTestUtils');

test('recovery marks orphaned in-flight work unknown without redispatching', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-1' });
  const campaign = CampaignService.createDraft({
    name: 'Recovery',
    thread_ids: ['thread-1'],
    message: 'Hello',
    send_cap: 1
  }, db);
  CampaignService.preview(campaign.id, db);
  CampaignRepository.updateCampaignStatus(campaign.id, 'ready', 'running', db);
  const recipient = CampaignRepository.getNextRecipient(campaign.id, db);
  CampaignRepository.createAttempt(recipient.id, recipient.campaign_message_id, db);

  const summary = CampaignRecoveryService.reconcile({ database: db, getQueueStatus: () => null });
  assert.equal(summary.unknown_attempts, 1);

  const latest = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(latest.recipients[0].status, 'failed');
  assert.equal(latest.attempts[0].status, 'unknown');
  assert.equal(latest.audit.some((event) => event.event_type === 'recovery_attempt_unknown'), true);
}));

test('audit events retain actor and immutable delivery history', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-1' });
  const campaign = CampaignService.createDraft({
    name: 'Audit',
    thread_ids: ['thread-1'],
    message: 'Hello',
    created_by: 1,
    send_cap: 1
  }, db);
  CampaignRepository.addAudit(campaign.id, 'started', { source: 'test' }, null, db, { actorUserId: 1, actorType: 'operator' });
  const audit = CampaignRepository.getCampaign(campaign.id, db).audit;
  assert.equal(audit.at(-1).actor_user_id, 1);
  assert.equal(audit.at(-1).actor_type, 'operator');
  assert.deepEqual(audit.at(-1).payload, { source: 'test' });
}));
