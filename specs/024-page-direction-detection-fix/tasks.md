# Tasks: Page Direction Detection Fix

## Phase 0 - Research and baseline

- [x] T001 Documented the full mounted geometry for thread 100092115712908 in research.md.
- [x] T002 Reproduced the narrow outgoing-only window and the exact six-message misclassification pattern.
- [x] T003 Confirmed Business Suite virtualization as the source of the one-sided mounted window.
- [x] T004 Confirmed the independent null-midpoint fallback bug: isMessageOutgoing currently returns false when the midpoint is unavailable.
- [x] T005 Read-only baseline recorded: the current DB had five of six known rows at is_outgoing=0 with no direction_status column; the old manual backup was not assumed current.

## Phase 1 - Direction evidence

- [x] T006 Extract a pure container-edge direction helper with true, false, and unknown results.
- [x] T007 Use container-relative edge distance as the primary signal; missing container geometry fails closed to unknown rather than using a midpoint fallback.
- [x] T008 Ensure missing or ambiguous geometry returns unknown and never false.
- [x] T009 Keep unknown messages eligible for later evaluation; do not permanently mark them processed before confirmation.
- [x] T010 Add structured direction diagnostics containing source and confidence.

## Phase 2 - Pending transport, schema, and persistence

- [x] T011 Add direction_status TEXT NOT NULL DEFAULT 'confirmed' with allowed values confirmed and pending to schema.sql.
- [x] T012 Add a safe startup migration in db.js for existing databases; migration must not change existing is_outgoing values.
- [x] T013 Verified background.js forwards optional direction_source/direction_confidence fields and server.js validates them.
- [x] T014 Persist unknown Page messages as one pending row with is_outgoing=0 only as a documented storage placeholder.
- [x] T015 Promote pending rows on high-confidence evidence by fb_message_id without duplicates.
- [x] T016 Preserve two-observation hysteresis for high-confidence disagreements with confirmed rows; unknown/low-confidence reads must not create or commit flips.

## Phase 3 - UI and automated regression

- [x] T017 Update ChatArea to use direction_status before is_outgoing; pending rows render neutrally rather than as incoming.
- [x] T018 Add pure helper tests for outgoing-only, incoming-only, mixed, missing-container, overlapping-window, and ambiguous geometry.
- [x] T019 Add persistence tests for pending insert, pending promotion, repeated pending scans, confirmed-row hysteresis, and duplicate prevention.
- [x] T020 Added idempotent migration-helper coverage proving legacy rows default to confirmed without changing is_outgoing.
- [x] T021 Run npm run test:persistence, npm run build:ui, and node --check for changed files.

## Phase 4 - Historical verification and targeted repair

- [x] T022 Read-only inspect the six known ids and compare current rows with Business Suite.
- [x] T023 New backup created before repair: data/database.db.backup-1786356366647.
- [x] T024 Produce a dry-run repair report keyed by fb_message_id.
- [x] T025 Apply only verified direction corrections; leave unrelated Page rows unchanged.
- [x] T026 Confirmed the old manual backup remains preserved; current DB differed in five rows and was repaired from verified live ground truth.

## Phase 5 - Live validation

- [ ] T027 Reload the extension and verify all six known messages classify as outgoing in the narrow-window case.
- [ ] T028 Force or observe an unknown geometry case and verify the message is retained pending, not rendered incoming, then promoted after high-confidence evidence.
- [ ] T029 Run the target thread for 10+ minutes and reload server/extension once; verify no direction regression.
- [ ] T030 Compare at least two other Page threads against Business Suite for direction, order, and repeated text.
- [ ] T031 Verify personal Messenger capture and Page outbound queue behavior are unchanged.
- [ ] T032 Run final validation and record results in the feature artifacts.

## Dependencies

- Phase 0 baseline precedes implementation.
- T006-T010 precede schema/persistence work.
- T011-T016 precede UI and migration tests.
- T022-T026 require the implementation and live ground truth.
- Phase 5 runs after automated checks pass.
