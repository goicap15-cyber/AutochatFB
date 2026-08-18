import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STARTER_TAGS,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_CONTACT,
  normalizeTag,
  tagKey,
  parseTags,
  hasTag,
  validateTag,
  addTag,
  removeTag,
  toggleTag,
  areTagsEqual
} from '../../src/client/utils/tags.js';

describe('tags.js utilities', () => {
  describe('STARTER_TAGS constants', () => {
    test('exposes expected starter tags and limits', () => {
      assert.deepEqual(STARTER_TAGS, ['Tiềm năng', 'Quan tâm', 'Cần tư vấn']);
      assert.equal(MAX_TAG_LENGTH, 40);
      assert.equal(MAX_TAGS_PER_CONTACT, 20);
    });
  });

  describe('normalizeTag and tagKey', () => {
    test('trims whitespace and folds case correctly', () => {
      assert.equal(normalizeTag('  Khách VIP  '), 'Khách VIP');
      assert.equal(normalizeTag(null), '');
      assert.equal(tagKey('  Khách VIP  '), 'khách vip');
      assert.equal(tagKey('TIỀM NĂNG'), 'tiềm năng');
    });
  });

  describe('parseTags', () => {
    test('parses array of strings and trims whitespace', () => {
      const input = ['  Tiềm năng ', 'Quan tâm  ', '  '];
      assert.deepEqual(parseTags(input), ['Tiềm năng', 'Quan tâm']);
    });

    test('parses JSON string representation', () => {
      assert.deepEqual(parseTags('["Tiềm năng", "Khách VIP"]'), ['Tiềm năng', 'Khách VIP']);
      assert.deepEqual(parseTags('[]'), []);
    });

    test('returns empty array on malformed JSON string without crashing', () => {
      assert.deepEqual(parseTags('{not valid json}'), []);
      assert.deepEqual(parseTags('null'), []);
      assert.deepEqual(parseTags(null), []);
      assert.deepEqual(parseTags(undefined), []);
      assert.deepEqual(parseTags(12345), []);
    });

    test('deduplicates case-insensitively and preserves first display casing', () => {
      const input = ['Khách VIP', 'khách vip', 'KHÁCH VIP', 'Hà Nội'];
      assert.deepEqual(parseTags(input), ['Khách VIP', 'Hà Nội']);
    });

    test('preserves long and over-limit legacy lists without truncating data', () => {
      const longTag = 'L'.repeat(41);
      const legacyList = [longTag, ...Array.from({ length: 21 }, (_, i) => `Tag ${i + 1}`)];
      const parsed = parseTags(legacyList);
      assert.equal(parsed.length, 22);
      assert.equal(parsed[0], longTag);
      assert.equal(parsed[parsed.length - 1], 'Tag 21');
    });

    test('treats non-JSON stored strings as malformed legacy data', () => {
      assert.deepEqual(parseTags('not-an-array'), []);
    });

    test('preserves arbitrary unknown legacy tags', () => {
      const legacy = ['Hỏi giá sỉ', 'Đã chuyển khoản', 'Mẫu Đầm 02'];
      assert.deepEqual(parseTags(legacy), legacy);
    });
  });

  describe('hasTag', () => {
    test('checks tag membership case-insensitively', () => {
      const tags = ['Tiềm năng', 'Quan tâm'];
      assert.equal(hasTag(tags, 'Tiềm năng'), true);
      assert.equal(hasTag(tags, 'tiềm năng'), true);
      assert.equal(hasTag(tags, 'TIỀM NĂNG'), true);
      assert.equal(hasTag(tags, 'Cần tư vấn'), false);
      assert.equal(hasTag(null, 'Tiềm năng'), false);
    });
  });

  describe('validateTag', () => {
    test('accepts valid new tag', () => {
      const result = validateTag('  Khách Sỉ Hà Nội  ', ['Tiềm năng']);
      assert.equal(result.valid, true);
      assert.equal(result.error, null);
      assert.equal(result.normalized, 'Khách Sỉ Hà Nội');
    });

    test('rejects empty or whitespace-only tag', () => {
      const result = validateTag('   ', []);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('không được để trống'));
    });

    test('rejects control characters', () => {
      const result = validateTag('Tag\x00Invalid', []);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('chứa ký tự không hợp lệ'));
    });

    test('rejects tag exceeding 40 characters', () => {
      const longName = 'A'.repeat(41);
      const result = validateTag(longName, []);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('tối đa 40 ký tự'));
    });

    test('rejects duplicate tag case-insensitively', () => {
      const result = validateTag('tiềm năng', ['Tiềm năng']);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('đã tồn tại'));
    });

    test('rejects addition when already at max 20 tags', () => {
      const maxed = Array.from({ length: 20 }, (_, i) => `Tag ${i + 1}`);
      const result = validateTag('New Tag', maxed);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('tối đa'));
    });
  });

  describe('addTag and removeTag', () => {
    test('adds valid new tag to the end', () => {
      const initial = ['Tiềm năng'];
      const { tags, error } = addTag(initial, 'Khách VIP');
      assert.equal(error, null);
      assert.deepEqual(tags, ['Tiềm năng', 'Khách VIP']);
    });

    test('removes tag case-insensitively and preserves other tags', () => {
      const initial = ['Tiềm năng', 'Quan tâm', 'Khách VIP'];
      const after = removeTag(initial, 'quan tâm');
      assert.deepEqual(after, ['Tiềm năng', 'Khách VIP']);
    });

    test('remove on non-existent tag returns unchanged list', () => {
      const initial = ['Tiềm năng'];
      const after = removeTag(initial, 'Không có');
      assert.deepEqual(after, ['Tiềm năng']);
    });
  });

  describe('toggleTag', () => {
    test('removes tag if already present', () => {
      const initial = ['Tiềm năng', 'Quan tâm'];
      const res = toggleTag(initial, 'tiềm năng');
      assert.equal(res.added, false);
      assert.deepEqual(res.tags, ['Quan tâm']);
    });

    test('adds tag if not present', () => {
      const initial = ['Tiềm năng'];
      const res = toggleTag(initial, 'Cần tư vấn');
      assert.equal(res.added, true);
      assert.deepEqual(res.tags, ['Tiềm năng', 'Cần tư vấn']);
    });
  });

  describe('areTagsEqual', () => {
    test('returns true for matching arrays', () => {
      assert.equal(areTagsEqual(['Tiềm năng', 'Quan tâm'], ['tiềm năng', 'quan tâm']), true);
      assert.equal(areTagsEqual([], []), true);
    });

    test('returns false for different contents or lengths', () => {
      assert.equal(areTagsEqual(['Tiềm năng'], ['Tiềm năng', 'Quan tâm']), false);
      assert.equal(areTagsEqual(['Tiềm năng', 'Quan tâm'], ['Quan tâm', 'Tiềm năng']), false);
    });
  });
});
