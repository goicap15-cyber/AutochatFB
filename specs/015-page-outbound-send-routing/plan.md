# Implementation Plan: Page Outbound Send Routing

## Architecture

No new components. This is purely a routing fix inside `sendViaExtension()` in `src/server/server.js`, branching between the existing (working, untouched) personal-send path and the existing (working, but currently unreachable) Page-queue path. All downstream infrastructure — `MessageQueueRepository`, `QueueWorker`, `handleSendQueuedMessage`, `handleSendPageMessage` — already exists and is already correct; this feature only wires the CRM's send button into the second path when appropriate.

## Phases

1. **Source resolution helper**: add a small lookup (in `ConversationRepository` or inline in `server.js`, whichever keeps `sendViaExtension` readable) that, given a `thread_id`, returns `{ sourceType, pageId }` by joining `threads.source_id` → `inbox_sources` (mirroring the exact join `MessageQueueRepository.popPending()` already does, so both places agree on what "this thread is a Page thread" means).

2. **Branch in `sendViaExtension`**: after resolving the thread's `account_id` (already done today), also resolve its source type via Phase 1.
   - If `page_messenger`: call `MessageQueueRepository.insert({ thread_id, account_id: thread.account_id, content: text })`, capture the returned `queueId`, then insert the pending `messages` row with `client_message_id = 'queue_' + queueId` (per spec FR-003) instead of the freshly-generated `clientMsgId`. Do not call `extWs.send(...)` for `SEND_MESSAGE` in this branch — `QueueWorker` will dispatch it.
   - Otherwise: keep the exact current behavior unchanged (`SEND_MESSAGE` WS emit with the existing `clientMsgId` generation).
   - The `io.emit('NEW_MESSAGE', {...})` optimistic-UI event fires in both branches, using whichever `client_message_id` was actually persisted, so the CRM shows the outgoing bubble immediately either way.

3. **Verify correlation end-to-end**: confirm (by tracing, not by changing) that `handleSendQueuedMessage`'s echoed `client_message_id` (`'queue_' + queue_id`) reaches `server.js`'s existing `SEND_MESSAGE_RESULT` handler and matches the pending row from Phase 2 via its `WHERE client_message_id = ? OR fb_message_id = ?` lookup — this is the exact mechanism that already makes personal sends work; Phase 2 just needs to hand it a consistent ID.

4. **Regression tests**: add a test proving the routing decision itself (thread with `page_messenger` source_id → row lands in `message_queue`, not a direct extension dispatch; thread with `personal_messenger` or no source_id → unchanged direct-dispatch behavior). Since `sendViaExtension` talks to a live WebSocket connection, test the decision logic at the smallest unit that doesn't require a live socket (e.g. extract the source-resolution helper from Phase 1 and test it directly against `ConversationRepository`/DB, plus a focused test on the `client_message_id` construction for the queued branch).

5. **Validation**: manual test — reply to the Page test thread from the CRM UI, confirm the text lands in Business Suite's composer and sends; reply to a personal thread, confirm no behavior change; watch the status transition from pending to sent/failed in the UI for both.

## Safety Gates

- Never change `handleSendPageMessage`, `handleSendQueuedMessage`, `QueueWorker`, or `MessageQueueRepository` — they're already correct; this feature is additive routing only.
- Never use the `sourceId:recipientPsid` compound thread-id format anywhere in this feature — always the thread's existing `id` as already stored (per FR-002); mixing conventions is what would silently break the `inbox_sources` join.
- The `client_message_id` used for the Page-branch pending row must be derived the same way `handleSendQueuedMessage` derives it (`'queue_' + queue_id`) — get this from the actual returned `queueId`, never guessed or duplicated ad hoc.
- Personal-messenger sending (US2/FR-004) must have zero behavior change — if a test can't prove that, do not ship this feature.
