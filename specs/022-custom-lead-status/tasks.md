# Tasks: Custom Lead Status

## Phase 1 — Schema

- [x] T001 Added migration v12 (`db.js`'s `migrations` array) creating `lead_statuses` and adding `contacts.status_id`, seeded with 3 starter statuses.
- [x] T002 Mirrored `lead_statuses` table + `contacts.status_id` column into `schema.sql` for fresh installs.

## Phase 2 — Backend: status CRUD

- [x] T003 Added `GET /api/lead-statuses` (list all, ordered by id).
- [x] T004 Added `POST /api/lead-statuses` (create `{name, color}`; reuses existing row on duplicate name).

## Phase 3 — Backend: persist + join

- [x] T005 Extended `PUT /api/contacts/:thread_id` to accept and persist `status_id`.
- [x] T006 Extended `AssignmentManager.getThreadsByFilter()`'s query with `LEFT JOIN lead_statuses ls ON ls.id = c.status_id`, selecting `ls.name AS status_name, ls.color AS status_color`.

## Phase 4 — Frontend: status picker

- [x] T007 In `LeadDetailsPanel.jsx`, replaced the `normalizeLeadStatus`/`statusLabel`-driven "Trạng thái" control with a dropdown sourced from `leadStatuses` (fetched once in `App.jsx` via `GET /api/lead-statuses`, passed down as a prop), showing each status's color on the badge.
- [x] T008 Added a compact "+ Tạo trạng thái mới" inline form (name input + preset color swatches from `AVATAR_COLORS`) that calls `onCreateLeadStatus` (→ `POST /api/lead-statuses` in `App.jsx`) and immediately selects the result.
- [x] T009 Wired the selected status into the `onSaveContact` payload as `status_id`; removed the old `status`/`lead_status` fields and the `normalizeLeadStatus`/`statusLabel` helper functions entirely.

## Phase 5 — Frontend: sidebar badge + filter

- [x] T010 In `ConversationItem.jsx`, render a small colored pill per thread using `thread.status_color`/`thread.status_name` (present via T006's join), alongside the existing (unrelated) workflow-status badge.
- [x] T011 Added a status filter `<select>` in `ConversationSidebar.jsx` next to the existing "Tất cả nguồn" source filter, populated from the `leadStatuses` prop, filtering `filteredThreads` client-side by `status_id` — same pattern as the existing source filter. Shown only when at least one status exists.

## Phase 6 — Validation

- [x] T012 Ran `npm run test:persistence` (22/22 pass, no regression) and `npm run build:ui` (compiles clean), then `graphify update .`.
- [ ] T013 Manual test: create a status on one thread; confirm it's immediately selectable (not retyped) on a different thread. **(requires live browser test — not run by this pass)**
- [ ] T014 Manual test: filter the sidebar by a status; confirm only matching threads show. **(requires live browser test — not run by this pass)**
- [ ] T015 Manual test: confirm the Chưa xử lý/Đã chốt tabs and "Đánh dấu hoàn thành" still work unchanged (FR-009 regression check). **(requires live browser test — not run by this pass)**

## Dependencies

- Phase 1 blocks everything else.
- Phase 2 blocks Phase 4 (picker needs the list/create endpoints).
- Phase 3's T006 blocks Phase 5 (sidebar needs the joined fields).
- Phase 6 runs last.


## Phase 7 — Visual color picker replacement (2026-08-13)

- [x] T016 Add `react-colorful` and lock the dependency version.
- [x] T017 Add `src/client/utils/color.js` plus unit tests for normalize/validate/contrast behavior.
- [x] T018 Build accessible `LeadStatusColorPicker.jsx` with saturation/value area, hue control, swatch, editable hex, Apply/Cancel, Escape/outside-click, and focus restoration.
- [x] T019 Replace the fixed `AVATAR_COLORS` dots in `LeadDetailsPanel.jsx`; mount the picker only below `showCreateStatus`, split draft/committed state, and reset it on every create-form lifecycle exit.
- [x] T020 Validate and normalize opaque six-digit hex in `POST /api/lead-statuses`; add API tests for valid, lowercase, malformed, and alpha inputs.
- [x] T021 Make arbitrary chosen colors readable in the existing dropdown/sidebar UI without changing their behavior.
- [x] T022 Add frontend regression coverage for apply/discard, outer create/cancel, contact switching, unmount cleanup, persisted color reuse, and “picker absent outside create mode”.
- [x] T023 Run targeted tests, `npm run test:persistence`, UI build, and server syntax checks.
- [ ] T024 Live browser check in light/dark themes, narrow detail panel, keyboard-only operation, outside click, Escape, focus return, and 200% zoom.

### Phase 7 dependencies

T016–T017 block T018–T021. T018 and T019 must land together. T020 is independent after T017. T022 follows T018–T021; T023 and T024 are final gates. Existing unchecked live tasks T013–T015 remain required and must be updated according to actual progress.
