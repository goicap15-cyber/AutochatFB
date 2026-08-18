# Implementation Plan: CRM Lead Tags

Branch: 028-crm-lead-tags | Date: 2026-08-13 | Spec: specs/028-crm-lead-tags/spec.md

## Summary

Turn the static Tags section in LeadDetailsPanel.jsx into a multi-select editor for the active conversation. Reuse the existing contacts.tags JSON column and PUT /api/contacts/:thread_id path, with optimistic UI updates, rollback on failure, starter tags, and an inline custom-tag editor. No database or server route changes are required.

## Technical context

Language/Version: React 19, JavaScript/JSX, Node.js
Primary dependencies: React hooks, existing Tailwind-style tokens, lucide-react icons
Storage: SQLite contacts.tags TEXT DEFAULT '[]'; JSON array of strings
Testing: Node test runner, existing persistence suite, Vite production build, manual browser checks
Target platform: Desktop CRM plus narrow lead drawer
Project type: React frontend with Node/Express backend
Performance goals: Toggle feedback in the same render; one contact PUT per committed change; no extra network request to render tags
Constraints: Preserve existing rich-message and Lead Status flows; no migration; tolerate malformed legacy tags
Scale/scope: One active conversation panel, up to 20 tags per contact in this increment

## Constitution check

The repository constitution is still a placeholder, so no project-specific gate can be enforced. The plan follows existing additive/persistence conventions: reuse the current endpoint, keep state local to the contact panel, and add focused regression tests.

## Architecture and state flow

1. Normalize contactInfo.tags on contact load with a pure helper. Keep unknown legacy tags.
2. Maintain committedTags and draftTags separately. The compact chip row reflects committed tags; the editor works on draft tags.
3. Clicking a chip uses a direct toggle action. “+ Thêm” / “Quản lý nhãn” opens the editor seeded from committed tags.
4. Apply commits the draft and invokes onSaveContact. Cancel closes without a request. If the save rejects, restore the previous committed list and show an error.
5. After a successful save, update the active contact/thread cache through the existing callback so switching away and back retains the result.
6. Reset editor/input/error state on contactInfo.thread_id change, outer close, and unmount.

## Implementation phases

### Phase 1 — Pure tag utilities and state model

- Add src/client/utils/tags.js with parse, normalize, equality, toggle, add, remove, and validation helpers.
- Define starter tags in one feature-owned constant; do not duplicate literal strings across JSX.
- Decide whether a change is a no-op before calling persistence.

### Phase 2 — LeadDetailsPanel integration

- Add committed/draft tag state initialized from contactInfo.tags.
- Replace hardcoded span chips with semantic buttons carrying aria-pressed, focus styles, and a selected icon/text cue.
- Implement inline editor for add/remove, Enter/Escape, validation messages, max limits, Cancel, and Apply.
- Ensure Quản lý nhãn and + Thêm share the same editor state; no duplicate popover implementation.
- Keep tag saves separate from Lead Status saves, always sending the full normalized tag array.

### Phase 3 — Persistence and failure handling

- Reuse App.jsx handleSaveContact; verify it sends tags as an array and updates local contact cache.
- Add an error boundary in editor state: failed PUT restores prior tags and leaves the editor open for retry.
- Do not add a server route or database migration. Add a server-side defensive normalization only if current endpoint behavior can serialize malformed input incorrectly; otherwise document current boundary.

### Phase 4 — Tests and validation

- Unit-test malformed/null tags, trimming, case-insensitive duplicates, ordering, toggle/add/remove, and limits.
- Integration-test existing contact PUT persistence with tags and verify reload round-trip.
- Add frontend logic tests for optimistic apply/rollback, Cancel, contact switch reset, Enter/Escape, and preserving unknown legacy tags.
- Run targeted tests, npm run test:persistence, npm run build:ui, and node --check for touched server files.
- Manually test light/dark themes, narrow drawer, keyboard-only, duplicate names, long/invalid input, save failure, reload, and independence from Lead Status.

## File impact

Source:
- src/client/components/LeadDetailsPanel.jsx
- src/client/utils/tags.js (new)
- src/client/App.jsx (only if cache/persistence callback needs adjustment)

Tests:
- tests/unit/tags.test.js
- tests/unit/leadTagsLogic.test.js
- tests/integration/contactTagsPersistence.test.js

## API/data contract

Use existing endpoint: PUT /api/contacts/:thread_id
Payload includes: { ..., tags: ["Tiềm năng", "Khách VIP"] }

No new endpoint or schema migration in this increment.

## Safety gates

- Never reuse status_id for tags.
- Never overwrite unknown legacy tags when rendering starter chips.
- Never persist draft editor values on Cancel/Escape.
- Never call PUT for a no-op toggle.
- Roll back optimistic state on failed persistence.
- Keep threads.status and Spec 027 rich-message code untouched.
