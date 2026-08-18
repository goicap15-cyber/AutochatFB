# Feature Specification: CRM Lead Tags

Feature Branch: 028-crm-lead-tags
Created: 2026-08-13
Status: Draft

Input: Enable the currently static “Nhãn” chips in LeadDetailsPanel.jsx so staff can select/unselect multiple tags and add a custom tag for the active conversation.

## Scope boundary

This feature is separate from Spec 022 Lead Status. A lead status remains one status_id; tags are an independent multi-value list. The existing contacts.tags TEXT DEFAULT '[]' column and PUT /api/contacts/:thread_id persistence path are reused. No new table, migration, global tag catalog, or changes to threads.status are introduced in this increment.

## User stories

### US1 — Toggle tags on a conversation (P1)

Staff can click a tag chip to add it to or remove it from the active conversation. Selected and unselected states are visually distinct and do not affect Lead Status.

### US2 — Add a custom tag (P1)

Staff can open “+ Thêm”, enter a tag name, and add it to the active conversation. Duplicate names are prevented case-insensitively.

### US3 — Persist tags (P1)

After selection or addition, tags are saved through the existing contact update flow and remain after reload or switching conversations.

### US4 — Manage current conversation tags (P2)

“Quản lý nhãn” opens the same tag editor so staff can inspect selected tags, remove them, and add a custom tag. A global reusable tag library is explicitly deferred.

## Functional requirements

- FR-001: Parse contactInfo.tags defensively as an array of non-empty strings; malformed JSON or non-array values resolve to an empty list in the UI without crashing.
- FR-002: Render starter tags “Tiềm năng”, “Quan tâm”, and “Cần tư vấn” as semantic button controls, not span. Clicking a tag toggles membership in the active contact’s selected tag list.
- FR-003: Selected tags expose aria-pressed=true, a visible selected style, and a non-color cue (check/icon or text). Unselected tags expose aria-pressed=false.
- FR-004: “+ Thêm” and “Quản lý nhãn” open an inline editor/popover anchored in the Tags section. The editor lists currently selected tags with remove controls and includes a labelled input for a custom tag.
- FR-005: Pressing Enter on a valid custom-tag input adds it; Escape closes the editor without adding; Cancel restores the last committed selection.
- FR-006: Normalize custom tags by trimming surrounding whitespace and comparing case-insensitively. Preserve the first entered display casing. Empty, control-character, or duplicate values are rejected with an inline accessible error.
- FR-007: Enforce a 40-character maximum per tag and a 20-tag maximum per contact in the client. The UI explains why an add action is disabled or rejected.
- FR-008: Toggle/add/remove updates the UI optimistically and calls the existing onSaveContact({ ...contactInfo, tags }) flow. On save failure, roll back to the prior committed list and show an accessible error.
- FR-009: Switching contacts, closing/unmounting the panel, or changing active contact resets draft editor state and prevents tags from leaking across conversations.
- FR-010: Existing saved tags not in the starter list remain visible and removable; they must not be silently discarded.
- FR-011: Lead Status controls, workflow tabs, tags’ unrelated lead_captured behavior, and rich-message composer behavior remain unchanged.
- FR-012: All tag actions are keyboard reachable with visible focus, work in light/dark themes and the narrow lead drawer, and remain usable at 200% zoom. Status is communicated by text/icon as well as color.

## Key entities

- Contact tags: ordered string array persisted as JSON in contacts.tags; ownership is one active conversation/contact row.
- Tag editor draft: ephemeral UI state containing draft selected tags, input value, validation error, and open/closed state.

## Success criteria

- SC-001: Clicking a starter chip adds/removes exactly one tag and updates selected styling immediately.
- SC-002: A valid custom tag is added once, duplicate casing does not create a second entry, and the tag is removable.
- SC-003: Tags persist after save, contact switching, browser reload, and are not confused with Lead Status.
- SC-004: Save failures roll back the optimistic change and announce an actionable error.
- SC-005: Existing arbitrary tags survive the new UI unchanged.
- SC-006: Keyboard, dark/light theme, narrow drawer, and 200% zoom checks pass.

## Assumptions and non-goals

- Starter tags are code-defined display options for this increment; there is no global CRUD catalog.
- Tag ordering is stable: keep existing order, append newly added values, and remove without reordering remaining values.
- Renaming tags globally, color customization, server-side tag filtering, bulk tagging, and analytics are follow-up features.
