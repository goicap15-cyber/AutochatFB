# Tasks: Campaign Phone Automation

**Input**: Design documents from specs/036-campaign-phone-automation/

## Phase 1: Shared foundations

- [X] T001 [P] Add pure recommended-status/default-policy selection without overwriting user draft input in src/client/utils/campaignPhoneAutomation.js and tests/unit/campaignPhoneAutomationPresentation.test.js
- [X] T002 [P] Add exact Meta Page system-notice classifier and classified-only transient fingerprint logic in src/server/utils/pageSystemNotice.js and tests/unit/pageSystemNotice.test.js

## Phase 2: User Story 1 - Configure visible phone-result automation (Priority: P1)

**Goal**: An operator understands and chooses the number-to-status workflow before a campaign is saved or previewed.

**Independent Test**: With and without a reusable Đã có số status, create/edit/reopen a campaign and verify the visible card, saved policy and summary.

- [X] T003 [US1] Promote the phone-result card above generic advanced settings, apply the reviewed recommendation and preserve explicit user choices in src/client/components/CampaignCreateModal.jsx
- [X] T004 [US1] Render the same editable policy/status/thank-you controls and draft-reset-safe defaults in src/client/components/CampaignComposer.jsx
- [X] T005 [US1] Render a human-readable conversion policy and target-status summary in src/client/components/CampaignDetail.jsx
- [X] T006 [US1] Cover campaign create/edit policy default, recommendation and no-status cases in tests/unit/campaignPhoneAutomationPresentation.test.js

## Phase 3: User Story 2 - See and filter converted leads automatically (Priority: P1)

**Goal**: A valid phone capture in an active configured campaign visibly moves the customer to the target status and makes that result filterable without refresh.

**Independent Test**: Run a multi-recipient configured campaign, ingest a valid customer number, then assert contact detail, sidebar chip and status-filter membership converge from the same live update.

- [X] T007 [P] [US2] Add a campaign phone-capture realtime integration scenario covering applied status, capture-only behaviour and filterable thread summary in tests/integration/campaignPhoneAutomationRealtime.test.js
- [X] T008 [US2] Make post-policy contact emission authoritative for selected phone/provenance and status id/name/color in src/server/server.js and src/server/services/CampaignPhoneCaptureService.js
- [X] T009 [US2] Reconcile complete contact-status patches into active contact and conversation summaries without replacing absent fields in src/client/App.jsx
- [X] T010 [US2] Verify ConversationSidebar.jsx and ConversationFilterPopover.jsx retain/recompute selected-status filter results after a live conversion update

## Phase 4: User Story 3 - Remove repeated Meta system notices (Priority: P2)

**Goal**: Meta UI notices never become duplicated customer messages while genuine id-less customer messages remain intact.

**Independent Test**: Replay the known lead-activity notice many times and assert zero CRM rows; ingest an unclassified id-less customer message and assert normal persistence/capture eligibility.

- [X] T011 [P] [US3] Add observer/system-notice and genuine-id-less-message regression coverage in tests/unit/pageSystemNotice.test.js and tests/integration/campaignPhoneAutomationRealtime.test.js
- [X] T012 [US3] Classify and suppress known Meta system notices at the Page observer boundary in src/extension/page_content.js or src/extension/content.js
- [X] T013 [US3] Apply the same classifier before ordinary incoming persistence and use fingerprint dedupe only for classified notices in src/server/server.js

## Phase 5: Polish and validation

- [X] T014 Update the campaign conversion contract and manual validation scenarios in specs/036-campaign-phone-automation/contracts/campaign-phone-automation.md and specs/036-campaign-phone-automation/quickstart.md
- [X] T015 Run focused tests, npm run test:persistence and npm run build:ui; record real results and keep manual Page validation unchecked until it is observed in specs/036-campaign-phone-automation/tasks.md
- [ ] T016 [manual] In a real connected Facebook Page tab, verify an incoming customer number changes the sidebar status chip and remains as the only visible message while the Meta lead-activity notice produces no CRM row.

## Verification record

- 2026-08-14: focused phone-automation/classifier/realtime tests passed (9/9).
- 2026-08-14: `npm run test:persistence` passed (256/256).
- 2026-08-14: `npm run build:ui` passed (Vite production build).
- Manual Page-observer validation remains intentionally unchecked (T016).

## Dependencies & order

- T001 and T002 can run in parallel.
- T003–T006 depend on T001.
- T007–T010 depend on the existing capture policy and are verified after T003–T006.
- T011–T013 depend on T002 and can proceed independently of the campaign UI.
- T014–T015 follow all completed implementation tasks.

## Parallel opportunities

- T001 and T002 use separate pure modules.
- T007 and T011 add separate test coverage once their respective shared helpers exist.
- T008/T009 and T012 can be reviewed in parallel after their dependencies, but integration verification must run after both branches are merged.

## MVP

Deliver T001–T010 first: visible campaign automation plus a realtime, filterable converted-lead list. T011–T013 then remove inbox noise without changing genuine message handling.
