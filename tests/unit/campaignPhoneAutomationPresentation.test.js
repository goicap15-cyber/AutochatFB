import test from 'node:test';
import assert from 'node:assert/strict';
import { getPhoneAutomationRecommendation, preservePhoneAutomationDraft } from '../../src/client/utils/campaignPhoneAutomation.js';

test('recommends Đã có số and safe-stop for a new campaign', () => {
  const recommendation = getPhoneAutomationRecommendation([
    { id: 4, name: 'Đang xử lý' },
    { id: 8, name: 'Đã có số' }
  ]);
  assert.deepEqual(recommendation, { policy: 'stop_remaining', statusId: '8', statusName: 'Đã có số' });
});

test('does not recommend automation when the reusable status is absent', () => {
  assert.deepEqual(getPhoneAutomationRecommendation([{ id: 4, name: 'Đang xử lý' }]), { policy: 'continue', statusId: '', statusName: '' });
});

test('never overwrites an operator draft after they change policy or target status', () => {
  const draft = { policy: 'thank_then_stop', statusId: '14' };
  assert.deepEqual(preservePhoneAutomationDraft(draft, { policy: 'stop_remaining', statusId: '8' }, true), draft);
  assert.deepEqual(preservePhoneAutomationDraft(draft, { policy: 'stop_remaining', statusId: '8' }, false), { policy: 'stop_remaining', statusId: '8' });
});
