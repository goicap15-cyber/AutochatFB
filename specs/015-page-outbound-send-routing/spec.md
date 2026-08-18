# Feature Specification: Page Outbound Send Routing

**Feature Branch**: `015-page-outbound-send-routing`
**Created**: 2026-08-07
**Status**: Draft

**Input**: The CRM's single "Send" button (`App.jsx:386`, `socket.emit('SEND_MESSAGE', ...)`) always routes through `sendViaExtension()` in `server.js`, which always dispatches a generic `SEND_MESSAGE` WebSocket event handled by `handleSendMessage()` in `background.js` — a personal-messenger-only pipeline (GraphQL send, falling back to typing into whatever `getFacebookTab(account_id)` returns). It never checks whether the target thread is Page-sourced. A separate, already-built pipeline exists for Page sends — `MessageQueueRepository` → `QueueWorker` → `SEND_QUEUED_MESSAGE` → `handleSendQueuedMessage()` → `handleSendPageMessage()` (CDP-based typing into the correct Business Suite tab) — built in feature 009, but nothing in the CRM's send path ever routes a message into it. As a result, replying to a Page thread from the CRM UI silently fails: it gets typed into whatever the personal tab happens to be showing, which has no relationship to the Page conversation, and the send hangs in "pending" forever.

## User Stories

### US1 — Replying to a Page thread from the CRM actually sends it (P1)

Given an operator opens a Page-sourced thread in the CRM and sends a reply, the message is delivered through Business Suite (the already-built `handleSendPageMessage` pipeline), not typed into an unrelated personal tab.

**Acceptance**: Sending a message to a thread whose `threads.source_id` resolves to an `inbox_sources` row with `source_type = 'page_messenger'` results in the message being queued via `MessageQueueRepository`, dispatched by `QueueWorker` as `SEND_QUEUED_MESSAGE`, and typed into the correct Business Suite tab for that Page.

### US2 — Personal-messenger sending is unaffected (P1)

Given an operator sends a message to a personal-messenger thread, behavior is identical to today — same pipeline, same timing, same confirmation flow.

**Acceptance**: Sending to a thread with no `source_id`, or one resolving to `source_type = 'personal_messenger'`, follows the exact current `sendViaExtension` → `SEND_MESSAGE` → `handleSendMessage` path, unchanged.

### US3 — The CRM shows correct pending/sent/failed status for Page sends (P2)

Given a message is routed through the queue pipeline, the CRM's existing pending → sent/failed status flow (already built for personal sends around `client_message_id` correlation) works identically for Page sends — no new "stuck in pending forever" state.

**Acceptance**: The pending row created for a queued Page send uses a `client_message_id` that exactly matches what `handleSendQueuedMessage`/`handleSendPageMessage` echo back (`queue_<queue_row_id>`), so the existing `SEND_MESSAGE_RESULT` correlation logic in `server.js` finds and updates it correctly, exactly as it does for personal sends today.

## Functional Requirements

- **FR-001**: `sendViaExtension` (or its caller) MUST determine a thread's source type (`personal_messenger`, `page_messenger`, or unset) by resolving `threads.source_id` against `inbox_sources.source_type` before deciding how to dispatch a send.
- **FR-002**: When the resolved source type is `page_messenger`, the send MUST be inserted into `message_queue` via `MessageQueueRepository.insert()` using the thread's existing `id` value verbatim (the bare recipient PSID already used throughout the `threads`/`messages` tables for Page threads) — never the `sourceId:recipientPsid` compound format `PageMessengerAdapter.sendMessage()` uses, which would not match existing rows and would break the `popPending()` join to `inbox_sources`.
- **FR-003**: The pending row inserted into `messages` for a queued Page send MUST use `client_message_id = 'queue_' + queueId` (the exact ID returned by `MessageQueueRepository.insert()`), matching the ID `handleSendQueuedMessage` independently derives and echoes back — not the client-supplied or freshly-generated `client_message_id` used for personal sends, which would never match and would leave the message stuck in "pending" forever.
- **FR-004**: When the resolved source type is `personal_messenger` or unset (no `source_id`), behavior MUST be byte-for-byte identical to today's `sendViaExtension` path — no regression to the existing, working personal-send pipeline.
- **FR-005**: None of this MUST change `handleSendPageMessage`, `handleSendQueuedMessage`, `QueueWorker`, or `MessageQueueRepository` — they are already correct; only the routing decision that currently never reaches them needs to change.

### Key Entities

- **Send Routing Decision**: at send time, a lookup from `thread_id` → `threads.source_id` → `inbox_sources.source_type`, determining whether a message goes through the direct WS `SEND_MESSAGE` path or the `message_queue` path.

## Success Criteria

- **SC-001**: Sending a reply to the "Mang Bảo Khánh" Page test thread (`100092115712908`, `source_id = src_page_1209772058877160`) from the CRM UI results in the text actually appearing in Business Suite's composer and being sent, not silently failing.
- **SC-002**: Sending a reply to any existing personal-messenger thread continues to work exactly as before, with zero observable behavior change.
- **SC-003**: A queued Page send's status visibly transitions pending → sent (or failed) in the CRM UI, using the existing status-event flow, with no new stuck-forever state.

## Assumptions

- `threads.source_id` is already populated correctly for Page threads captured via `page_dom_observer` (confirmed live: `100092115712908` already has `source_id = 'src_page_1209772058877160'`) — this feature does not need to backfill or fix that linkage, only read it.
- `inbox_sources.status` (`ACTIVE`/`DISCONNECTED`/`TOKEN_EXPIRED`) is not a gating condition for this feature — routing is based on `source_type` alone; whether a `DISCONNECTED` Page source should block sending is out of scope here.
