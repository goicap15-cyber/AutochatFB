# Implementation Plan: Page Contact Scope & Avatar Backfill Fix

## Architecture

No new topology — this is a hardening pass on feature 011's changes, entirely within `src/extension/page_content.js`, `src/server/server.js`, and `src/server/repositories/ConversationRepository.js`. Four independent fixes, safe to land separately.

## Phases

1. **Fix A — avatar backfill for existing messages** (`server.js`): the avatar-save block currently sits after `if (!wasNewMessage) break;` (~L470), so it never runs for a message that already exists. Move (or duplicate, gated the same way as the existing `is_outgoing`/`timestamp` self-healing added in feature 011) the avatar-save call so it also runs when `!wasNewMessage` but a resolvable `avatar_url`/`avatar_base64`/`contact_avatar` is present and the thread's current avatar is missing or a placeholder. Do not re-save on every re-scan once a real avatar is already stored — check before writing.

2. **Fix B — scope the contact lookup** (`page_content.js`): reuse the existing message-list container detection (the `role="region"` walk already used for `inChatContainer` in `processPotentialMessage`) as the root for `document.querySelector('.x1q0g3np img[height="32"]')`, instead of querying from `document`. Factor the container lookup into a shared helper if it isn't already, so both the direction-detection filtering and the contact lookup use the same boundary.

3. **Fix C — write the missing regression tests**: add the two tests feature 011 claimed but never wrote, in `tests/integration/pageMessageDedup.test.js` (or a new file if the direction-reconciliation logic under test can't be reached through `ConversationRepository` alone and needs a lighter-weight harness around the relevant `server.js` logic — determine this during implementation, not before).

4. **Fix D — restore `upsertThread`'s no-name-provided behavior**: adjust the `contact_name` `CASE` in `ConversationRepository.upsertThread` so that a caller passing no `contact_name` (`null`/`undefined`) never changes the existing value, matching the pre-011 `COALESCE(?, contact_name)` behavior, while still letting a genuine new name overwrite the "Khách hàng" placeholder.

5. **Validation**: re-run against the still-stuck "Khách hàng" test thread (avatar should now backfill without a new message), a live Business Suite session with the sidebar visible (confirm the scoped selector never crosses threads), and the full test suite including the two new regression tests.

## Safety Gates

- Fix A must not cause avatar writes on every scan tick once a real avatar is stored — check-before-write, not unconditional overwrite.
- Fix B must not change direction detection or system-message filtering behavior — only the contact-lookup boundary.
- Fix D must not reintroduce the original bug feature 011 was fixing (placeholder never overwritten by a genuine new name) — both directions need a test.
- No migration that deletes or renumbers existing `messages`/`threads`/`contacts` rows.
