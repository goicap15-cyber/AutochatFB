# Tasks: Outbound Temp-ID Upgrade Dedup

## Phase 1 — Temp-id-upgrade check

- [x] T001 Inserted in `server.js`'s `NEW_MESSAGE_RECEIVED` handler, between the pending-correlation block and the mismatch-guard block.
- [x] T002 Confirmed — the check is wrapped in `if (m.fb_message_id) { ... }`, skipped entirely when falsy.

## Phase 2 — Validation

- [x] T003 Added `tests/integration/outboundTempIdUpgrade.test.js` (a real committed regression test, not a throwaway script — the SQL is simple enough and the repo's `node:test` + `withDatabase` pattern fit directly) with helper functions mirroring server.js's pending-correlation and temp-id-upgrade SQL exactly. `'outgoing message id-upgrade (temp -> permanent) updates in place, no duplicate row'` — pass.
- [x] T004 Added `'KNOWN LIMITATION: an unrelated identical-content send within the window merges into the wrong row'` in the same file, pinning the US2 trade-off (a message with no pending row of its own can merge into an unrelated recent send of identical content) — pass.
- [x] T005 Ran `npm run test:persistence` — 22/22 pass (20 previous + 2 new) — and `graphify update .`.
- [ ] T006 Manual test: send a message from the CRM to the "Mang Bảo Khánh" Page thread; confirm exactly one row in `messages` for it (query the DB directly, same as the diagnosis in spec.md's Input) and no duplicate bubble in the CRM UI. **(requires live browser test — not run by this pass)**

## Dependencies

- Phase 1 blocks Phase 2.
