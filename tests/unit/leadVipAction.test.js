import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTag, toggleTag } from '../../src/client/utils/tags.js';

describe('VIP quick action rules (Spec 030)', () => {
  test('adds one canonical VIP tag without changing existing tags', () => {
    const initial = ['Tiềm năng', 'Khách cũ'];
    const result = toggleTag(initial, 'VIP');

    assert.equal(result.error, null);
    assert.equal(result.added, true);
    assert.deepEqual(result.tags, ['Tiềm năng', 'Khách cũ', 'VIP']);
    assert.equal(hasTag(result.tags, 'vip'), true);
  });

  test('removes a legacy VIP spelling case-insensitively without changing other tags', () => {
    const initial = ['Tiềm năng', ' vip ', 'Quan tâm'];
    const result = toggleTag(initial, 'VIP');

    assert.equal(result.error, null);
    assert.equal(result.added, false);
    assert.deepEqual(result.tags, ['Tiềm năng', 'Quan tâm']);
    assert.equal(hasTag(result.tags, 'VIP'), false);
  });

  test('does not add VIP when the contact is already at the tag limit', () => {
    const initial = Array.from({ length: 20 }, (_, index) => 'Nhãn ' + (index + 1));
    const result = toggleTag(initial, 'VIP');

    assert.equal(result.added, false);
    assert.match(result.error || '', /tối đa gắn 20 nhãn/);
    assert.deepEqual(result.tags, initial);
  });

  test('still allows a VIP removal when legacy data exceeds the tag limit', () => {
    const initial = ['VIP', ...Array.from({ length: 20 }, (_, index) => 'Nhãn ' + (index + 1))];
    const result = toggleTag(initial, 'vip');

    assert.equal(result.error, null);
    assert.equal(result.added, false);
    assert.equal(result.tags.length, 20);
    assert.equal(hasTag(result.tags, 'VIP'), false);
  });
});
