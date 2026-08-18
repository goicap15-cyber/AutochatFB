import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_TYPE_KEYS,
  createDefaultFilters,
  cloneFilters,
  countActiveFilters,
  hasActiveFilters,
  areFiltersEqual,
  sanitizeFilters
} from '../../src/client/utils/conversationFilters.js';

describe('ConversationFilterPopover state & lifecycle logic', () => {
  describe('Draft Isolation', () => {
    test('editing draft does not mutate applied filters', () => {
      const applied = { sourceKeys: [SOURCE_TYPE_KEYS.PERSONAL], statusIds: ['1'] };
      let draft = cloneFilters(applied);

      // User adds Page and status 2 to draft
      draft.sourceKeys.push(SOURCE_TYPE_KEYS.PAGE);
      draft.statusIds.push('2');

      assert.deepEqual(applied, { sourceKeys: [SOURCE_TYPE_KEYS.PERSONAL], statusIds: ['1'] });
      assert.deepEqual(draft, { sourceKeys: [SOURCE_TYPE_KEYS.PERSONAL, SOURCE_TYPE_KEYS.PAGE], statusIds: ['1', '2'] });
    });

    test('cancel/dismiss discards draft and keeps applied filters intact', () => {
      const applied = { sourceKeys: [SOURCE_TYPE_KEYS.PERSONAL], statusIds: [] };
      let draft = cloneFilters(applied);

      // Modify draft
      draft.sourceKeys = [];
      draft.statusIds = ['5'];

      // Discard / cancel action
      draft = cloneFilters(applied);

      assert.deepEqual(draft, { sourceKeys: [SOURCE_TYPE_KEYS.PERSONAL], statusIds: [] });
    });

    test('clear all resets draft to empty', () => {
      let draft = { sourceKeys: [SOURCE_TYPE_KEYS.PAGE, 'source:s1'], statusIds: ['1', '2'] };
      draft = createDefaultFilters();

      assert.deepEqual(draft, { sourceKeys: [], statusIds: [] });
      assert.equal(countActiveFilters(draft), 0);
      assert.equal(hasActiveFilters(draft), false);
    });

    test('apply sanitizes draft and updates applied state', () => {
      const draft = {
        sourceKeys: [SOURCE_TYPE_KEYS.PAGE, 'source:s-valid', 'source:s-deleted'],
        statusIds: ['10', '999'] // 10 is valid, 999 is deleted
      };

      const sources = [{ id: 's-valid', source_type: 'page_messenger', display_name: 'Valid Page' }];
      const statuses = [{ id: 10, name: 'Lead VIP' }];

      const sanitized = sanitizeFilters(draft, sources, statuses);
      assert.deepEqual(sanitized, {
        sourceKeys: [SOURCE_TYPE_KEYS.PAGE, 'source:s-valid'],
        statusIds: ['10']
      });
    });
  });
});
