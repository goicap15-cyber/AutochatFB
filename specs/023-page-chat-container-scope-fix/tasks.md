# Tasks: Page Chat Container Scope Fix

## Phase 0 — Research spike (done, see research.md)

- [x] T001 Attempted live DOM capture of the switcher panel's ancestor chain; it unmounts entirely when closed and proved too transient to catch mid-inspection. Instead confirmed the real message container's aria-label ("...tin nhắn, gợi ý và chỉ báo đăng nhập") admits non-message content can share the same region — containment alone is not provably sufficient. Documented in `specs/023-page-chat-container-scope-fix/research.md`.
- [x] T002 Confirmed `findMessageListContainer()` (`src/extension/page_content.js` ~L176) resolves correctly against a real `[data-message-id]`-anchored region for the inspected thread; no counter-example found. Documented in `research.md`.

## Phase 1 — Tighten containment (extension)

- [x] T003 Changed `walkBubbleAncestors()` in `src/extension/page_content.js` (~L400) so `inChatContainer` is a direct `messageListContainer.contains(element)` test against the container `findMessageListContainer()` resolves, instead of an independent upward walk accepting any `role="main"`/`role="grid"` ancestor.
- [x] T004 `scanForMessages()` (~L316) now resolves `findMessageListContainer()` once per tick and threads it into `walkBubbleAncestors()`/`processPotentialMessage()` for both the text-node pass and the per-wrapper media pass (FR-001).
- [x] T004b Extended the content denylist in `forwardResolvedMessage()` (~L516-534) with the observed switcher-panel strings ("tài sản doanh nghiệp", "tài khoản của bạn", "trang quản lý tài sản doanh nghiệp") as an independent second layer, checked regardless of `isInsideMessageBubble` (research spike found the switcher panel's text is itself `dir="auto"`, so gating on that flag like the existing `sysTexts` check would have never caught it).

## Phase 2 — No-container fallback

- [x] T005 `scanForMessages()` (~L343-360) now skips the text-node `TreeWalker` pass entirely for the tick when `findMessageListContainer()` returns null, instead of falling back to unscoped `document.body` scanning (FR-002).

## Phase 3 — Pending-bubble path

- [x] T006 `processPotentialMessage()`'s no-`fb_message_id` branch is unchanged in structure but now receives `inChatContainer` from the tightened `walkBubbleAncestors(element, messageListContainer)` call (~L574), so a `dir="auto"` element outside the real container can never accumulate pending ticks and later be forwarded (FR-003).
- [ ] T007 (deferred) Add a unit/integration test (mirroring `tests/integration/pageMessageDedup.test.js`) simulating an out-of-container switcher-like panel. Not added yet - `page_content.js` runs in a real DOM/content-script context with no existing test harness for it in this repo; would need a jsdom-based harness as a prerequisite. Live verification (T010/T011) covers this in the meantime.

## Phase 4 — Cleanup utility

- [x] T008 Added `scripts/cleanupJunkPageUiMessages.js` (mirroring `scripts/cleanupJunkMessages.js`'s dry-run/`--apply` pattern). Corrected from the original plan during implementation: `messages` has no `source` column (scopes via `JOIN threads ... JOIN inbox_sources WHERE source_type = 'page_messenger'` instead), and junk rows don't reliably have `fb_message_id IS NULL` - they carry a `history_<hash>` fallback fingerprint (`ConversationRepository.fingerprint()`). Detection is content-pattern match OR `fb_message_id LIKE 'history_%'` (verified 11/11 such rows in the live DB were junk, none genuine) - see `research.md` addendum.
- [x] T009 Ran dry-run against the live database for thread `100092115712908`: found exactly the 11 known junk rows, no false positives. Ran `--apply`: backed up to `data/database.db.bak_2026-08-10T04-28-36-908Z`, deleted all 11, refreshed the thread's `last_message`, rebuilt the FTS5 index.

## Phase 5 — Validation

- [ ] T010 **Pending user action**: reload the extension (`chrome://extensions` → reload, or restart Chrome) so the updated `page_content.js` loads, then manually reproduce the original trigger (open the account/page switcher over an open Page thread) and confirm zero new message rows are created.
- [ ] T011 **Pending user action**: re-run the feature-010 side-by-side comparison (2-3 real Page threads vs. Business Suite) after reload to confirm no regression to genuine capture (identity, order, direction).
- [x] T012 Ran `graphify update .` - graph rebuilt (5680 nodes, 6376 edges) reflecting the changed files.

## Dependencies

- Phase 0 blocks Phase 1 (need the confirmed selector/role collision before changing the containment check).
- Phase 1 blocks Phase 2 and Phase 3 (both reuse the resolved-container plumbing from T003/T004).
- Phase 4 is independent of Phases 1-3 and can run in parallel, but T009's `--apply` step should run after Phase 1-3 land, so junk isn't still being created while cleanup runs.
- Phase 5 runs last, after all prior phases.
