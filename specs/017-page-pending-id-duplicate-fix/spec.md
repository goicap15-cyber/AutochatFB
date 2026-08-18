# Feature Specification: Page Pending-ID Duplicate Fix

**Feature Branch**: `017-page-pending-id-duplicate-fix`
**Created**: 2026-08-07
**Status**: Draft

**Input**: Live testing on the "Mang Bảo Khánh" Page thread shows freshly-arriving messages (both incoming and outgoing) appearing twice in the CRM, while older backlog messages do not. Root cause, confirmed via code review: `page_content.js`'s 1-second `scanForMessages()` tick can capture a message bubble before Facebook has attached its `data-message-id` attribute — a real timing race for just-rendered messages. The first capture sends `fb_message_id: null` to the backend. `server.js:432` (`stableMessageId = m.fb_message_id || m.client_message_id || ConversationRepository.fingerprint(...)`) falls back to a content+timestamp hash (`fingerprint()`) for this null case and inserts it as a real row. On the very next 1s tick, the same bubble now has its real `data-message-id` attached; `page_content.js`'s client-side dedup key (`processedHashes`) changes from `text_isOutgoing` to the real ID, so it isn't recognized as already-sent and is forwarded again — landing on a *different* `stableMessageId` (the real Facebook ID vs. the earlier fingerprint hash) than the first insert, so the `fb_message_id UNIQUE` constraint never catches it. Two rows persist for one real message.

## User Stories

### US1 — A message captured before its real ID is attached never becomes a duplicate row (P1)

Given a message bubble is scanned on a tick where Facebook hasn't yet attached `data-message-id`, and the same bubble is scanned again on a later tick once the real ID is attached, only one row ever exists in `messages` for it.

**Acceptance**: Simulating two `scanForMessages` ticks for the same logical bubble — tick 1 with no `data-message-id`, tick 2 with a real one attached — results in exactly one forwarded message, keyed by the real ID.

### US2 — Genuinely ID-less messages are still captured (P2)

Given a message that never gets a `data-message-id` within a bounded wait (rare, but not assumed impossible), it must still be captured — this fix defers a likely-about-to-get-an-ID message, it does not drop messages that turn out to have no ID at all.

**Acceptance**: A message still lacking `data-message-id` after the bounded wait is still forwarded and stored, via today's null-forwarding fallback.

## Functional Requirements

- **FR-001**: `processPotentialMessage()` MUST NOT forward a message with `fbMessageId === null` on the very first tick it's observed — it MUST defer for a bounded number of ticks to give Facebook a chance to attach the real `data-message-id`.
- **FR-002**: A deferred bubble MUST be forwarded with its real ID as soon as `data-message-id` is found for it on a later tick, OR forwarded with `fb_message_id: null` (today's existing fallback, unchanged) once the bounded wait (FR-003) expires with no ID ever attaching — preserving US2.
- **FR-003**: The bounded wait MUST be small (2 ticks / ~2s at today's 1s scan cadence) so real-time display latency for the common case (ID attaches promptly) is not meaningfully affected.
- **FR-004**: Tracking "the same bubble" across ticks MUST NOT require a `data-message-id` (it doesn't have one yet) — track by the bubble's own DOM element reference instead, using a `WeakMap` so entries never leak once a bubble is unmounted (e.g. scrolled out of the virtualized list).
- **FR-005**: No change to `server.js` (`fingerprint()`, `stableMessageId`, `reconcileExistingMessage`) or the personal-messenger path (`handleSendMessage`, `content.js`) — scoped entirely to `page_content.js`'s capture-time forwarding decision.
- **FR-006**: No change to direction detection (`isMessageOutgoing`), timestamp assignment (`assignOrderedTimestamps`), or contact/avatar extraction logic.

### Key Entities

- **Pending Bubble**: a message-bubble DOM element observed without a `data-message-id`, tracked in a `WeakMap<Element, { firstSeenTick }>` for up to FR-003's bound before falling back to today's null-ID forwarding.

## Success Criteria

- **SC-001**: Sending a fresh message (either direction) on the "Mang Bảo Khánh" Page thread results in exactly one row in `messages`, not two.
- **SC-002**: Older backlog messages (already stably rendered with `data-message-id` by the time they're first scanned) are unaffected — still captured on first scan, zero added latency.
- **SC-003**: A message that genuinely never gets an ID is still captured, just delayed by up to the bounded wait — not silently dropped.

## Assumptions

- The race is "ID attaches within 1-2 ticks of first render," not an indefinite delay — matches what's observable live (backlog messages, scanned well after render, always already have their ID).
- The bubble element identified during the existing `dir="auto"` ancestor walk (already performed for structural filtering) remains the same DOM node across the 1-2 ticks it's pending — React updates attributes in place rather than replacing the node for this case. If virtualization ever remounts it as a new node mid-wait, the fix degrades to today's behavior for that bubble (forwarded again as new when the wait expires) rather than crashing — acceptable per FR-002's bounded fallback.
