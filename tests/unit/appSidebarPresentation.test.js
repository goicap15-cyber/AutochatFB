import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIDEBAR_CLOSE_DELAY_MS,
  createSidebarPresentationState,
  shouldKeepSidebarExpanded,
  nextSidebarPresentationState
} from '../../src/client/utils/appSidebarPresentation.js';

describe('app sidebar hover presentation (Spec 034)', () => {
  test('starts compact and declares the intended close delay', () => {
    assert.deepEqual(createSidebarPresentationState(), { isExpanded: false, pointerInside: false, focusInside: false });
    assert.equal(SIDEBAR_CLOSE_DELAY_MS, 180);
  });

  test('opens immediately for pointer entry and cancels a pending close on re-entry', () => {
    const entered = nextSidebarPresentationState(createSidebarPresentationState(), 'pointer_enter');
    assert.deepEqual(entered, { isExpanded: true, pointerInside: true, focusInside: false, shouldScheduleClose: false });
    const left = nextSidebarPresentationState(entered, 'pointer_leave');
    assert.equal(left.shouldScheduleClose, true);
    const reentered = nextSidebarPresentationState(left, 'pointer_enter');
    assert.equal(reentered.isExpanded, true);
    assert.equal(reentered.shouldScheduleClose, false);
  });

  test('keeps the overlay visible while keyboard focus is inside', () => {
    const focused = nextSidebarPresentationState(createSidebarPresentationState(), 'focus_enter');
    assert.equal(shouldKeepSidebarExpanded(focused), true);
    const pointerLeft = nextSidebarPresentationState({ ...focused, pointerInside: true }, 'pointer_leave');
    assert.equal(pointerLeft.shouldScheduleClose, false);
    const blurred = nextSidebarPresentationState(pointerLeft, 'focus_leave');
    assert.equal(blurred.shouldScheduleClose, true);
  });

  test('collapses only after both pointer and focus leave', () => {
    const opened = { isExpanded: true, pointerInside: false, focusInside: false };
    assert.equal(shouldKeepSidebarExpanded(opened), false);
    assert.deepEqual(nextSidebarPresentationState(opened, 'close_timeout'), { isExpanded: false, pointerInside: false, focusInside: false, shouldScheduleClose: false });
  });
});
