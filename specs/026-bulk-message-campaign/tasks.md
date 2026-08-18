# Tasks: Bulk Message Campaigns

**Input**: Design documents from `/specs/026-bulk-message-campaign/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/campaign-api.md`, `quickstart.md`

**Tests**: Included because campaign ordering, idempotency, pause/resume, recovery, and attachment validation are high-risk stateful behavior.

## Phase 1: Setup

- [X] T001 [P] Add campaign route/event names and shared validation constants in `src/server/services/CampaignService.js` and `src/server/server.js`.
- [X] T002 [P] Add campaign-focused test helpers and disposable database fixtures in `tests/integration/campaignTestUtils.js`.
- [X] T003 [P] Document the campaign feature flag and test-source configuration in `specs/026-bulk-message-campaign/quickstart.md`.

## Phase 2: Foundational

- [X] T004 Add campaign, campaign recipient, campaign message, campaign attachment, attempt, and audit tables plus indexes in `src/server/database/schema.sql` and the project database migration path.
- [X] T005 Add repository methods for atomic campaign state transitions and idempotent recipient/attempt writes in `src/server/repositories/CampaignRepository.js`.
- [X] T006 Add source/account eligibility and capability checks without fallback routing in `src/server/services/CampaignEligibilityService.js`.
- [X] T007 Add campaign runner lifecycle primitives, single-runner locking, pacing, retry limits, and restart recovery in `src/server/services/CampaignRunner.js`.
- [X] T008 [P] Add campaign API error codes and request validation in `src/server/server.js` or the existing route module.
- [X] T009 [P] Add Socket.IO campaign event payload helpers in `src/server/services/CampaignEventService.js`.

## Phase 3: User Story 1 - Create and review a recipient campaign (Priority: P1) 🎯 MVP

**Goal**: Create an immutable campaign recipient snapshot from the selected inbox conversations and show eligibility before sending.

**Independent Test**: Selecting five conversations creates exactly five snapshot rows with stable source/account routing and eligibility reasons.

- [X] T010 [US1] Add `POST /api/campaigns` snapshot creation in `src/server/server.js` using `CampaignRepository` and `CampaignEligibilityService`.
- [X] T011 [P] [US1] Add campaign list/detail endpoints in `src/server/server.js` returning recipient counts and eligibility details.
- [X] T012 [P] [US1] Build the campaign creation modal and selected-conversation handoff in `src/client/components/CampaignCreateModal.jsx` and `src/client/components/ConversationSidebar.jsx`.
- [X] T013 [US1] Build the campaign draft/detail route in `src/client/components/CampaignDetail.jsx` with recipient snapshot and eligibility display.
- [X] T014 [US1] Add integration tests for snapshot immutability, invalid routes, deleted threads, and mixed source/account recipients in `tests/integration/campaignSnapshot.test.js`.
- [X] T015 [US1] Add Socket.IO refresh handling for campaign detail state in `src/client/App.jsx` and `src/client/components/CampaignDetail.jsx`.

## Phase 4: User Story 2 - Compose text and send in chosen order (Priority: P1)

**Goal**: Preview and execute a text campaign in ascending or descending order with pause, resume, cancel, retry, and idempotent dispatch.

**Independent Test**: A five-recipient test campaign configured as `5 → 1` dispatches exactly in that order and survives a pause/resume cycle without duplicate attempts.

- [X] T016 [P] [US2] Add campaign message/order validation and exact execution-order preview in `src/server/services/CampaignService.js` and `src/server/repositories/CampaignRepository.js`.
- [X] T017 [US2] Add start/pause/resume/cancel/retry lifecycle endpoints in `src/server/server.js` with atomic transition checks.
- [X] T018 [US2] Extend the low-level queue contract in `src/server/repositories/MessageQueueRepository.js` and `src/server/services/QueueWorker.js` with campaign and attempt idempotency metadata while preserving one-to-one sends.
- [X] T019 [US2] Route campaign text jobs through the recorded Page/source adapter in `src/server/server.js` and `src/extension/background.js` without account/source fallback.
- [X] T020 [US2] Add persisted runner recovery and in-flight uncertainty handling in `src/server/services/CampaignRunner.js`.
- [X] T021 [P] [US2] Build message composer, start-position/direction controls, exact preview, and lifecycle controls in `src/client/components/CampaignComposer.jsx` and `src/client/components/CampaignDetail.jsx`.
- [X] T022 [P] [US2] Add campaign status badges, counters, per-recipient result rows, pause/resume/cancel/retry actions in `src/client/components/CampaignRecipientTable.jsx`.
- [X] T023 [US2] Add integration tests for `50 → 1` ordering, one active attempt per recipient, pause/resume, cancel, explicit retry, send failure, and restart recovery in `tests/integration/campaignExecution.test.js`.
- [X] T024 [US2] Add UI/API contract tests for lifecycle conflicts and duplicate actions in `tests/integration/campaignLifecycleContract.test.js`.

## Phase 5: User Story 3 - Send attachments (Priority: P2)

**Goal**: Validate, persist, preview, and dispatch supported attachments without changing recipient order.

**Independent Test**: A valid image is attached once and included in one test send; invalid type/size/unavailable files are rejected before start.

- [X] T025 [P] [US3] Add attachment upload, checksum, storage, and validation service in `src/server/services/CampaignAttachmentService.js`.
- [X] T026 [US3] Add multipart attachment endpoint and cleanup behavior in `src/server/server.js`.
- [X] T027 [US3] Extend campaign message and low-level queue payloads with attachment references in `src/server/repositories/MessageQueueRepository.js` and `src/server/services/QueueWorker.js`.
- [X] T028 [US3] Implement Page adapter capability checks and supported image dispatch in `src/server/services/PageMessengerAdapter.js` and `src/extension/background.js`.
- [X] T029 [P] [US3] Build attachment picker, preview, validation messages, and remove/retry UI in `src/client/components/CampaignComposer.jsx`.
- [X] T030 [US3] Add attachment validation and dispatch tests in `tests/integration/campaignAttachments.test.js`.
- [X] T031 [US3] Document supported media types, limits, and known source limitations in `specs/026-bulk-message-campaign/quickstart.md`.

## Phase 6: User Story 4 - Monitor and audit execution (Priority: P2)

**Goal**: Provide reliable aggregate progress, recipient outcomes, audit history, and restart-safe monitoring.

**Independent Test**: A mixed-outcome campaign shows consistent counters and immutable audit events for every lifecycle and delivery action.

- [X] T032 [P] [US4] Add audit event persistence and query methods in `src/server/repositories/CampaignRepository.js`.
- [X] T033 [US4] Emit campaign and recipient state changes from `src/server/services/CampaignRunner.js` and `src/server/server.js`.
- [X] T034 [P] [US4] Build progress summary, recipient outcome filters, and audit timeline in `src/client/components/CampaignDetail.jsx`.
- [X] T035 [US4] Add reconciliation checks for counters, attempts, and orphaned processing rows in `src/server/services/CampaignRecoveryService.js`.
- [X] T036 [US4] Add mixed-outcome audit/recovery tests in `tests/integration/campaignAuditRecovery.test.js`.

## Phase 7: Polish and validation

- [X] T037 [P] Run `node --check` on all touched JavaScript files and `npm run build:ui`.
- [X] T038 [P] Run `npm run test:persistence` and all campaign integration tests against a disposable database.
- [X] T039 Validate the scenarios in `specs/026-bulk-message-campaign/quickstart.md` with a small authorized test list.
- [X] T040 Review campaign limits, authorization/opt-out handling, source routing, and attachment cleanup before enabling the feature.
- [X] T041 Update the project feature graph with the completed campaign artifacts.

## Dependencies & Execution Order

- Setup (Phase 1) precedes Foundational (Phase 2).
- Foundational work blocks all user stories.
- US1 must complete before US2 because US2 sends only from a stored snapshot.
- US2 must be stable before US3 because attachments reuse the text campaign lifecycle and queue contract.
- US4 may begin after US2, but its final reconciliation depends on the states emitted by US2 and US3.
- The MVP is US1 plus text-only US2. Personal Messenger and video/file dispatch remain disabled until a separate capability review passes.

## Parallel Opportunities

- T002, T003, T008, and T009 can run in parallel after the repository shape is agreed.
- T011, T012, and T013 can run in parallel after T010's API shape is fixed.
- T021 and T022 can run in parallel after the lifecycle contract is fixed.
- T025 and T029 can run in parallel after attachment validation rules are agreed.
- T032 and T034 can run in parallel after event payloads are stable.

## Implementation Strategy

1. Complete foundational persistence, eligibility, and runner locking.
2. Deliver US1 as a draft/preview-only MVP and validate recipient snapshots.
3. Deliver text-only US2, stop, and validate reverse ordering plus pause/resume/recovery.
4. Add supported image attachments in US3; keep unsupported media types blocked.
5. Add monitoring/audit hardening in US4 and run the full quickstart before enabling live campaigns.
