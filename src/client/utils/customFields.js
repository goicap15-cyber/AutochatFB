/**
 * Pure utility functions for free-form custom contact detail fields.
 * Mirrors src/client/utils/tags.js's shape (parse/validate/add/remove/equality)
 * but each entry is a {label, value} pair instead of a single string, and there
 * is no case-insensitive dedup - unlike tags, custom fields aren't a toggle-once
 * selection, so two fields sharing a label isn't an error.
 */

export const MAX_LABEL_LENGTH = 40;
export const MAX_VALUE_LENGTH = 200;
export const MAX_CUSTOM_FIELDS_PER_CONTACT = 20;

/**
 * Normalizes a single field by trimming both label and value.
 * @param {unknown} field
 * @returns {{ label: string, value: string }}
 */
export function normalizeCustomField(field) {
  if (!field || typeof field !== 'object') return { label: '', value: '' };
  const label = typeof field.label === 'string' ? field.label.trim() : '';
  const value = typeof field.value === 'string' ? field.value.trim() : '';
  return { label, value };
}

/**
 * Safely parses a stored JSON array into a clean array of {label, value}
 * pairs, dropping malformed entries instead of failing the whole parse.
 * @param {unknown} rawFields
 * @returns {{ label: string, value: string }[]}
 */
export function parseCustomFields(rawFields) {
  if (!rawFields) return [];

  let candidates = [];
  if (Array.isArray(rawFields)) {
    candidates = rawFields;
  } else if (typeof rawFields === 'string') {
    const trimmed = rawFields.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          candidates = parsed;
        } else {
          return [];
        }
      } catch (_) {
        return [];
      }
    } else return [];
  }

  const result = [];
  for (const item of candidates) {
    const clean = normalizeCustomField(item);
    if (!clean.label) continue;
    result.push(clean);
  }
  return result;
}

/**
 * Validates a candidate field against label/value length, control characters,
 * and max item count. No duplicate-label check - see file header.
 * @param {{ label: string, value: string }} candidateField
 * @param {{ label: string, value: string }[]} existingFields
 * @returns {{ valid: boolean, error: string | null, normalized: { label: string, value: string } }}
 */
export function validateCustomField(candidateField, existingFields = []) {
  const normalized = normalizeCustomField(candidateField);

  if (!normalized.label) {
    return { valid: false, error: 'Tên trường không được để trống.', normalized };
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(normalized.label) || /[\x00-\x1F\x7F]/.test(normalized.value)) {
    return { valid: false, error: 'Nội dung chứa ký tự không hợp lệ.', normalized };
  }

  if (normalized.label.length > MAX_LABEL_LENGTH) {
    return {
      valid: false,
      error: `Tên trường tối đa ${MAX_LABEL_LENGTH} ký tự (hiện tại ${normalized.label.length}).`,
      normalized
    };
  }

  if (normalized.value.length > MAX_VALUE_LENGTH) {
    return {
      valid: false,
      error: `Giá trị tối đa ${MAX_VALUE_LENGTH} ký tự (hiện tại ${normalized.value.length}).`,
      normalized
    };
  }

  if (existingFields.length >= MAX_CUSTOM_FIELDS_PER_CONTACT) {
    return {
      valid: false,
      error: `Mỗi khách hàng tối đa ${MAX_CUSTOM_FIELDS_PER_CONTACT} trường chi tiết.`,
      normalized
    };
  }

  return { valid: true, error: null, normalized };
}

/**
 * Adds a new field to the list if valid.
 * @param {{ label: string, value: string }[]} fieldList
 * @param {{ label: string, value: string }} newField
 * @returns {{ fields: { label: string, value: string }[], error: string | null }}
 */
export function addCustomField(fieldList, newField) {
  const current = parseCustomFields(fieldList);
  const validation = validateCustomField(newField, current);
  if (!validation.valid) {
    return { fields: current, error: validation.error };
  }
  return { fields: [...current, validation.normalized], error: null };
}

/**
 * Removes a field from the list by index (fields aren't required to have a
 * unique label, so removal is positional, not key-based).
 * @param {{ label: string, value: string }[]} fieldList
 * @param {number} indexToRemove
 * @returns {{ label: string, value: string }[]}
 */
export function removeCustomField(fieldList, indexToRemove) {
  const current = parseCustomFields(fieldList);
  return current.filter((_, idx) => idx !== indexToRemove);
}

/**
 * Compares two field lists for equality (order-sensitive).
 * @param {{ label: string, value: string }[]} listA
 * @param {{ label: string, value: string }[]} listB
 * @returns {boolean}
 */
export function areCustomFieldsEqual(listA, listB) {
  const a = parseCustomFields(listA);
  const b = parseCustomFields(listB);
  if (a.length !== b.length) return false;
  return a.every((field, idx) => field.label === b[idx].label && field.value === b[idx].value);
}
