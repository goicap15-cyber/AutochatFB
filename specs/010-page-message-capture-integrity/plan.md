# Implementation Plan: Page Message Capture Integrity

## Architecture

Keep the existing topology from feature 009: `page_content.js` (DOM observer in Business Suite tab) → `background.js` → Socket.IO → `server.js` → `ConversationRepository`. Do not touch the outbound queue (`QueueWorker.js`, `MessageQueueRepository.js`) or the personal-messenger path (`content.js`). Fix the three weak links inside the inbound capture chain: identity, timestamp, direction — plus close the virtualization gap.

## Phases

0. **Research spike (required before coding)**: manually inspect the live Business Suite message DOM (via DevTools) for one real thread to find:
   - A stable per-message signal usable as identity (React fiber prop, `data-*` attribute, or the hover/aria-label absolute timestamp string).
   - The actual container/attribute that marks a bubble as outgoing vs incoming (do not assume it's `text-align`/`flex-end` within 5 parent levels — the current code already tried that and it does not match reality).
   - Whether the message list virtualizes (unmounts off-screen messages) or keeps full history mounted, and how scrolling toward older messages is triggered in the UI.
   - Document findings in `specs/010-page-message-capture-integrity/research.md` before Phase 1 starts — if no stable per-message DOM signal exists at all, record that explicitly and choose the least-bad fallback (e.g. positional index + observed insert time) rather than reusing the current content-only hash.

1. **Identity & timestamp (extension)**: rework `processPotentialMessage()` in `src/extension/page_content.js` to extract the signal(s) found in Phase 0 and attach them to the `NEW_PAGE_MESSAGE_FROM_DOM` payload as a real identity field and `timestamp_ms`/`timestamp_source`, instead of sending none.

2. **Backend correlation**: stop routing `page_dom_observer` messages through `ConversationRepository.fingerprint()`'s content-only hash in `src/server/server.js` (~L683) when a real identity is present; use the new field as `stableMessageId`. Keep `ORDER BY timestamp_ms ASC, created_at ASC, id ASC` but ensure `tsMs`/`tsSource` are populated from the extension instead of defaulting to `0`/`'unknown'`.

3. **Direction detection**: replace the fixed 5-parent-level inline-style walk-up in `processPotentialMessage()` with the structural signal found in Phase 0. Re-verify against the mismatch/pending-correlation logic in `server.js` (~L617) that today only runs for `source === 'dom_observer'` — decide whether `page_dom_observer` outgoing messages need the same pending-correlation treatment.

4. **Virtualization coverage**: add a bounded scroll-back routine to `page_content.js` (or a scheduled companion pass) so history outside the current viewport gets mounted and scanned at least once per sync interval, reusing the same identity/dedup logic — no separate dedup path.

5. **Cleanup**: remove the debug DOM-dump block (`dumped` flag, `DUMP:` payload) and the per-message attribute/React-props `console.log` dump in `page_content.js`. Keep only the minimal logging needed for support diagnostics.

6. **Validation**: manual side-by-side comparison of 2-3 real Page threads against Business Suite (order, direction, no missing repeats), then `graphify update .`.

## Safety Gates

- No change to `content.js` (personal-messenger capture) behavior.
- No reintroduction of the Meta Webhook receive path that feature 009 disabled in `PageMessengerAdapter`.
- No migration that deletes or renumbers existing `messages` rows; identity-key changes apply to newly-captured messages only.
- Debug DOM-dump/log removal must not silently swallow real parsing errors — replace with a guarded/minimal log, not silence.
- If Phase 0 finds no reliable per-message DOM signal, do not ship a fallback that still collides on repeated identical text (US1) — this is the one regression that must not persist.
