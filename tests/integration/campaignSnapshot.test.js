const test = require('node:test');
const assert = require('node:assert/strict');
const CampaignService = require('../../src/server/services/CampaignService');
const CampaignRepository = require('../../src/server/repositories/CampaignRepository');
const { seedPageThread, seedPersonalThread, withCampaignDatabase } = require('./campaignTestUtils');

test('campaign creation stores an immutable server-resolved recipient snapshot', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'thread-1', contactName: 'One' });
  seedPageThread(db, { id: 'thread-2', contactName: 'Two' });
  seedPersonalThread(db, { id: 'thread-personal' });

  const campaign = CampaignService.createDraft({
    name: 'Snapshot',
    thread_ids: ['thread-1', 'thread-2', 'thread-personal'],
    messages: [{ text_content: 'Xin chào' }],
    send_cap: 3
  }, db);

  assert.equal(campaign.recipients.length, 3);
  assert.deepEqual(campaign.recipients.map((item) => item.selection_order), [1, 2, 3]);
  assert.equal(campaign.recipients[0].source_id, 'src-page-1');
  assert.equal(campaign.recipients[0].source_type, 'page_messenger');
  assert.equal(campaign.recipients[2].source_type, 'personal_messenger');
  assert.equal(campaign.recipients[2].eligibility_status, 'eligible');

  db.prepare('DELETE FROM threads WHERE id = ?').run('thread-1');
  const persisted = CampaignRepository.getCampaign(campaign.id, db);
  assert.equal(persisted.recipients.length, 3);
  assert.equal(persisted.recipients[0].thread_id, 'thread-1');
}));

test('opted-out, missing, and disconnected recipients fail closed with reasons', () => withCampaignDatabase((db) => {
  seedPageThread(db, { id: 'opted-out', optOut: true });
  seedPageThread(db, { id: 'disconnected', sourceId: 'src-page-2', pageId: 'page-2', sourceStatus: 'DISCONNECTED' });

  const campaign = CampaignService.createDraft({
    name: 'Eligibility',
    thread_ids: ['opted-out', 'disconnected', 'missing'],
    message: 'Test',
    send_cap: 3
  }, db);

  assert.deepEqual(
    campaign.recipients.map((item) => [item.eligibility_status, item.eligibility_reason]),
    [
      ['opted_out', 'CONTACT_OPTED_OUT'],
      ['ineligible', 'SOURCE_NOT_ACTIVE'],
      ['invalid_route', 'THREAD_NOT_FOUND']
    ]
  );
}));
