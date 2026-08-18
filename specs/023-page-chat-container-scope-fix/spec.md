# Feature Specification: Page Chat Container Scope Fix

**Feature Branch**: `023-page-chat-container-scope-fix`
**Created**: 2026-08-10
**Status**: Draft

**Input**: Business Suite Page threads in the CRM show fake "messages" that are not chat content at all — they are text scraped from Meta Business Suite's own account/page-switcher panel (labels like "Tài khoản của bạn", "Trang quản lý tài sản doanh nghiệp", "X tài sản doanh nghiệp", and Page/Business-Manager names such as "Cà Phê Hà Nội - 299"). Root cause traced to `page_content.js`: `scanForMessages()` walks every text node in `document.body` every second, and the only guard against non-chat text — `walkBubbleAncestors()` / `findMessageListContainer()` treating any ancestor with `role="main"` or `role="grid"` as "the chat container" — is too permissive. Business Suite reuses those same ARIA roles for unrelated widgets (including the account/page switcher), so when that switcher is open, its text passes the containment check, is mistaken for a backlog message with no `data-message-id`, and gets forwarded to whatever thread is currently open in the URL. Feature 010 (`page-message-capture-integrity`) hardened identity/timestamp/direction for *real* messages but never addressed non-message UI leaking in as if it were one.

## User Stories

### US1 — Non-chat UI text is never stored as a message (P1)

Given a Business Suite tab where the user opens the account/page switcher (or any other overlay/panel that shares `role="main"`/`role="grid"` with the real chat container) while a Page thread is open, the CRM must not create any message rows from that panel's text.

**Acceptance**: Opening the account/page switcher over an open Page thread produces zero new rows in `messages` for that thread. Re-running the existing capture test suite for genuine chat text shows no regression.

### US2 — Existing junk rows can be identified and removed (P2)

Given the junk already persisted in production (rows sourced from `page_dom_observer` with no `fb_message_id` whose content matches known switcher-panel strings), an operator must be able to find and remove them without touching genuine messages.

**Acceptance**: A cleanup pass (script or SQL, following the existing `scripts/cleanupJunkMessages.js` pattern) reports the candidate rows before deleting, and after running, the affected thread's history in the CRM matches Business Suite's real message list.

### US3 — Containment check is anchored to the real message list, not any role="main"/"grid" ancestor (P1)

Given the current thread's real message list container (the element `findMessageListContainer()` locates by walking up from an actual `[data-message-id]` node), only text that is a descendant of that specific container — or a genuine `[data-message-id]` bubble — is eligible to be forwarded as a message.

**Acceptance**: `walkBubbleAncestors()` no longer treats an arbitrary `role="main"`/`role="grid"` ancestor found while walking up from *any* text node as sufficient; it must check containment against the resolved message-list container itself.

## Functional Requirements

- **FR-001**: `page_content.js` MUST only forward a scanned text/media fragment as a message if it is a descendant of the currently-resolved message-list container (`findMessageListContainer()`'s result) or of a genuine `[data-message-id]` node, not merely a descendant of any element with `role="main"` or `role="grid"`.
- **FR-002**: When `findMessageListContainer()` cannot resolve a container for the current thread (e.g., no `[data-message-id]` mounted yet), `scanForMessages()` MUST NOT fall back to scanning the whole document body for forwarding purposes.
- **FR-003**: The no-`fb_message_id` "pending bubble" path (`processPotentialMessage`) MUST NOT grant a bubble ancestor eligibility to forward purely from having `dir="auto"`; it must still pass the tightened containment check in FR-001.
- **FR-004**: A cleanup utility MUST be able to identify already-persisted junk rows (source `page_dom_observer`, no `fb_message_id`, content matching known switcher/menu strings such as "tài sản doanh nghiệp", "Tài khoản của bạn") and delete them after a dry-run report, mirroring `scripts/cleanupJunkMessages.js`.
- **FR-005**: None of the above changes MUST alter the personal-messenger capture path (`content.js`) or regress feature 010's identity/timestamp/direction fixes for genuine Page DOM messages.

### Key Entities

- **Message-list container**: the single DOM element (resolved by `findMessageListContainer()`) that actually wraps the open thread's message bubbles, as opposed to any other page region that happens to share the same ARIA role.
- **Junk row**: a persisted `messages` row whose `source = 'page_dom_observer'`, has no `fb_message_id`, and whose content originates from a Business Suite UI panel rather than a real chat bubble.

## Success Criteria

- **SC-001**: Manually opening the account/page switcher over 3 different open Page threads produces 0 new message rows across all 3, both immediately and after the existing 2-tick pending-id window elapses.
- **SC-002**: 100% of previously-identified junk rows (matched by FR-004's cleanup pass) are removed from the affected threads without deleting any real message.
- **SC-003**: Existing genuine-message capture behavior (identity, order, direction from feature 010) shows no regression on a 2-3 thread side-by-side comparison against Business Suite.

## Scope and Assumptions

In scope: `page_content.js`'s containment/eligibility filter (`walkBubbleAncestors`, `findMessageListContainer`, `scanForMessages`) and a one-off cleanup pass for already-captured junk rows. Out of scope: the personal-messenger path (`content.js`), the outbound send/queue pipeline, and the Page Graph API path (`PageMessengerAdapter.js`).

Assumes the real message-list container is reliably reachable by walking up from an actual `[data-message-id]` node (already relied upon by `findMessageListContainer()` and `findScrollableMessageContainer()`); if Business Suite ever renders a thread with zero `[data-message-id]` nodes mounted, FR-002 defines the safe fallback (scan nothing) rather than guessing.
