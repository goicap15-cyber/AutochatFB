import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultFilters,
  matchesConversationFilters,
  normalizeFilters,
  toggleQuickFilter,
  getAvailableTagOptions
} from '../../src/client/utils/conversationFilters.js';

const NOW = Date.parse('2026-08-14T08:00:00.000Z');
const baseThread = {
  id: 't-1', source_type: 'page_messenger', source_id: 'page-1', status: 'ASSIGNED', status_id: 2,
  tags: JSON.stringify(['VIP', 'Quan tâm']), is_unread: 1, phone: '0901', email: null, address: 'Hà Nội',
  reminder_due_at: '2026-08-14T07:30:00.000Z', reminder_status: 'active', archived_at: null,
  last_activity: '2026-08-13T12:00:00.000Z'
};

describe('advanced conversation filters (Spec 033)', () => {
  test('matches OR within groups and AND across groups', () => {
    const filters = normalizeFilters({ sourceKeys: ['type:personal_messenger', 'source:page-1'], workflowStates: ['ASSIGNED'], tagNames: ['VIP', 'Khách cũ'] });
    assert.equal(matchesConversationFilters(baseThread, filters, NOW), true);
    assert.equal(matchesConversationFilters({ ...baseThread, status: 'COMPLETED' }, filters, NOW), false);
    assert.equal(matchesConversationFilters({ ...baseThread, tags: JSON.stringify(['Khách mới']) }, filters, NOW), false);
  });

  test('matches quick filters for due, unread, VIP and needing work', () => {
    for (const key of ['due', 'unread', 'vip', 'needs_work']) {
      const filters = toggleQuickFilter(createDefaultFilters(), key);
      assert.equal(matchesConversationFilters(baseThread, filters, NOW), true, key);
    }
    assert.equal(matchesConversationFilters({ ...baseThread, reminder_due_at: '2026-08-14T09:00:00.000Z' }, toggleQuickFilter(createDefaultFilters(), 'due'), NOW), false);
  });

  test('keeps an incomplete manual draft while quick filters are toggled', () => {
    const draft = { ...normalizeFilters(createDefaultFilters()), rules: [{ id: 'draft', field: 'tag', operator: 'has', value: '' }] };
    const next = toggleQuickFilter(draft, 'vip');
    assert.equal(next.quickFilters.includes('vip'), true);
    assert.deepEqual(next.rules, draft.rules);
  });

  test('derives stable display options from serialized tags', () => {
    assert.deepEqual(getAvailableTagOptions([{ tags: '["VIP", "Quan tâm"]' }, { tags: '["vip", "Khách mới"]' }]), [
      { value: 'khách mới', label: 'Khách mới' },
      { value: 'quan tâm', label: 'Quan tâm' },
      { value: 'vip', label: 'VIP' }
    ]);
  });

  test('supports contact, reminder, archive and activity grouped choices', () => {
    const filters = normalizeFilters({ contactFields: ['phone', 'email'], reminderStates: ['due'], archiveScope: 'inbox', activityRange: { type: 'last7' } });
    assert.equal(matchesConversationFilters(baseThread, filters, NOW), true);
    assert.equal(matchesConversationFilters({ ...baseThread, archived_at: '2026-08-13T10:00:00.000Z', reminder_due_at: null }, filters, NOW), false);
  });

  test('requires every valid manual rule and rejects incomplete rules', () => {
    const filters = normalizeFilters({ rules: [
      { id: 'a', field: 'tag', operator: 'has', value: 'VIP' },
      { id: 'b', field: 'contact', operator: 'has', value: 'address' },
      { id: 'c', field: 'activity', operator: 'after', value: '2026-08-10' }
    ] });
    assert.equal(matchesConversationFilters(baseThread, filters, NOW), true);
    assert.equal(matchesConversationFilters({ ...baseThread, address: null }, filters, NOW), false);
    assert.equal(normalizeFilters({ rules: [{ id: 'bad', field: 'tag', operator: 'has', value: '' }] }).rules.length, 0);
  });
});
