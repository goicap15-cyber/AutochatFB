/**
 * Pure utility functions for CRM Lead Tags (Spec 028)
 * Handles parsing, validation, case-insensitive normalization, toggle, add, remove, and equality checks.
 */

export const STARTER_TAGS = ['Tiềm năng', 'Quan tâm', 'Cần tư vấn'];
export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS_PER_CONTACT = 20;

/**
 * Normalizes a single tag by trimming whitespace.
 * @param {unknown} tag
 * @returns {string}
 */
export function normalizeTag(tag) {
  if (typeof tag !== 'string') return '';
  return tag.trim();
}

/**
 * Derives a case-folded key for case-insensitive comparison.
 * @param {unknown} tag
 * @returns {string}
 */
export function tagKey(tag) {
  return normalizeTag(tag).toLowerCase();
}

/**
 * Safely parses a stored JSON array into a clean, deduplicated array of non-empty
 * strings with stable ordering. Limits apply only to newly added tags: never truncate
 * legacy values while reading them.
 * @param {unknown} rawTags
 * @returns {string[]}
 */
export function parseTags(rawTags) {
  if (!rawTags) return [];

  let candidates = [];
  if (Array.isArray(rawTags)) {
    candidates = rawTags;
  } else if (typeof rawTags === 'string') {
    const trimmed = rawTags.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
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

  const seenKeys = new Set();
  const result = [];

  for (const item of candidates) {
    if (typeof item !== 'string') continue;
    const clean = normalizeTag(item);
    if (!clean) continue;
    const key = tagKey(clean);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(clean);
    }
  }

  return result;
}

/**
 * Checks if a tag list contains a target tag (case-insensitive).
 * @param {string[]} tagList
 * @param {string} targetTag
 * @returns {boolean}
 */
export function hasTag(tagList, targetTag) {
  if (!Array.isArray(tagList)) return false;
  const target = tagKey(targetTag);
  if (!target) return false;
  return tagList.some((t) => tagKey(t) === target);
}

/**
 * Validates a candidate tag against length, control characters, max items, and duplicates.
 * @param {string} candidateTag
 * @param {string[]} existingTags
 * @returns {{ valid: boolean, error: string | null, normalized: string }}
 */
export function validateTag(candidateTag, existingTags = []) {
  const normalized = normalizeTag(candidateTag);

  if (!normalized) {
    return { valid: false, error: 'Tên nhãn không được để trống.', normalized: '' };
  }

  // Check for control characters (e.g. \x00-\x1F, \x7F)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return { valid: false, error: 'Tên nhãn chứa ký tự không hợp lệ.', normalized };
  }

  if (normalized.length > MAX_TAG_LENGTH) {
    return {
      valid: false,
      error: `Tên nhãn tối đa ${MAX_TAG_LENGTH} ký tự (hiện tại ${normalized.length}).`,
      normalized
    };
  }

  if (hasTag(existingTags, normalized)) {
    return { valid: false, error: `Nhãn "${normalized}" đã tồn tại trên khách hàng này.`, normalized };
  }

  if (existingTags.length >= MAX_TAGS_PER_CONTACT) {
    return {
      valid: false,
      error: `Mỗi khách hàng tối đa gắn ${MAX_TAGS_PER_CONTACT} nhãn.`,
      normalized
    };
  }

  return { valid: true, error: null, normalized };
}

/**
 * Adds a new tag to the list if valid.
 * @param {string[]} tagList
 * @param {string} newTag
 * @returns {{ tags: string[], error: string | null }}
 */
export function addTag(tagList, newTag) {
  const current = parseTags(tagList);
  const validation = validateTag(newTag, current);
  if (!validation.valid) {
    return { tags: current, error: validation.error };
  }
  return { tags: [...current, validation.normalized], error: null };
}

/**
 * Removes a tag from the list by case-insensitive key.
 * @param {string[]} tagList
 * @param {string} tagToRemove
 * @returns {string[]}
 */
export function removeTag(tagList, tagToRemove) {
  const current = parseTags(tagList);
  const target = tagKey(tagToRemove);
  if (!target) return current;
  return current.filter((t) => tagKey(t) !== target);
}

/**
 * Toggles membership of a tag in the list.
 * @param {string[]} tagList
 * @param {string} tagToToggle
 * @returns {{ tags: string[], added: boolean, error: string | null }}
 */
export function toggleTag(tagList, tagToToggle) {
  const current = parseTags(tagList);
  if (hasTag(current, tagToToggle)) {
    return { tags: removeTag(current, tagToToggle), added: false, error: null };
  }
  const result = addTag(current, tagToToggle);
  return { tags: result.tags, added: result.error == null, error: result.error };
}

/**
 * Compares two tag lists for equality (case-insensitive, preserving order).
 * @param {string[]} listA
 * @param {string[]} listB
 * @returns {boolean}
 */
export function areTagsEqual(listA, listB) {
  const a = parseTags(listA);
  const b = parseTags(listB);
  if (a.length !== b.length) return false;
  return a.every((tag, idx) => tagKey(tag) === tagKey(b[idx]));
}
