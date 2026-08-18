import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidHexColor,
  isCanonicalHexColor,
  normalizeHexColor,
  hexToRgb,
  rgbToHex,
  getLuminance,
  getContrastRatio,
  getContrastTextColor,
  getStatusBadgeStyle
} from '../../src/client/utils/color.js';

describe('color.js utilities', () => {
  describe('isValidHexColor', () => {
    test('accepts valid 6-digit hex colors with leading hash', () => {
      assert.equal(isValidHexColor('#176CCD'), true);
      assert.equal(isValidHexColor('#176ccd'), true);
      assert.equal(isValidHexColor('#000000'), true);
      assert.equal(isValidHexColor('#FFFFFF'), true);
      assert.equal(isValidHexColor('  #2684FF  '), true);
    });

    test('rejects short hex, alpha hex, missing hash, or invalid characters', () => {
      assert.equal(isValidHexColor('#FFF'), false);
      assert.equal(isValidHexColor('#176CCDFF'), false);
      assert.equal(isValidHexColor('176CCD'), false);
      assert.equal(isValidHexColor('#GGGGGG'), false);
      assert.equal(isValidHexColor('blue'), false);
      assert.equal(isValidHexColor(''), false);
      assert.equal(isValidHexColor(null), false);
      assert.equal(isValidHexColor(undefined), false);
      assert.equal(isValidHexColor(123456), false);
    });
  });

  describe('isCanonicalHexColor', () => {
    test('accepts only uppercase #RRGGBB format', () => {
      assert.equal(isCanonicalHexColor('#176CCD'), true);
      assert.equal(isCanonicalHexColor('#000000'), true);
      assert.equal(isCanonicalHexColor('#FFFFFF'), true);
    });

    test('rejects lowercase hex or unpadded/unhashed strings', () => {
      assert.equal(isCanonicalHexColor('#176ccd'), false);
      assert.equal(isCanonicalHexColor('176CCD'), false);
      assert.equal(isCanonicalHexColor('#FFF'), false);
      assert.equal(isCanonicalHexColor('#176CCD88'), false);
    });
  });

  describe('normalizeHexColor', () => {
    test('normalizes lowercase and unhashed hex into canonical uppercase #RRGGBB', () => {
      assert.equal(normalizeHexColor('#176ccd'), '#176CCD');
      assert.equal(normalizeHexColor('176ccd'), '#176CCD');
      assert.equal(normalizeHexColor('  #2684ff  '), '#2684FF');
      assert.equal(normalizeHexColor('2684ff'), '#2684FF');
      assert.equal(normalizeHexColor('#FFFFFF'), '#FFFFFF');
      assert.equal(normalizeHexColor('#000000'), '#000000');
    });

    test('returns null for invalid inputs, 3-digit hex, and 8-digit alpha hex', () => {
      assert.equal(normalizeHexColor('#fff'), null);
      assert.equal(normalizeHexColor('#12345678'), null);
      assert.equal(normalizeHexColor('red'), null);
      assert.equal(normalizeHexColor(''), null);
      assert.equal(normalizeHexColor(null), null);
      assert.equal(normalizeHexColor(undefined), null);
      assert.equal(normalizeHexColor({}), null);
    });
  });

  describe('hexToRgb and rgbToHex', () => {
    test('converts hex to RGB components and back', () => {
      assert.deepEqual(hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });
      assert.deepEqual(hexToRgb('#00FF00'), { r: 0, g: 255, b: 0 });
      assert.deepEqual(hexToRgb('#0000FF'), { r: 0, g: 0, b: 255 });
      assert.deepEqual(hexToRgb('#176CCD'), { r: 23, g: 108, b: 205 });

      assert.equal(rgbToHex(255, 0, 0), '#FF0000');
      assert.equal(rgbToHex(23, 108, 205), '#176CCD');
    });

    test('returns null for invalid hex in hexToRgb', () => {
      assert.equal(hexToRgb('invalid'), null);
      assert.equal(hexToRgb(null), null);
    });
  });

  describe('luminance and contrast', () => {
    test('calculates correct relative luminance', () => {
      assert.equal(getLuminance('#000000'), 0);
      assert.equal(getLuminance('#FFFFFF'), 1);
      assert.ok(getLuminance('#FFFF00') > getLuminance('#0000FF'));
    });

    test('calculates contrast ratio correctly', () => {
      const whiteBlackRatio = getContrastRatio('#FFFFFF', '#000000');
      assert.equal(Math.round(whiteBlackRatio), 21);

      const sameColorRatio = getContrastRatio('#176CCD', '#176CCD');
      assert.equal(sameColorRatio, 1);
    });

    test('getContrastTextColor returns dark text for light bg and light text for dark bg', () => {
      assert.equal(getContrastTextColor('#FFFFFF'), '#111827');
      assert.equal(getContrastTextColor('#FFFF00'), '#111827');
      assert.equal(getContrastTextColor('#000000'), '#FFFFFF');
      assert.equal(getContrastTextColor('#176CCD'), '#FFFFFF');
    });
  });

  describe('getStatusBadgeStyle', () => {
    test('returns a solid badge with the higher-contrast text color', () => {
      const style = getStatusBadgeStyle('#176ccd');
      assert.deepEqual(style, {
        backgroundColor: '#176CCD',
        color: '#FFFFFF'
      });
      assert.deepEqual(getStatusBadgeStyle('#FFFF00'), {
        backgroundColor: '#FFFF00',
        color: '#111827'
      });
    });

    test('returns empty object for invalid color', () => {
      assert.deepEqual(getStatusBadgeStyle('invalid'), {});
      assert.deepEqual(getStatusBadgeStyle(null), {});
    });
  });
});
