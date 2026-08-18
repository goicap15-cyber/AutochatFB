# Feature Specification: Page Send Client-ID Reconciliation

**Feature Branch**: `021-page-send-client-id-reconciliation`
**Created**: 2026-08-08
**Status**: Draft

**Input**: Every single send from the CRM to a Page thread produces a permanent phantom "Đang gửi" (sending) bubble alongside the real, correctly-delivered one — confirmed via direct DB queries across multiple test sends ("lo a", "what", "123456", "31321") that each produced exactly ONE row in `messages` and ONE row in `message_queue`, proving the duplicate is 100% a frontend rendering artifact, not a backend/DB bug.

Root cause, traced end-to-end through the code:
1. `MessageComposer.jsx` generates `client_message_id = client_<timestamp>_<random>` and calls `onSendMessage(text, client_message_id)`.
2. `App.jsx`'s `handleSendMessage` immediately appends a local optimistic bubble to React state using that exact id, then emits `SEND_MESSAGE` to the server with the same id.
3. `server.js`'s `sendViaExtension(thread_id, text, client_message_id)`, for a Page thread specifically, **discards the caller-supplied id** and derives a new one: `clientMsgId = 'queue_' + queueId` (a documented, intentional choice — `background.js`'s `handleSendQueuedMessage` independently re-derives this exact same `'queue_' + queue_id` string when echoing results back, and the entire pending→DOM-confirmation correlation chain, including this session's features 015/017/020, depends on that derived id being what's stored in the `messages` row and echoed by the extension).
4. The server's first (`status: 'pending'`) `NEW_MESSAGE` broadcast therefore carries `client_message_id: 'queue_' + queueId` — a different string than what the frontend's local bubble is holding.
5. `App.jsx`'s `NEW_MESSAGE` handler matches incoming messages to existing bubbles by exact `client_message_id` equality. No match is found, so the broadcast is appended as a **second, brand-new bubble** instead of updating the first. The original local bubble (frontend's own id) never receives any further event referencing its id — it is not part of any correlation the server or extension knows about — so it stays `status: 'sending'` forever.

Personal-messenger (non-Page) sends are unaffected: `sendViaExtension`'s non-Page branch uses `clientMsgId = client_message_id || ...`, i.e. the caller-supplied id survives, so the frontend's local bubble and the server's broadcast always agree.

## User Stories

### US1 — Sending to a Page thread produces exactly one visible bubble (P1)

Given the CRM's local optimistic bubble was created with the frontend's own `client_message_id`, and the server necessarily uses a different, `queue_`-derived id internally for Page sends, the frontend must still end up with exactly one bubble for that send, correctly transitioning from "sending" to "sent" (or "failed").

**Acceptance**: Sending a message to a Page thread results in exactly one bubble in the CRM's message list at all times — never a duplicate, and never a bubble stuck permanently in "sending".

### US2 — No change to the extension-side correlation contract (P1)

Given features 015/017/020 and the `SEND_MESSAGE_RESULT`/`QUEUED_MESSAGE_RESULT` handlers all depend on the `messages` row's `client_message_id` being exactly `'queue_' + queue_id` (because `background.js` independently re-derives and echoes that same string), the stored DB value and every existing correlation lookup keyed on it must remain byte-for-byte unchanged.

**Acceptance**: `npm run test:persistence` continues to pass unmodified; no schema change; no change to `MessageQueueRepository`, `QueueWorker`, or `background.js`.

### US3 — Personal-messenger sends are unaffected (P2)

**Acceptance**: The non-Page branch of `sendViaExtension` and its socket payload shape are unchanged in behavior (an added field is harmless/ignored, not a functional change).

## Functional Requirements

- **FR-001**: `sendViaExtension`'s first (`status: 'pending'`) `NEW_MESSAGE` emit MUST include the frontend's original, caller-supplied `client_message_id` (before it gets overridden to `'queue_' + queueId` for Page threads) as an additional field, e.g. `original_client_message_id`, alongside the existing `client_message_id`.
- **FR-002**: The CRM's `NEW_MESSAGE` socket handler MUST match an incoming message against an existing local bubble by **either** `client_message_id` equality **or** (`original_client_message_id` present and) equality against the bubble's current `client_message_id` — covering both the already-working non-Page case and the newly-fixed Page case.
- **FR-003**: When a match is found via `original_client_message_id` (i.e. the ids differ), the matched bubble's `client_message_id` MUST be overwritten to the incoming message's `client_message_id` (the server's `queue_`-derived id), so that all *subsequent* events for this send (`MESSAGE_SENT`, `MESSAGE_SEND_FAILED`, the correlation `NEW_MESSAGE`, feature 020's silent id-upgrade) — which only ever carry the `queue_`-derived id — continue to find and update the same bubble.
- **FR-004**: No change to `MessageQueueRepository`, `QueueWorker.js`, `background.js`, the database schema, or how `client_message_id` is stored in the `messages` table — this is a client-visible reconciliation fix only, layered on top of the existing (unchanged) internal id scheme.
- **FR-005**: No change to the non-Page branch's behavior — it already works because caller and server agree on the id; adding `original_client_message_id` there is optional/harmless (it would just equal `client_message_id`).

### Key Entities

- **Original Client Message ID**: the id the CRM frontend generated locally when the user pressed send, before the server possibly replaces it with its own `queue_`-derived id for Page-thread routing. Exists only transiently in the first socket emit — never persisted, never referenced again once the frontend has reconciled its local bubble.

## Success Criteria

- **SC-001**: Sending "test" to a Page thread from the CRM results in exactly one bubble, transitioning cleanly from "sending" (spinner) to "sent" (checkmark) — reproduced live, not just inferred from DB state.
- **SC-002**: Sending to a personal-messenger thread shows no behavior change.
- **SC-003**: `npm run test:persistence` passes unmodified (no backend logic touched in a way that changes DB behavior).

## Assumptions

- This fixes the *symptom* the user can see (duplicate/stuck bubbles) without touching the deeper, more invasive architecture (threading the frontend's real id all the way through `message_queue` → `QueueWorker` → the extension) that would let the two ids be unified everywhere instead of reconciled once on the client. That deeper rework remains available as a future option if this reconciliation approach ever proves insufficient, but is out of scope here as unnecessary risk for the problem actually observed.
