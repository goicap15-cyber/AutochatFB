# Tasks: Page Contact Scope & Avatar Backfill Fix

## Phase 1 — Fix A: avatar backfill for existing messages (backend)

- [x] T001 In `src/server/server.js`, move/duplicate the avatar-save call (currently ~L474-487, gated behind `if (!wasNewMessage) break;` at ~L470) so it also runs when `!wasNewMessage`, an `avatar_url`/`avatar_base64`/`contact_avatar` is present, and the thread's currently-stored avatar is missing/placeholder.
- [x] T002 Guard T001 so it does not re-write the same avatar on every scan tick once a real (non-placeholder) avatar is already stored for the thread — check existing `contacts.avatar_url` before writing.

## Phase 2 — Fix B: scope the contact lookup (extension)

- [x] T003 In `src/extension/page_content.js`, factor the message-list container detection (the `role="region"` walk already used for `inChatContainer` in `processPotentialMessage`) into a shared helper function.
- [x] T004 Change the contact lookup (`document.querySelector('.x1q0g3np img[height="32"]')` in `scanForMessages`) to query within the container from T003 instead of `document`.

## Phase 3 — Fix C: write the missing regression tests

- [x] T005 Add a regression test asserting an existing message's `is_outgoing` is corrected on re-scan (same `fb_message_id`, flipped direction) with zero duplicate rows created.
- [x] T006 Extend T005's test (or add a second test) asserting the same re-scan repeated a third time, unchanged, still produces exactly one row and no error/crash.
- [x] T007 Add a regression test asserting a `page_dom_observer`-shaped payload carrying `contact_name`/`avatar_url` results in the thread's stored contact name and avatar being updated.

## Phase 4 — Fix D: restore upsertThread's no-name-provided behavior

- [x] T008 In `src/server/repositories/ConversationRepository.js`, adjust the `contact_name` `CASE` in `upsertThread` so a caller passing no `contact_name` at all never changes an existing thread's stored value (matching the pre-011 `COALESCE(?, contact_name)` behavior).
- [x] T009 Add a regression test: calling `upsertThread` with no `contact_name` on a thread that already has "Khách hàng" leaves it as "Khách hàng"; calling it with no `contact_name` on a thread that already has a real name leaves that name untouched; calling it with a genuine new real name still overwrites the placeholder (regression guard for feature 011's original fix).

## Phase 5 — Validation

- [ ] T010 Re-run against the still-stuck "Khách hàng" test thread from the 010/011 rounds: confirm the avatar now backfills without a new message arriving. **(requires live browser test — not run by this pass)**
- [ ] T011 Live-check in Business Suite with the sidebar conversation list visible: confirm the scoped contact lookup never returns an avatar/name from a different thread. **(requires live browser test — not run by this pass)**
- [x] T012 Run `npm run test:persistence` and confirm all tests, including the 3 new ones from Phase 3/4, pass. — 16/16 pass.
- [x] T013 Run `graphify update .`.

## Dependencies

- Phase 1 and Phase 2 are independent and can proceed in parallel.
- Phase 3's tests depend on Phase 1 and Phase 4's fixes existing (tests should be written against the fixed behavior, not before it).
- Phase 4 is independent of Phases 1-2.
- Phase 5 runs last, after all prior phases.
