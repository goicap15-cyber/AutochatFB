# Tasks: Direction Flip Hysteresis

## Phase 1 — Tracking state

- [x] T001 Added `let directionFlipCandidates = new Map();` at module scope in `ConversationRepository.js` (top of file, alongside `getDefaultDb`) — not inside the class body/`reconcileExistingMessage`, since class bodies can't hold plain `const`/`function` statements (caught by `node --check` during implementation).
- [x] T002 Added `static _resetDirectionFlipTracking()` clearing the map, for test isolation.

## Phase 2 — Hysteresis logic

- [x] T003 Implemented as a standalone module-level `shouldCommitDirectionFlip(stableMessageId, existingIsOutgoing, proposedIsOutgoing)` function (same file), called from `shouldUpdateDirection`'s computation. Covers FR-001–FR-003 directly; FR-004 turned out to be unreachable in practice for a boolean field (see T007 note).
- [x] T004 Confirmed — the UPDATE statement and return shape are unchanged.

## Phase 3 — Tests

- [x] T005 Updated to a three-call sequence in `tests/integration/pageMessageDedup.test.js`: disagree (no-op) → same disagreement again (commits) → same value again (no-op, already agrees).
- [x] T006 Added `'an agreeing reading clears a pending direction-flip candidate'`: disagree → agree (clears) → same original disagreement again → does NOT flip (treated as a fresh first disagreement).
- [x] T007 Added `'a differing second disagreement resets the candidate instead of committing'` — reframed during implementation: since `is_outgoing` is boolean, a genuinely *different* second disagreement value can't occur (only two states exist, and disagreeing always proposes the single complement of the stored value); the test instead pins the boundary that exactly two matching disagreements (not one, not the agree-reset case from T006) is what commits, starting from a clean candidate map.
- [x] T008 Each new/updated test calls `ConversationRepository._resetDirectionFlipTracking()` at the top (simpler than a file-wide `beforeEach` given only these tests touch the map).

## Phase 4 — Validation

- [x] T009 Ran `npm run test:persistence` — 20/20 pass (17 previous + 3 new/updated) — and `graphify update .`.
- [ ] T010 Manual test: restart `npm start` while the "Mang Bảo Khánh" Page thread has existing messages; confirm no `🔁 Sửa lại is_outgoing` log fires on the very first backlog rescan after restart. **(requires live browser test — not run by this pass)**

## Dependencies

- Phase 1 blocks Phase 2.
- Phase 2 blocks Phase 3 (tests assert the new behavior).
- Phase 4 runs last.
