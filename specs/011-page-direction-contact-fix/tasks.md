# Tasks: Page Messenger Direction Reconciliation & Contact Identity

## Phase 0 — Research spike (blocking Phase 2, not Phase 1)

- [x] T001 Live-inspect a Business Suite thread in DevTools to find the DOM location of the customer's display name (conversation header / contact panel) and avatar (`img src` or CSS background); document exact selectors in `specs/011-page-direction-contact-fix/research.md`. Do not guess — feature 010's `research.md` already had one fabricated selector that cost two extra rounds.

## Phase 1 — Fix A: direction-reconciliation ordering (backend only)

- [x] T002 In `src/server/server.js` (~L338-346), move the `is_outgoing` correction check (added in feature 010, currently in the `!wasNewMessage` branch further down) so it runs *before* the `if (existingFbId) { break; }` guard, instead of after it. The duplicate-insert protection itself must remain intact.
- [x] T003 Add a regression test: (a) insert a page_dom_observer message with `is_outgoing=0`; (b) re-process the same `fb_message_id` with `is_outgoing=1`; assert the stored row updates to `is_outgoing=1` with no second row created; (c) re-process the same event a third time unchanged; assert still exactly one row and no crash.

## Phase 2 — Fix B1: contact name/avatar extraction (extension)

- [x] T004 Using the selectors from T001, add a per-thread (not per-tick) contact-name lookup in `src/extension/page_content.js`, cached and only re-queried when `resolveCurrentThreadId()` changes.
- [x] T005 Using the selectors from T001, add a per-thread avatar lookup (image URL or equivalent) alongside T004 in `src/extension/page_content.js`.
- [x] T006 Include `contact_name` and `avatar_url` (naming to match whatever `content.js`/backend already expects) in the `NEW_PAGE_MESSAGE_FROM_DOM` payload, only when resolved (do not send empty/placeholder values that would overwrite a good name with nothing).

## Phase 3 — Fix B2: backend contact upsert

- [x] T007 Extend the thread-upsert call path in `src/server/server.js` (or `ConversationRepository.upsertThread`) so a real incoming `contact_name` overwrites the "Khách hàng" placeholder on existing threads, not only at thread-creation time.
- [x] T008 Extend the existing avatar-save logic (`saveAvatarFromBase64OrUrl`, currently gated on `m.content && !isOutgoing` with `avatar_base64`/`avatar_url`/`contact_avatar`) so it also runs for `page_dom_observer` payloads now that those fields can be populated.
- [x] T009 Add a regression test: a `page_dom_observer` message carrying `contact_name`/`avatar_url` results in the thread's stored contact name/avatar being updated accordingly.

## Phase 4 — Validation

- [x] T010 Re-run against the already-stuck "Khách hàng" test thread from the 010 test round: confirm outgoing messages self-correct to the right side with no manual DB edit, and the thread eventually shows the real customer name/avatar.
- [x] T011 Open a brand-new Page thread and confirm name/avatar appear correctly from the first sync.
- [x] T012 Run `graphify update .`.

## Dependencies

- Phase 0 blocks Phase 2 (need real selectors before writing extraction code) but not Phase 1 (Fix A is backend-only and independent of contact info).
- Phase 1 and Phase 2 can proceed in parallel once Phase 0 is done.
- Phase 3 depends on Phase 2 (needs the new payload fields to exist).
- Phase 4 runs last, after all prior phases.
