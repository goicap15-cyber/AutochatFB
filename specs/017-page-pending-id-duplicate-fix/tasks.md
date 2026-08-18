# Tasks: Page Pending-ID Duplicate Fix

## Phase 1 — Tracking scaffolding

- [x] T001 Add `let currentTick = 0;` incremented at the top of `scanForMessages()` in `src/extension/page_content.js`.
- [x] T002 Add `let pendingNoIdBubbles = new WeakMap();` and `const MAX_PENDING_TICKS = 2;` near the other module-level state (`processedHashes`, `knownMessageTimestamps`).

## Phase 2 — Extract bubble-ancestor helper

- [x] T003 Extracted as `walkBubbleAncestors(element)` (broader than originally named — computes `bubbleAncestor` plus `isInsideMessageBubble`/`inChatContainer` in the same single walk, since the existing structural filter needed those two anyway). Called once per `processPotentialMessage()` invocation; result reused for both the pending-check and the existing filtering block — no duplicate walk.

## Phase 3 — Defer-or-forward logic

- [x] T004 Inserted immediately after `fbMessageId`/`walkBubbleAncestors` in `processPotentialMessage()`.
- [x] T005 Confirmed — dedup-hash, timestamp assignment, direction detection, and payload construction are unchanged, now living in the shared `forwardResolvedMessage()` tail (extracted during feature 018, which landed second and reused this exact logic).

## Phase 4 — Validation

- [x] T006 Standalone Node script (`validate_017_pending_id.js`, scratch — not committed, mirrors feature 014's approach): 4 scenarios (null→real id, null forever past expiry, two independent bubbles, no-bubbleAncestor fallback) — all passed.
- [ ] T007 Manual test: on the "Mang Bảo Khánh" Page thread, send a fresh message from both directions; confirm exactly one row appears in the CRM for each, with no more than ~1-2s added latency before it appears. **(requires live browser test — not run by this pass)**
- [ ] T008 Manual test: confirm older, already-rendered backlog messages are still captured immediately on first scan (no regression to SC-002). **(requires live browser test — not run by this pass)**
- [x] T009 Ran `npm run test:persistence` (18/18 pass, no regression) and `graphify update .`.

## Dependencies

- Phase 1 blocks Phase 2 and 3.
- Phase 2 blocks Phase 3 (T004 needs `findBubbleAncestor`).
- Phase 4 runs last.
