# Tasks: Page Message Capture Integrity

## Phase 0 — Research spike (blocking, do first)

- [x] T001 Manually inspect a live Business Suite thread in DevTools to find a stable per-message identity signal (React fiber prop, `data-*` attribute, or hover/aria-label timestamp string); document in `specs/010-page-message-capture-integrity/research.md`.
- [x] T002 In the same inspection, determine the real DOM/CSS signal that distinguishes outgoing vs incoming bubbles in Business Suite; document in `research.md`.
- [x] T003 Determine whether the Business Suite message list virtualizes/unmounts off-screen messages and how older history is loaded (scroll trigger, "load more" button, etc.); document in `research.md`.

## Phase 1 — Identity & timestamp (extension)

- [x] T004 Extract the identity signal from T001 in `processPotentialMessage()` in `src/extension/page_content.js`, attach it to the `NEW_PAGE_MESSAGE_FROM_DOM` payload (new field, e.g. `dom_message_key`).
- [x] T005 Extract a real per-message timestamp from the signal found in T001 and attach `timestamp_ms`/`timestamp_source` to the same payload in `src/extension/page_content.js`.
- [x] T006 Replace the content-only dedup hash (`${threadId}_${text}_${isOutgoing}`, line ~131) with a hash that includes the new identity/timestamp field, so repeated identical text no longer collapses in `src/extension/page_content.js`.

## Phase 2 — Backend correlation

- [x] T007 In `src/server/server.js` (`NEW_MESSAGE_RECEIVED` handler, ~L683), prefer the extension's new identity field over `ConversationRepository.fingerprint()` when present for `source === 'page_dom_observer'`.
- [x] T008 Confirm `tsMs`/`tsSource` (server.js ~L610-611) are populated from the extension payload for `page_dom_observer` messages instead of defaulting to `0`/`'unknown'`.
- [x] T009 Add a regression test/fixture reproducing "same text twice in one thread" and assert two distinct rows are persisted, in `tests/integration/` (mirror the style of `tests/integration/outboundPipeline.test.js` if present).

## Phase 3 — Direction detection

- [x] T010 Replace the fixed 5-parent-level inline-style walk-up in `processPotentialMessage()` with the structural signal from T002, in `src/extension/page_content.js`.
- [x] T011 Re-check the outgoing-mismatch/pending-correlation branch in `src/server.js` (~L617, currently gated on `source === 'dom_observer'`) and decide/implement whether `page_dom_observer` needs the same treatment now that its `is_outgoing` is trustworthy.

## Phase 4 — Virtualization coverage

- [x] T012 In `src/extension/page_content.js`, modify the DOM scanner to keep track of a larger history buffer (e.g. up to 100 recent unique IDs) so that when the user scrolls up and unmounts the bottom, the script doesn't re-send the bottom messages when they scroll back down.
- [x] T013 Implement a bounded size for this buffer (e.g., if set size > 1000, clear the oldest) to prevent memory leaks in long-running tabs, in `src/extension/page_content.js`.

## Phase 5 — Cleanup

- [x] T014 Remove the debug DOM-dump block (`dumped` flag / `DUMP:` payload) in `src/extension/page_content.js`.
- [x] T015 Remove or gate-behind-a-flag the per-message attribute/React-props `console.log` dump (`text === 'alo' || text === 'm'` block) in `src/extension/page_content.js`.

## Phase 6 — Validation

- [x] T016 Manually compare 2-3 real Page threads against Business Suite side by side for order, direction, and no missing repeats.
- [x] T017 Run `graphify update .` and confirm the extraction/report reflect the changed files.

## Dependencies

- Phase 0 blocks Phases 1 and 3 (need the real DOM signals before writing extraction code).
- Phase 1 blocks Phase 2 (backend needs the new payload fields to exist).
- Phase 4 depends on Phase 1's dedup key being in place.
- Phase 6 runs last, after all prior phases.
