# Implementation Plan: Page Messenger Direction Reconciliation & Contact Identity

## Architecture

Same topology as feature 010: `page_content.js` → `background.js` → Socket.IO → `server.js` → `ConversationRepository`. Two independent problem areas, addressed as separate phases so they can land/verify independently:

- **A. Direction reconciliation ordering bug** — backend-only, `server.js`.
- **B. Contact identity capture** — extension (`page_content.js`) + backend thread/contact upsert.

## Phases

0. **Research spike (required before B, not needed for A)**: inspect a live Business Suite thread in DevTools to find where the customer's display name and avatar actually live in the DOM (conversation header title, contact info side panel, `img` `src` vs CSS `background-image`). Document in `specs/011-page-direction-contact-fix/research.md`. Do not reuse any selector from feature 010's `research.md` without re-verifying it live — that file already contained one fabricated finding (`.x15zctf7`) that cost two extra debug rounds.

1. **Fix A — reorder the duplicate-guard vs. correction check** in `src/server.js`'s `NEW_MESSAGE_RECEIVED` handler (~L338-346): today, `if (m.fb_message_id) { if (existingFbId) { break; } }` unconditionally stops processing before the `is_outgoing` self-healing logic added in feature 010 (further down, in the `!wasNewMessage` branch) ever runs. Move the "does this existing row's `is_outgoing` need correcting" check to run *before* that break, and only break afterward — so the duplicate-insert protection and the correction logic no longer race each other for the same condition.

2. **Fix B1 — contact name/avatar extraction (extension)**: add a throttled (once per thread open/switch, not per scan tick) lookup in `page_content.js` using the selector(s) found in Phase 0, and include `contact_name`/`avatar_url` (or a base64/blob reference, matching whatever `content.js`'s existing avatar pipeline expects) in the `NEW_PAGE_MESSAGE_FROM_DOM` payload only when resolved.

3. **Fix B2 — backend contact upsert**: extend the thread-upsert path in `server.js`/`ConversationRepository.upsertThread` so a real `contact_name` overwrites the "Khách hàng" placeholder once available (today it's only set once at thread creation), and reuse (or extend) the existing avatar-save pipeline (`saveAvatarFromBase64OrUrl`, currently only triggered for incoming messages carrying `avatar_base64`/`avatar_url`/`contact_avatar`) so it also fires for `page_dom_observer` payloads once those fields are populated.

4. **Validation**: rerun against the already-stuck "Khách hàng" test thread (should self-correct without a DB edit) and a brand-new Page thread (should show the real name/avatar from the first sync). Then `graphify update .`.

## Safety Gates

- Do not change `content.js` / personal-messenger contact resolution, which already works.
- Reordering the duplicate-guard in Fix A must not weaken its original purpose: repeated DOM confirmation of the same `fb_message_id` must still never produce a second row or a UNIQUE constraint crash. Add a regression test for this before considering Fix A done.
- Contact-info scraping in Fix B1 must be throttled per thread, not run on every 1s message-scan tick — it is a thread-level property, not a per-message one, and re-querying the DOM for it every second is wasted work.
- No migration that deletes or renumbers existing `messages`/`threads`/`contacts` rows.
