# Feature Specification: Page Messenger Direction Reconciliation & Contact Identity

**Feature Branch**: `011-page-direction-contact-fix`
**Created**: 2026-08-07
**Status**: Draft

**Input**: Feature 010 fixed identity/timestamp/direction detection for `page_dom_observer`, but two gaps surfaced in live testing: (1) messages captured *before* the direction fix are stuck with `is_outgoing=0` forever, because the pre-existing "already known fb_message_id → skip" guard in `server.js` (meant to stop the DOM observer from re-inserting a duplicate of a message it just confirmed) now intercepts every re-scan of those rows *before* any correction logic can run, since that guard only became reachable once `is_outgoing` started evaluating to `true`; (2) Page threads never show the customer's real name or avatar — they're stuck on the generic "Khách hàng" placeholder and an initials circle — because `page_content.js` never extracts a contact name or avatar from Business Suite at all (unlike `content.js`, which already does this for personal-messenger threads).

## User Stories

### US1 — Already-captured Page messages self-correct (P1)

Given a Page message was stored with the wrong `is_outgoing` before direction detection worked, the next time the DOM observer scans it, the stored value is corrected in place — without needing a manual DB edit or a fresh conversation to "start clean."

**Acceptance**: A message previously stored with `is_outgoing=0` that the extension now detects as outgoing gets updated to `is_outgoing=1` on the next scan, and vice versa. The pre-existing "avoid duplicate insert on repeated DOM confirmation" protection continues to work — no duplicate rows, no UNIQUE constraint crash.

### US2 — Page threads show the real customer name (P1)

Given a Page conversation with a known customer, the CRM shows that customer's actual display name instead of the generic "Khách hàng" placeholder.

**Acceptance**: After the extension has scanned a Page thread at least once, the thread's `contact_name` reflects the name shown in Business Suite's conversation header, for both existing and newly-created threads.

### US3 — Page threads show the real customer avatar (P2)

Given a Page conversation where Business Suite displays a profile photo for the customer, the CRM shows that same photo instead of a generic colored-initial circle.

**Acceptance**: When Business Suite exposes an avatar image for the contact, the CRM eventually displays it. When no avatar is available, the existing colored-initial fallback in `MessageBubble.jsx` is left untouched.

## Functional Requirements

- **FR-001**: The "already known fb_message_id" duplicate-guard in `server.js` MUST NOT prevent an `is_outgoing` correction from being applied to an existing row; it MUST continue to prevent duplicate inserts/crashes for the same fb_message_id.
- **FR-002**: Extension MUST extract the customer's display name from the Business Suite DOM for a Page thread (conversation header or contact info panel) and forward it to the backend as `contact_name`.
- **FR-003**: Extension MUST extract the customer's avatar image URL from the Business Suite DOM for a Page thread, when one is present, and forward it to the backend.
- **FR-004**: Backend MUST update a thread's `contact_name` (and avatar, via the existing contacts pipeline) when a real value becomes available, not only at thread-creation time — today `contact_name` is set once to the "Khách hàng" placeholder and never revisited.
- **FR-005**: Contact-name/avatar extraction MUST be a per-thread lookup (throttled to once per thread open/switch), not repeated on every 1-second message-scan tick, since it is a thread-level property, not a per-message one.
- **FR-006**: None of the above MUST change existing behavior for the personal-messenger path (`content.js`/`dom_observer` source), which already resolves name/avatar correctly.

### Key Entities

- **Page Contact Identity**: display name + avatar URL scraped from the Business Suite conversation header/contact panel, associated with a thread/external_thread_id, independent of any single message.

## Success Criteria

- **SC-001**: The previously-stuck "Khách hàng" test thread shows its outgoing messages ("1", "2", "2", "1") on the correct side after one resync, with zero manual DB edits.
- **SC-002**: A Page thread's `contact_name` matches the name shown in Business Suite within one sync cycle of the thread being opened.
- **SC-003**: A Page thread's avatar matches Business Suite's when one exists, within one sync cycle.
- **SC-004**: Regression test confirms loosening the fb_message_id guard introduces zero duplicate rows and zero UNIQUE constraint errors across repeated re-scans of the same message.

## Assumptions

- The customer's name and (if any) avatar are visible somewhere in Business Suite's conversation header or contact info side panel while a thread is open — a live DOM inspection (same approach as feature 010's Phase 0 research) is needed to find stable selectors before implementation; no selector should be guessed without that inspection, per the lesson from feature 010.
- If Business Suite exposes no avatar for a given contact, the existing colored-initial fallback already in `MessageBubble.jsx` is sufficient — no new fallback UI is needed.
