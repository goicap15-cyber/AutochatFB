export const SIDEBAR_CLOSE_DELAY_MS = 180;

export function createSidebarPresentationState() {
  return { isExpanded: false, pointerInside: false, focusInside: false };
}

export function shouldKeepSidebarExpanded(state) {
  return Boolean(state?.pointerInside || state?.focusInside);
}

export function nextSidebarPresentationState(state, event) {
  const current = { ...createSidebarPresentationState(), ...(state || {}) };
  let next = { ...current };

  if (event === 'pointer_enter') {
    next = { ...next, isExpanded: true, pointerInside: true };
  } else if (event === 'pointer_leave') {
    next = { ...next, pointerInside: false };
  } else if (event === 'focus_enter') {
    next = { ...next, isExpanded: true, focusInside: true };
  } else if (event === 'focus_leave') {
    next = { ...next, focusInside: false };
  } else if (event === 'close_timeout' && !shouldKeepSidebarExpanded(next)) {
    next = { ...next, isExpanded: false };
  }

  return { ...next, shouldScheduleClose: next.isExpanded && !shouldKeepSidebarExpanded(next) };
}
