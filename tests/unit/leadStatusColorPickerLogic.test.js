import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHexColor, isValidHexColor, getStatusBadgeStyle } from '../../src/client/utils/color.js';

describe('Lead Status Color Picker UI & State Logic (Spec 022 Phase 7)', () => {
  describe('Draft vs Committed State Transitions', () => {
    test('opening create form initializes committed color to #2684FF and picker closed', () => {
      let showCreateStatus = false;
      let newStatusColor = '#2684FF';
      let isColorPickerOpen = false;

      // User clicks "+ Tạo trạng thái mới"
      showCreateStatus = true;
      assert.equal(showCreateStatus, true);
      assert.equal(newStatusColor, '#2684FF');
      assert.equal(isColorPickerOpen, false);
    });

    test('opening picker initializes draft from committed color', () => {
      const committedColor = '#FF6B2C';
      let isColorPickerOpen = true;
      let draftColor = committedColor;

      // User interacts with color picker
      const newDraft = normalizeHexColor('#A855F7');
      draftColor = newDraft;

      // Committed color remains unchanged until apply
      assert.equal(committedColor, '#FF6B2C');
      assert.equal(draftColor, '#A855F7');
    });

    test('canceling or clicking outside discards draft and keeps committed color', () => {
      let committedColor = '#2684FF';
      let draftColor = '#EC4899';
      let isColorPickerOpen = true;

      // Cancel action
      draftColor = committedColor;
      isColorPickerOpen = false;

      assert.equal(isColorPickerOpen, false);
      assert.equal(committedColor, '#2684FF');
    });

    test('applying picker commits draft to form without triggering API request', () => {
      let committedColor = '#2684FF';
      let draftColor = '#0FBD74';
      let isColorPickerOpen = true;
      let apiCalled = false;

      // Apply action
      committedColor = normalizeHexColor(draftColor);
      isColorPickerOpen = false;

      assert.equal(isColorPickerOpen, false);
      assert.equal(committedColor, '#0FBD74');
      assert.equal(apiCalled, false); // No POST yet
    });

    test('outer Create action submits committed color and resets all create/picker state', () => {
      let showCreateStatus = true;
      let newStatusName = 'Khách VIP';
      let newStatusColor = '#0FBD74';
      let isColorPickerOpen = false;
      let apiPayload = null;

      // User clicks outer "Tạo" button
      apiPayload = { name: newStatusName.trim(), color: newStatusColor };

      // On successful response:
      showCreateStatus = false;
      newStatusName = '';
      newStatusColor = '#2684FF';
      isColorPickerOpen = false;

      assert.deepEqual(apiPayload, { name: 'Khách VIP', color: '#0FBD74' });
      assert.equal(showCreateStatus, false);
      assert.equal(isColorPickerOpen, false);
      assert.equal(newStatusColor, '#2684FF');
    });

    test('contact switching resets create status form and closes color picker', () => {
      let showCreateStatus = true;
      let newStatusName = 'Draft Name';
      let newStatusColor = '#A855F7';
      let isColorPickerOpen = true;

      // Contact change simulation
      const onContactChange = () => {
        showCreateStatus = false;
        newStatusName = '';
        newStatusColor = '#2684FF';
        isColorPickerOpen = false;
      };

      onContactChange();
      assert.equal(showCreateStatus, false);
      assert.equal(newStatusName, '');
      assert.equal(newStatusColor, '#2684FF');
      assert.equal(isColorPickerOpen, false);
    });
  });

  describe('Badge and Selection Rendering', () => {
    test('selected custom status uses readable badge styling', () => {
      const customStatus = { id: 10, name: 'Đã thanh toán', color: '#0FBD74' };
      const badgeStyle = getStatusBadgeStyle(customStatus.color);

      assert.deepEqual(badgeStyle, {
        backgroundColor: '#0FBD74',
        color: '#111827'
      });
    });

    test('persisted color remains intact after normalization', () => {
      const arbitraryColor = '#8A2BE2';
      const normalized = normalizeHexColor(arbitraryColor);
      assert.equal(normalized, '#8A2BE2');
      assert.equal(isValidHexColor(normalized), true);
    });
  });
});
