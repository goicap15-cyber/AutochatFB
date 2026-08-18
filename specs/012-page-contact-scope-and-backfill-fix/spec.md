# Feature Specification: Page Contact Scope & Avatar Backfill Fix

**Feature Branch**: `012-page-contact-scope-and-backfill-fix`
**Created**: 2026-08-07
**Status**: Draft

**Input**: Code review of feature 011's implementation surfaced 4 gaps: (1) the avatar-save block in `server.js` only runs when a message is a brand-new insert (`wasNewMessage === true`), so a thread whose messages already existed before contact-avatar extraction was added never gets its avatar backfilled — it stays on the generic initials circle forever unless a genuinely new message arrives; (2) the contact-name/avatar lookup in `page_content.js` (`document.querySelector('.x1q0g3np img[height="32"]')`) queries the entire page, not the currently-open thread's message pane, and `x1q0g3np` is a generic Facebook utility class that may also appear on unrelated elements (e.g. the sidebar conversation list's own avatar thumbnails) — risking picking up the wrong contact's photo; (3) the two regression tests feature 011 asked for (guard-reorder self-healing, contact upsert) were never actually written despite being marked complete; (4) `ConversationRepository.upsertThread`'s new `contact_name` CASE logic can overwrite an existing "Khách hàng" placeholder with a genuine `NULL` from a caller that passes no name at all, instead of preserving the placeholder like the previous `COALESCE`-based logic did.

## User Stories

### US1 — Already-existing Page threads eventually get a real avatar (P1)

Given a Page thread whose messages were already stored before contact-avatar extraction existed, the thread's avatar is corrected the next time the DOM observer resolves a real avatar for it — without requiring a brand-new incoming message to arrive first.

**Acceptance**: Re-scanning an existing thread with a newly-resolved `avatar_url` updates the stored contact avatar, whether or not the specific message being processed is itself new.

### US2 — Contact lookup never crosses into another conversation (P1)

Given the Business Suite inbox has both a conversation list (with its own avatar thumbnails) and an open message pane, the extension's contact name/avatar lookup only ever reads from the currently-open thread's message pane, never from the sidebar list or another thread.

**Acceptance**: The lookup selector is scoped to the same message-list container already used for direction detection and system-message filtering, not `document`-wide.

### US3 — The two missing regression tests actually exist (P2)

Given feature 011 claimed a regression test for the guard-reorder self-healing fix and one for contact upsert, both tests exist, run, and fail if either fix regresses.

**Acceptance**: `npm run test:persistence` includes and passes a test asserting an existing message's `is_outgoing` can be corrected without creating a duplicate row or crashing, and a test asserting a `page_dom_observer` payload with `contact_name`/`avatar_url` updates the thread's stored contact info.

### US4 — Thread contact-name placeholder is never regressed to NULL (P3)

Given any caller of `upsertThread` that doesn't pass a `contact_name` at all, an existing thread's placeholder ("Khách hàng") or real name is preserved exactly as the pre-011 `COALESCE` behavior did.

**Acceptance**: Calling `upsertThread` with no `contact_name` field never changes an existing thread's stored `contact_name`, regardless of whether that stored value is a real name or the placeholder.

## Functional Requirements

- **FR-001**: The avatar-save logic in `server.js` MUST be reachable for a message that already exists in the database, not only for a brand-new insert, whenever that message carries a resolvable avatar.
- **FR-002**: The contact-name/avatar DOM lookup in `page_content.js` MUST be scoped to the currently-open thread's message-list container, using the same container-resolution approach already used elsewhere in that file (see the `role="region"` check used for `inChatContainer`).
- **FR-003**: A regression test MUST exist covering: an existing message's `is_outgoing` is corrected on re-scan with zero duplicate rows and zero crashes across repeated re-processing of the same `fb_message_id`.
- **FR-004**: A regression test MUST exist covering: a `page_dom_observer` payload carrying `contact_name`/`avatar_url` results in the thread's stored contact name and avatar being updated.
- **FR-005**: `ConversationRepository.upsertThread` MUST NOT overwrite an existing `contact_name` (real or placeholder) when the caller passes no `contact_name` at all; it MUST still allow a genuine new name to overwrite the placeholder, per feature 011's original intent.

### Key Entities

- **Contact Avatar Backfill**: the act of applying a resolved avatar to a thread's `contacts` row independent of whether the triggering message was newly inserted.

## Success Criteria

- **SC-001**: The previously-stuck "Khách hàng" test thread from the 010/011 test rounds shows the real customer avatar after one resync, with no manual DB edit and no new message required.
- **SC-002**: A manual check confirms the contact lookup selector never returns an element outside the currently-open thread's message pane (verified against a live Business Suite session with the sidebar list visible).
- **SC-003**: `npm run test:persistence` passes with the two new regression tests included, and fails if either underlying fix is reverted.
- **SC-004**: A regression test confirms `upsertThread` with no `contact_name` leaves an existing "Khách hàng" placeholder (and a real name) untouched.

## Assumptions

- The message-list container-resolution logic already in `page_content.js` (the `role="region"` walk used for `inChatContainer`) is reusable as the scope boundary for the contact lookup; no new selector research is needed for this specific fix, only reuse of what's already verified.
- Fixing FR-001 does not require re-deriving the avatar on every scan tick for threads that already have one — a check ("does this thread already have a non-placeholder avatar") is enough to avoid redundant writes.
