/**
 * Pure color utility functions for Lead Status Color Picker (Spec 022)
 * Handles validation, normalization to uppercase #RRGGBB, and contrast calculations.
 */

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const CANONICAL_HEX_REGEX = /^#[0-9A-F]{6}$/;

/**
 * Validates if a value is a valid 6-digit hex color with leading #
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidHexColor(value) {
  if (typeof value !== 'string') return false;
  return HEX_COLOR_REGEX.test(value.trim());
}

/**
 * Validates if a value is in strict canonical format (#RRGGBB, uppercase)
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalHexColor(value) {
  if (typeof value !== 'string') return false;
  return CANONICAL_HEX_REGEX.test(value);
}

/**
 * Normalizes input to uppercase #RRGGBB hex format.
 * Accepts strings with or without leading '#', case-insensitive.
 * Rejects short hex (#RGB), alpha (#RRGGBBAA), and invalid characters.
 * @param {unknown} value
 * @returns {string|null} Canonical uppercase #RRGGBB or null if invalid
 */
export function normalizeHexColor(value) {
  if (typeof value !== 'string') return null;
  let str = value.trim();
  if (str.startsWith('#')) {
    str = str.slice(1);
  }
  if (str.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(str)) {
    return null;
  }
  return '#' + str.toUpperCase();
}

/**
 * Converts a hex color string to RGB components.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }|null}
 */
export function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const num = parseInt(normalized.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Converts RGB components to canonical uppercase #RRGGBB.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(Number(val) || 0)));
  const toHex = (val) => clamp(val).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates WCAG 2.1 relative luminance for a hex color.
 * Range: 0.0 (darkest black) to 1.0 (lightest white).
 * @param {string} hex
 * @returns {number}
 */
export function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates contrast ratio between two colors (1 to 21).
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns light or dark text color based on background luminance for readability.
 * @param {string} bgHex
 * @param {string} darkColor
 * @param {string} lightColor
 * @returns {string}
 */
export function getContrastTextColor(bgHex, darkColor = '#111827', lightColor = '#FFFFFF') {
  return getContrastRatio(bgHex, darkColor) >= getContrastRatio(bgHex, lightColor)
    ? darkColor
    : lightColor;
}

/**
 * Computes a status badge style with transparent background and readable text.
 * @param {string} colorHex
 * @returns {React.CSSProperties}
 */
export function getStatusBadgeStyle(colorHex) {
  const hex = normalizeHexColor(colorHex);
  if (!hex) return {};
  return {
    backgroundColor: hex,
    color: getContrastTextColor(hex)
  };
}
