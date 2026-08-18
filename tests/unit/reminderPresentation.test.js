import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getReminderDueState,
  getReminderDueAriaLabel,
  sortDueReminders
} from '../../src/client/utils/reminderPresentation.js';

const NOW = Date.parse('2026-08-14T08:00:00.000Z');

const thread = (id, dueAt, reminderStatus = 'active') => ({
  id,
  reminder_due_at: dueAt,
  reminder_status: reminderStatus
});

describe('reminder presentation utilities (Spec 032)', () => {
  test('treats active past and current reminders as due but future and invalid values as calm', () => {
    assert.equal(getReminderDueState(thread('past', '2026-08-14T07:59:00.000Z'), NOW).isDue, true);
    assert.equal(getReminderDueState(thread('now', '2026-08-14T08:00:00.000Z'), NOW).isDue, true);
    assert.equal(getReminderDueState(thread('future', '2026-08-14T08:01:00.000Z'), NOW).isDue, false);
    assert.equal(getReminderDueState(thread('bad', 'not-a-date'), NOW).isDue, false);
    assert.equal(getReminderDueState(thread('completed', '2026-08-14T07:00:00.000Z', 'completed'), NOW).isDue, false);
  });

  test('renders Vietnamese urgency boundaries for due now, minutes, hours and days', () => {
    assert.equal(getReminderDueState(thread('now', '2026-08-14T08:00:00.000Z'), NOW).label, 'Đến hạn');
    assert.equal(getReminderDueState(thread('minutes', '2026-08-14T07:40:00.000Z'), NOW).label, 'Quá 20 phút');
    assert.equal(getReminderDueState(thread('hours', '2026-08-14T05:00:00.000Z'), NOW).label, 'Quá 3 giờ');
    assert.equal(getReminderDueState(thread('days', '2026-08-12T08:00:00.000Z'), NOW).label, 'Quá 2 ngày');
  });

  test('creates an accessible urgency label with optional reminder note', () => {
    const due = { ...thread('a', '2026-08-14T07:40:00.000Z'), reminder_note: 'Gọi lại báo giá' };
    assert.equal(getReminderDueAriaLabel(due, NOW), 'Cần nhắc, quá 20 phút. Gọi lại báo giá');
    assert.equal(getReminderDueAriaLabel(thread('b', '2026-08-14T08:30:00.000Z'), NOW), 'Không có lời nhắc đến hạn');
  });

  test('moves only due conversations first and preserves order within both groups', () => {
    const original = [
      thread('normal-a', '2026-08-14T09:00:00.000Z'),
      thread('due-a', '2026-08-14T07:50:00.000Z'),
      thread('normal-b', null),
      thread('due-b', '2026-08-14T07:10:00.000Z'),
      thread('invalid', 'bad-value')
    ];
    const ordered = sortDueReminders(original, NOW);
    assert.deepEqual(ordered.map((item) => item.id), ['due-a', 'due-b', 'normal-a', 'normal-b', 'invalid']);
    assert.deepEqual(original.map((item) => item.id), ['normal-a', 'due-a', 'normal-b', 'due-b', 'invalid']);
  });
});
