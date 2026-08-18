# Feature Specification: Page Message Capture Integrity

**Feature Branch**: `010-page-message-capture-integrity`
**Created**: 2026-08-06
**Status**: Draft

**Input**: Feature 009 (`page-extension-sync`) replaced the Meta Webhook with a DOM observer (`page_content.js`) that scrapes Business Suite. In production, Page threads visibly lose messages (repeated customer texts like "alo", "1", "2" get collapsed) and display them out of chronological order compared to Meta Business Suite itself. Root cause traced to: no real Facebook message ID/timestamp is ever extracted from the DOM, so the backend falls back to a content-only fingerprint that collides on repeated identical text, and message ordering falls back to server receipt time instead of the true Facebook timestamp. `is_outgoing` detection also misclassifies 100% of sampled Page messages as incoming.

## User Stories

### US1 — No message lost to duplicate text (P1)

Given a Page thread where the customer sends the same short text twice in a row (e.g. "1", then "alo", then "1" again), the CRM must store and display both occurrences as separate messages.

**Acceptance**: Two DOM-captured messages with identical `thread_id` + `content` but originating from two distinct real Facebook messages are never collapsed into one stored row. Repeating the same scan tick on an unchanged DOM does not create duplicates either.

### US2 — Chronological order matches Facebook (P1)

Given a Page thread with interleaved incoming and outgoing messages, the CRM displays them in the same order as Meta Business Suite, not in the order the DOM poller happened to detect them.

**Acceptance**: For a sampled thread, the sequence of messages in the CRM UI matches the sequence in Business Suite when compared side by side. No message's displayed position depends on `setInterval` scan timing.

### US3 — Correct incoming/outgoing attribution (P2)

Given a Page thread, a message sent by the Page (agent reply, visible as the right-aligned/blue bubble in Business Suite) is stored and displayed as outgoing; a message sent by the customer is stored as incoming.

**Acceptance**: Sampled Page messages that are visibly outgoing in Business Suite are `is_outgoing = 1` in the CRM; sampled incoming ones are `is_outgoing = 0`. Today 100% of sampled Page DOM messages are misclassified as incoming.

### US4 — Full history survives list virtualization (P3)

Given a Page conversation with more history than currently fits in the visible viewport of the Business Suite inbox, scrolling/loading older messages results in those messages eventually reaching the CRM.

**Acceptance**: After the extension triggers a scroll-back pass on a thread with more than one screen of history, previously-unseen older messages appear in the CRM without duplicating already-captured ones.

## Functional Requirements

- **FR-001**: Extension MUST derive, for every DOM-captured Page message, an identity key that does not collide between two distinct messages that share the same `thread_id` and text.
- **FR-002**: Extension MUST extract a real per-message timestamp (or a reliable ordering proxy tied to the message's true position, e.g. DOM/React-derived original time) and forward it as `timestamp_ms`/`timestamp_source`, instead of omitting it.
- **FR-003**: Backend MUST order and correlate Page DOM messages using the extracted timestamp/identity, not `Date.now()` receipt order or a content-only fingerprint (`ConversationRepository.fingerprint`).
- **FR-004**: Extension MUST classify a captured Page message's direction (`is_outgoing`) from the actual Business Suite DOM structure, replacing the current fixed 5-parent-level inline-style walk-up that misclassifies all samples as incoming.
- **FR-005**: Extension MUST be able to surface message content that is outside the currently-rendered viewport of a virtualized Business Suite message list (via scroll-back or an equivalent traversal), so history is not silently limited to whatever is mounted at scan time.
- **FR-006**: The debug-only DOM dump path in `page_content.js` (`NEW_PAGE_MESSAGE_FROM_DOM` with `content: 'DUMP: ' + container.innerHTML...'`) and the per-message `console.log`/attribute-dump debug output MUST be removed or gated behind an explicit debug flag before this feature is considered done.
- **FR-007**: None of the above changes MUST alter the existing personal-account (`content.js`) capture path or reintroduce the Meta Webhook (`PageMessengerAdapter` webhook receive) that feature 009 already disabled.

### Key Entities

- **Captured DOM Message**: a single message observed by `page_content.js`, now carrying a collision-resistant identity, a real timestamp, and a verified direction, in addition to `thread_id`/`content`/`page_id`.

## Success Criteria

- **SC-001**: Sending the same short text twice in one Page thread results in two stored, two displayed messages — 0 collapsed duplicates across a 20-message manual test conversation.
- **SC-002**: Displayed order of a sampled Page thread matches Business Suite's own order for at least 95% of sampled threads.
- **SC-003**: `is_outgoing` matches Business Suite ground truth for at least 95% of sampled Page messages in both directions (today: ~0%).
- **SC-004**: Scrolling a thread with hidden/virtualized history surfaces previously-missing older messages in the CRM within one sync interval, with no duplicate rows created in the process.

## Scope and Assumptions

In scope: Page-messenger capture via `page_content.js` / `page_dom_observer` only (Business Suite DOM). Personal-messenger capture (`content.js`) and outbound queue/send behavior from feature 009 are out of scope — assumed working and must not regress.

Assumes Business Suite's DOM exposes *some* stable per-message signal (timestamp string on hover/aria-label, or a React fiber prop) that a research spike can locate; if none exists, the fallback identity/ordering strategy chosen in the plan must be documented as a known limitation rather than silently shipped as "fixed."
