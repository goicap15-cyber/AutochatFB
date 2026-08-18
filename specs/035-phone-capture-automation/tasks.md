# Tasks: Phone Capture Automation

**Input**: Design documents from `specs/035-phone-capture-automation/`

## Phase 1: Setup and foundations

- [X] T001 [P] Write exact-prefix normalization, `+84` conversion and candidate-boundary cases in tests/unit/vietnamPhone.test.js
- [X] T002 Implement versioned Vietnamese mobile prefix configuration and pure parser helpers in src/server/utils/vietnamPhone.js
- [X] T003 Add migration-safe provenance, phone-capture history and campaign-action tables/indexes in src/server/database/schema.sql and src/server/database/db.js
- [X] T004 [P] Add source-time, replay-idempotency and legacy-value-protection tests in tests/integration/phoneCapturePersistence.test.js

## Phase 2: User Story 1 - Capture valid incoming numbers (Priority: P1) MVP

**Goal**: Recognize valid incoming mobile values, normalize them and retain source evidence.

**Independent Test**: Ingest valid/invalid incoming messages and inspect contact payload/database for exactly expected captures.

- [X] T005 [US1] Create capture/provenance insert and retrieval operations keyed by source message in src/server/repositories/ContactPhoneCaptureRepository.js
- [X] T006 [US1] Create the idempotent incoming-message capture transaction and live-event payload in src/server/services/PhoneCaptureService.js
- [X] T007 [US1] Refactor structured phone extraction while preserving email extraction compatibility in src/server/utils/leadExtractor.js
- [X] T008 [US1] Replace the inline auto-lead branch with PhoneCaptureService after first-time confirmed incoming persistence in src/server/server.js
- [X] T009 [US1] Include selected phone provenance and candidate summaries in thread/contact responses in src/server/server.js

## Phase 3: User Story 2 - Preserve and review contact data (Priority: P1)

**Goal**: Protect current manual/legacy values and let staff deliberately choose dated candidates.

**Independent Test**: Save a manual value, ingest a different valid value, then accept it and verify capture history survives.

- [X] T010 [P] [US2] Add candidate-selection, manual/legacy protection and duplicate-candidate tests in tests/unit/contactPhoneSelection.test.js
- [X] T011 [US2] Extend ContactService/contact route for explicit selected-capture provenance without breaking manual updates in src/server/services/ContactService.js and src/server/server.js
- [X] T012 [US2] Render current number provenance, acquisition time, candidates and intentional accept action in src/client/components/LeadDetailsPanel.jsx
- [X] T013 [US2] Reconcile PHONE_CAPTURED/contact updates without stale replacement in src/client/App.jsx

## Phase 4: User Story 3 - Campaign response policy (Priority: P2)

**Goal**: Let a campaign opt in to safely stop or send one confirmed thank-you after capture.

**Independent Test**: For each policy, ingest one number before the next message and verify default no-op, safe stop or exactly-once thank-you.

- [X] T014 [P] [US3] Add default, replay and race-policy coverage in tests/unit/campaignPhoneCapturePolicy.test.js and tests/integration/campaignPhoneCaptureFlow.test.js
- [X] T015 [US3] Persist/validate campaign policy fields and unique action records in src/server/repositories/CampaignRepository.js
- [X] T016 [US3] Implement idempotent stop, thank and status application/audit outcomes in src/server/services/CampaignPhoneCaptureService.js
- [X] T017 [US3] Make CampaignRunner honour capture-stop only before next undispatched work in src/server/services/CampaignRunner.js
- [X] T018 [US3] Invoke campaign reaction only after durable capture in src/server/services/PhoneCaptureService.js
- [X] T019 [US3] Add policy, thank-you and existing-status controls in src/client/components/CampaignCreateModal.jsx and src/client/components/CampaignComposer.jsx
- [X] T020 [US3] Render capture-policy outcomes in src/client/components/CampaignDetail.jsx

## Phase 5: Validation

- [X] T021 Update final contracts/quickstart naming in specs/035-phone-capture-automation/contracts/phone-capture.md and specs/035-phone-capture-automation/quickstart.md
- [X] T022 Run focused tests, npm run test:persistence and npm run build:ui; record actual results in specs/035-phone-capture-automation/tasks.md
- [ ] T023 Manually run all quickstart scenarios and tick only verified tasks in specs/035-phone-capture-automation/tasks.md

## Validation results (2026-08-14)

- Focused Spec 035 suites: **49/49 passed** (Vietnam phone parser, selection/provenance, policy, persistence and thank-then-stop flow).
- Full persistence suite: **247/247 passed** via `npm run test:persistence`.
- UI production build: **passed** via `npm run build:ui` (Vite).
- T023 remains intentionally open: it requires a human-operated CRM/Facebook quickstart pass.

## Dependencies & MVP

- T001–T004 establish parsing/schema foundations.
- T005–T009 deliver independently useful capture MVP.
- T010–T013 depend on stored capture evidence, not campaign policy.
- T014–T020 depend on capture idempotency.
- **MVP**: T001–T009 — exact capture, normalization, source date/message evidence and replay-safe storage.
