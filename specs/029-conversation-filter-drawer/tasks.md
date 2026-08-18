# Tasks: CRM Conversation Filter Drawer

## Phase 1 — Pure filter model and tests first

- [x] T001 Add `src/client/utils/conversationFilters.js` with `createDefaultFilters()`, `normalizeSourceKey()`, `sanitizeFilters()`, `areFiltersEqual()`, `countActiveFilters()`, and `matchesConversationFilters(thread, filters)`.
- [x] T002 Add unit tests in `tests/unit/conversationFilters.test.js` covering source types, specific source ids, lead status ids, OR within groups, AND across groups, empty filters, and stale options sanitization.

## Phase 2 — Accessible Filter Popover

- [x] T003 Build `src/client/components/ConversationFilterPopover.jsx` with draft state cloned from applied filters, multi-select source and status toggle options, and footer actions (Xóa tất cả, Hủy, Áp dụng).
- [x] T004 Implement outside click dismissal, Escape key handler, and focus restoration in `ConversationFilterPopover.jsx`.
- [x] T005 Add unit tests in `tests/unit/conversationFilterPopoverLogic.test.js` covering draft isolation, cancel/escape discard, clear all, and sanitize on apply.

## Phase 3 — Sidebar Integration

- [x] T006 Update `src/client/components/ConversationSidebar.jsx` to replace the two static dropdown selects with the Filter popover anchored to the `<Filter />` button.
- [x] T007 Connect `appliedFilters` state and update `filteredThreads` filtering logic using `matchesConversationFilters`.
- [x] T008 Add dynamic count badge and aria-label to the Filter button indicating the number of active filters.

## Phase 4 — Validation

- [x] T009 Run targeted unit tests and full `npm run test:persistence`.
- [x] T010 Run `npm run build:ui` and verify clean build.
- [x] T011 Update knowledge graph (`graphify update .`).
- [x] T012 Fix review findings: retain the campaign-selection close icon import and expose/sanitize source-type filters only when the type has an available inbox source.
