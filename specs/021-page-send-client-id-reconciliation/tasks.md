# Tasks: Page Send Client-ID Reconciliation

## Phase 1 — Server: carry the original id

- [x] T001 Added `original_client_message_id: client_message_id || clientMsgId` to the `io.emit('NEW_MESSAGE', {...})` call in `sendViaExtension()`.

## Phase 2 — Client: match-by-either-id and reconcile

- [x] T002 Extended the `findIndex` predicate in `App.jsx`'s `NEW_MESSAGE` handler to also match `newMsg.original_client_message_id` against an existing bubble's `client_message_id`.
- [x] T003 On match, the merged bubble object now sets `client_message_id: newMsg.client_message_id` explicitly, reconciling it to the server's id.

## Phase 3 — Validation

- [ ] T004 Manual test: send a fresh message to the "Mang Bảo Khánh" Page thread from the CRM; confirm exactly one bubble appears and transitions from "Đang gửi" (spinner) to sent (checkmark) — no phantom second bubble. **(requires live browser test — not run by this pass; requires `npm run build:ui` to have been run first since the CRM is served from the pre-built `dist/client` bundle, not live-served source — done as part of this pass)**
- [ ] T005 Manual test: send a message to a personal-messenger thread; confirm no behavior change (single bubble, as before). **(requires live browser test — not run by this pass)**
- [x] T006 Ran `npm run build:ui` (production build succeeds, confirms JSX is valid — 22/22 `npm run test:persistence` unaffected since no backend DB logic changed) and `graphify update .`.

## Dependencies

- Phase 1 and Phase 2 are independent edits but both required together for the fix to work (Phase 2 has nothing to match without Phase 1's field).
- Phase 3 runs last.
