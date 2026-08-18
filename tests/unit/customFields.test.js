import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LABEL_LENGTH,
  MAX_VALUE_LENGTH,
  MAX_CUSTOM_FIELDS_PER_CONTACT,
  normalizeCustomField,
  parseCustomFields,
  validateCustomField,
  addCustomField,
  removeCustomField,
  areCustomFieldsEqual
} from '../../src/client/utils/customFields.js';

describe('customFields.js utilities', () => {
  describe('limit constants', () => {
    test('exposes expected limits', () => {
      assert.equal(MAX_LABEL_LENGTH, 40);
      assert.equal(MAX_VALUE_LENGTH, 200);
      assert.equal(MAX_CUSTOM_FIELDS_PER_CONTACT, 20);
    });
  });

  describe('normalizeCustomField', () => {
    test('trims whitespace on both label and value', () => {
      assert.deepEqual(normalizeCustomField({ label: '  Công ty  ', value: '  ABC Corp  ' }), { label: 'Công ty', value: 'ABC Corp' });
      assert.deepEqual(normalizeCustomField(null), { label: '', value: '' });
      assert.deepEqual(normalizeCustomField({ label: 123, value: 456 }), { label: '', value: '' });
    });
  });

  describe('parseCustomFields', () => {
    test('parses array of {label, value} pairs and trims whitespace', () => {
      const input = [{ label: ' Công ty ', value: ' ABC ' }, { label: '  ', value: 'ignored' }];
      assert.deepEqual(parseCustomFields(input), [{ label: 'Công ty', value: 'ABC' }]);
    });

    test('parses JSON string representation', () => {
      assert.deepEqual(parseCustomFields('[{"label":"Công ty","value":"ABC"}]'), [{ label: 'Công ty', value: 'ABC' }]);
      assert.deepEqual(parseCustomFields('[]'), []);
    });

    test('returns empty array on malformed JSON string without crashing', () => {
      assert.deepEqual(parseCustomFields('{not valid json}'), []);
      assert.deepEqual(parseCustomFields('null'), []);
      assert.deepEqual(parseCustomFields(null), []);
      assert.deepEqual(parseCustomFields(undefined), []);
      assert.deepEqual(parseCustomFields(12345), []);
      assert.deepEqual(parseCustomFields('not-an-array'), []);
    });

    test('drops malformed entries but keeps valid ones in the same array', () => {
      const input = [{ label: 'Công ty', value: 'ABC' }, 'not-an-object', { value: 'no label' }, null];
      assert.deepEqual(parseCustomFields(input), [{ label: 'Công ty', value: 'ABC' }]);
    });

    test('allows duplicate labels (no dedup, unlike tags)', () => {
      const input = [{ label: 'Công ty', value: 'A' }, { label: 'Công ty', value: 'B' }];
      assert.deepEqual(parseCustomFields(input), input);
    });
  });

  describe('validateCustomField', () => {
    test('accepts valid new field', () => {
      const result = validateCustomField({ label: '  Công ty  ', value: '  ABC  ' }, []);
      assert.equal(result.valid, true);
      assert.equal(result.error, null);
      assert.deepEqual(result.normalized, { label: 'Công ty', value: 'ABC' });
    });

    test('rejects empty label', () => {
      const result = validateCustomField({ label: '   ', value: 'x' }, []);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('không được để trống'));
    });

    test('accepts empty value (only label is required)', () => {
      const result = validateCustomField({ label: 'Công ty', value: '' }, []);
      assert.equal(result.valid, true);
    });

    test('rejects control characters in label or value', () => {
      assert.equal(validateCustomField({ label: 'Tag\x00Invalid', value: '' }, []).valid, false);
      assert.equal(validateCustomField({ label: 'Ok', value: 'Val\x00Invalid' }, []).valid, false);
    });

    test('rejects label exceeding 40 characters', () => {
      const longLabel = 'A'.repeat(41);
      const result = validateCustomField({ label: longLabel, value: '' }, []);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('tối đa 40 ký tự'));
    });

    test('rejects value exceeding 200 characters', () => {
      const longValue = 'A'.repeat(201);
      const result = validateCustomField({ label: 'Ok', value: longValue }, []);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('tối đa 200 ký tự'));
    });

    test('allows duplicate label (unlike tags)', () => {
      const result = validateCustomField({ label: 'Công ty', value: 'B' }, [{ label: 'Công ty', value: 'A' }]);
      assert.equal(result.valid, true);
    });

    test('rejects addition when already at max 20 fields', () => {
      const maxed = Array.from({ length: 20 }, (_, i) => ({ label: `Field ${i + 1}`, value: '' }));
      const result = validateCustomField({ label: 'New Field', value: '' }, maxed);
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('tối đa'));
    });
  });

  describe('addCustomField and removeCustomField', () => {
    test('adds valid new field to the end', () => {
      const initial = [{ label: 'Công ty', value: 'ABC' }];
      const { fields, error } = addCustomField(initial, { label: 'Ngày sinh', value: '01/01' });
      assert.equal(error, null);
      assert.deepEqual(fields, [{ label: 'Công ty', value: 'ABC' }, { label: 'Ngày sinh', value: '01/01' }]);
    });

    test('removes field by index and preserves the rest', () => {
      const initial = [{ label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' }];
      const after = removeCustomField(initial, 1);
      assert.deepEqual(after, [{ label: 'A', value: '1' }, { label: 'C', value: '3' }]);
    });

    test('remove on out-of-range index returns unchanged list', () => {
      const initial = [{ label: 'A', value: '1' }];
      const after = removeCustomField(initial, 5);
      assert.deepEqual(after, initial);
    });
  });

  describe('areCustomFieldsEqual', () => {
    test('returns true for matching arrays', () => {
      const a = [{ label: 'Công ty', value: 'ABC' }];
      const b = [{ label: 'Công ty', value: 'ABC' }];
      assert.equal(areCustomFieldsEqual(a, b), true);
      assert.equal(areCustomFieldsEqual([], []), true);
    });

    test('returns false for different contents, order, or lengths', () => {
      assert.equal(areCustomFieldsEqual([{ label: 'A', value: '1' }], [{ label: 'A', value: '2' }]), false);
      assert.equal(areCustomFieldsEqual([{ label: 'A', value: '1' }], [{ label: 'A', value: '1' }, { label: 'B', value: '2' }]), false);
      assert.equal(
        areCustomFieldsEqual([{ label: 'A', value: '1' }, { label: 'B', value: '2' }], [{ label: 'B', value: '2' }, { label: 'A', value: '1' }]),
        false
      );
    });
  });
});
