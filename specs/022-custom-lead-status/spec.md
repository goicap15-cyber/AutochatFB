# Feature Specification: Custom Lead Status

**Feature Branch**: `022-custom-lead-status`
**Created**: 2026-08-08
**Status**: Draft

**Change request (2026-08-13)**: Replace the fixed preset color dots in the inline “Tạo trạng thái mới” form with a visual color picker. The picker exists only while that create form is open; normal status viewing/selecting remains compact and unchanged.

**Input**: The user wants to replace the CRM's "Trạng thái" (status) field on a conversation with staff-created, reusable, color-coded statuses (e.g. "Đã lấy số", "Chưa có số") instead of the current fixed 3-value list — created once, then reusable across any thread, filterable in the sidebar.

**Correction during investigation**: initial diagnosis assumed the existing "Trạng thái: Mới/Đang xử lý/Đã chốt" dropdown in `LeadDetailsPanel.jsx` was a working (if limited) field. Tracing it fully shows it is **not persisted at all**: `activeContact.status` in `App.jsx` (line ~462) is populated from `selectedThread.status` — which is actually `threads.status` (`UNPROCESSED`/`ASSIGNED`/`COMPLETED`, the workflow field driving the sidebar's Tất cả/Của tôi/Chưa xử lý/Đã chốt tabs and the "Đánh dấu hoàn thành" action), relabeled for display via `normalizeLeadStatus()`/`statusLabel()`. Editing the dropdown updates only local React state; `handleSaveContact` PUTs the whole object to `PUT /api/contacts/:thread_id`, but that endpoint destructures only `{name, phone, email, notes, tags, lead_captured, avatar_url}` — `status`/`lead_status` are silently dropped. On reload, the field always reverts to whatever `threads.status` says. This means: (a) there is no existing custom-status data to migrate, and (b) `threads.status` must NOT be reused or overloaded for this feature — it has real workflow behavior (tab filtering, thread completion) unrelated to the lead-status concept being built here.

## User Stories

### US1 — Staff can create a new status once and reuse it on any thread (P1)

Given no status yet exists matching what staff need, they can create one (name + color) directly from a conversation's detail panel; it becomes available to select on that thread and on every other thread going forward, without recreating it.

**Acceptance**: Creating "Đã lấy số" with a color on one thread makes it immediately selectable (from a list, not retyped) on a different thread.

### US2 — Each status has its own distinct color (P1)

**Acceptance**: Every status shows a color swatch/badge consistently everywhere it's displayed (detail panel, sidebar).

### US3 — Conversations can be filtered by status (P1)

**Acceptance**: Selecting a status in the sidebar's filter UI shows only threads currently set to that status; clearing the filter shows all threads again (per existing source-filter UX pattern already in `ConversationSidebar.jsx`).

### US4 — Existing workflow status (Chưa xử lý/Đã chốt tabs) is unaffected (P1)

**Acceptance**: `threads.status` (`UNPROCESSED`/`ASSIGNED`/`COMPLETED`) and its tabs/completion behavior work exactly as before — this feature adds a new, independent concept, it does not touch that column or its consumers.

## Functional Requirements

- **FR-001**: A new `lead_statuses` table stores staff-created statuses: `id`, `name` (unique), `color` (hex), `created_at`. Seeded with a small starter set (e.g. "Mới", "Đang xử lý", "Đã chốt" with distinct colors) so the panel isn't empty on first use — these are just ordinary rows, not special-cased in code.
- **FR-002**: `contacts` gains a `status_id` column (nullable, `REFERENCES lead_statuses(id)`) — per-thread, consistent with `contacts.thread_id` already being the primary key (so a Page thread and a personal-messenger thread for the same person already have independent rows, and therefore independent statuses, with no extra work).
- **FR-003**: `GET /api/lead-statuses` lists all statuses (id, name, color) for populating the picker.
- **FR-004**: `POST /api/lead-statuses` creates a new status `{name, color}`; rejects (or reuses) a duplicate name rather than creating a second row with the same label.
- **FR-005**: `PUT /api/contacts/:thread_id` is extended to accept and persist `status_id` (currently silently dropped for any status-like field — this is the actual persistence gap being fixed).
- **FR-006**: `LeadDetailsPanel.jsx`'s "Trạng thái" control contains a dropdown populated from `GET /api/lead-statuses` (showing each status's color), plus an inline "create new" affordance. While—and only while—the inline create form is open, staff can open a visual color picker, choose an opaque color, and POST the normalized `#RRGGBB` value through FR-004. Creating a status immediately selects it.
- **FR-007**: `AssignmentManager.getThreadsByFilter()`'s query gains a `LEFT JOIN lead_statuses ls ON ls.id = c.status_id`, selecting `ls.name AS status_name, ls.color AS status_color` (alongside the existing `LEFT JOIN contacts c`) — so every thread already carries its status name/color without a second round-trip.
- **FR-008**: `ConversationSidebar.jsx` shows a small color-coded status indicator per thread (using the joined fields from FR-007) and a status filter control, following the exact same client-side `.filter()` pattern already used for the existing "Tất cả nguồn" source filter — no new server-side filter endpoint needed.
- **FR-009**: No change to `threads.status`, its CHECK constraint, `AssignmentManager`'s tab logic, or the "Đánh dấu hoàn thành" action.
- **FR-010**: The separate, still-hardcoded "TAGS" chip section (Tiềm năng/Quan tâm/Cần tư vấn, `LeadDetailsPanel.jsx` lines ~248-258) is explicitly out of scope — untouched by this feature.
- **FR-011**: The color picker provides a two-dimensional saturation/value field, a hue control, a visible swatch and editable hex value. Alpha/transparency is not supported.
- **FR-012**: Opening the picker copies the committed create-form color into a draft. “Áp dụng” commits the draft to the create form; picker “Hủy”, outside-click, or `Escape` discards the draft. The outer “Tạo” button remains the only action that persists a status.
- **FR-013**: Closing/cancelling the create form, switching contacts, successful creation, or unmounting resets both committed and draft picker state so stale colors never leak into the next creation.
- **FR-014**: `POST /api/lead-statuses` accepts only normalized, opaque six-digit hex colors (`#RRGGBB`) and returns `400` for invalid color input.
- **FR-015**: The picker is keyboard operable, restores focus to its trigger after closing, exposes an accessible color value/name, has visible focus states, and remains usable in light/dark themes, the narrow customer-detail panel, and at 200% browser zoom.

### Key Entities

- **Lead Status**: `{id, name, color}` — a reusable, staff-defined label, independent of any specific thread.
- **Contact.status_id**: a nullable FK linking one thread's contact row to a Lead Status; `NULL` means "no status set" (distinct from any specific status value, including the seeded "Mới").

## Success Criteria

- **SC-001**: Creating a status once and applying it to two different threads (e.g. the same person's Page and personal-messenger threads) shows the same name/color independently on each, without retyping.
- **SC-002**: Filtering the sidebar by a status shows exactly the threads set to it.
- **SC-003**: `threads.status`-driven tabs (Chưa xử lý/Đã chốt) and thread completion continue to work unchanged.
- **SC-004**: `npm run test:persistence` passes; existing schema/data unaffected by the migration (additive only: one new table, one new nullable column).
- **SC-005**: Staff can create a status using any opaque visual-picker color, and that exact normalized color is reused in the status dropdown and sidebar badge after reload.
- **SC-006**: When the create form is closed, no picker UI, picker focus target, or picker interaction layer remains mounted.

## Assumptions

- Editing or deleting an existing status's name/color, or reassigning/merging statuses, is not requested and is out of scope — can be a follow-up if staff need to fix a typo'd status later.
- The visual picker replaces the fixed `AVATAR_COLORS` dots for status creation. It stores opaque six-digit hex only; alpha and alternate persisted formats are intentionally out of scope.
- Multiple statuses per thread are not requested ("trạng thái", singular, replacing a single-select dropdown) — this is a single `status_id` per contact row, not a many-to-many tag relationship.
