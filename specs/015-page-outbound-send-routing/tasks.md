# Tasks: Page Outbound Send Routing

## Phase 1 — Source resolution helper

- [x] T001 Added `ConversationRepository.getThreadSource(threadId)` returning `{ sourceType, pageId }`, joining `threads.source_id` → `inbox_sources`, mirroring the exact join `MessageQueueRepository.popPending()` uses.
- [x] T002 Added a regression test: `page_messenger`, `personal_messenger`, no-source, and non-existent-thread cases all resolve correctly.

## Phase 1.5 — Unplanned but required: QueueWorker was never started

- [x] **Discovered during implementation**: `src/server/services/QueueWorker.js` was never `require`d or `.start()`ed anywhere in `server.js` (confirmed by grep — zero references outside its own file). Routing sends into `message_queue` would have gone nowhere without this. Fixed as part of this feature: `server.js` now requires `MessageQueueRepository`/`queueWorker`, and `startServer()` calls `queueWorker.configure({ getConnection, onQueueFail })` + `queueWorker.start()`. `onQueueFail` updates the pending `messages` row (matched by `client_message_id = 'queue_' + message.id`) to `failed` and emits `MESSAGE_SEND_FAILED`.

## Phase 2 — Routing branch in sendViaExtension

- [x] T003 `sendViaExtension()` now resolves source type via the Phase 1 helper right after resolving `thread.account_id`.
- [x] T004 When source type is `page_messenger`: calls `MessageQueueRepository.insert(...)`, captures `queueId`, uses `client_message_id = 'queue_' + queueId` for the pending row (per FR-003) — no direct `SEND_MESSAGE` WS event in this branch.
- [x] T005 When source type is `personal_messenger` or unset: unchanged direct `SEND_MESSAGE` WS dispatch path (FR-004).
- [x] T006 The optimistic `io.emit('NEW_MESSAGE', {...})` fires in both branches using the actually-persisted `client_message_id`.

## Phase 3 — Correlation trace (verification, not new code)

- [x] T007 Traced: `handleSendPageMessage`/`handleSendQueuedMessage` call `sendToBackend('SEND_MESSAGE_RESULT', { client_message_id, ... })` with `client_message_id = 'queue_' + queue_id` (background.js's own derivation, matching what T004 now writes) — lands on the existing, unmodified `case 'SEND_MESSAGE_RESULT'` handler in `server.js`, which looks up `WHERE client_message_id = ? OR fb_message_id = ?`. IDs match; no code change needed here.

## Phase 4 — Regression tests

- [x] T008/T009 — **Scoped down**: `MessageQueueRepository` imports the default DB singleton directly (`require('../database/db')`, no injectable `database` param, unlike `ConversationRepository`), and `sendViaExtension` itself depends on a live `extensionConnections` WebSocket entry and the same global `db` — neither is practically unit-testable without a broader dependency-injection refactor of `MessageQueueRepository`/`server.js`, which is out of scope for this fix. Coverage instead comes from T002 (the routing *decision* logic, fully tested) + T007 (traced, not guessed) + manual validation below for the end-to-end behavior.

## Phase 5 — Validation

- [x] T013 Ran `npm run test:persistence` (full suite, 18/18 pass) and `graphify update .`.
- [ ] T010 Manual test: reply to the "Mang Bảo Khánh" Page test thread from the CRM UI; confirm the text is typed into and sent via the correct Business Suite tab. **(requires live browser test — not run by this pass)**
- [ ] T011 Manual test: reply to an existing personal-messenger thread from the CRM UI; confirm zero behavior change from before this feature. **(requires live browser test — not run by this pass)**
- [ ] T012 Manual test: observe the CRM UI status transition (pending → sent/failed) for a Page send, confirming it doesn't get stuck. **(requires live browser test — not run by this pass)**

## Dependencies

- Phase 1 blocks Phase 2.
- Phase 3 depends on Phase 2 existing (nothing to trace before the routing exists).
- Phase 4's tests should be written against the Phase 2 implementation (assert the fixed behavior, not before it exists).
- Phase 5 runs last.
