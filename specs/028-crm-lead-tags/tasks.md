# Tasks: CRM Lead Tags

## Phase 1 — Utilities and tests first

- [x] T001 Add `src/client/utils/tags.js` with defensive parsing, trim/case-fold duplicate keys, stable ordering, toggle/add/remove, and 40-character/20-tag validation.
- [x] T002 Add unit tests for malformed tags, unknown legacy tags, normalization, duplicate casing, ordering, toggle/add/remove, and limits.

## Phase 2 — Lead Details UI

- [x] T003 Add committed/draft tag state to `LeadDetailsPanel.jsx`; reset it on contact changes and unmount.
- [x] T004 Replace hardcoded tag spans with semantic toggle buttons using `aria-pressed`, visible focus, and non-color selected cues.
- [x] T005 Build one shared inline Tags editor opened by “+ Thêm” and “Quản lý nhãn”, with selected-tag remove controls and custom-tag input.
- [x] T006 Implement Enter-to-add, Escape/Cancel discard, Apply, duplicate/invalid/max-limit messages, and focus restoration.
- [x] T007 Preserve and display existing tags not included in the starter list.

## Phase 3 — Persistence and rollback

- [x] T008 Wire tag changes through the existing `onSaveContact`/`PUT /api/contacts/:thread_id` flow without adding a route or migration.
- [x] T009 Implement optimistic commit with rollback, post-success cache commit, stale-GET invalidation, and accessible retry error when persistence fails.
- [x] T010 Add integration coverage using the same ContactService as the Express route: tag save, clear, reload round-trip, malformed payload normalization, and preservation of unrelated contact fields.

## Phase 4 — Validation

- [x] T011 Run targeted tag tests and full `npm run test:persistence`.
- [x] T012 Run `npm run build:ui` and syntax checks for touched files.
- [ ] T013 Manually verify keyboard-only, light/dark themes, narrow drawer, 200% zoom, contact switching, save failure, and Lead Status/rich-message regression.
