# Tasks: Outbound Pipeline Hardening

## Phase 1 — Contracts and tests first

- [ ] T001 [P] Add state/stage constants and event fixtures in `src/server/services/OutboundMessageService.js` and `tests/fixtures/outbound-pipeline.js`.
- [ ] T002 [P] Add tests for DOM-before-result, result-before-DOM, duplicate ID, and sequential sends in `tests/integration/outboundPipeline.test.js`.
- [ ] T003 Add contract validation for `SEND_MESSAGE_RESULT` in `tests/contract/outboundPipeline.test.js`.

## Phase 2 — Extension

- [ ] T004 Normalize GraphQL empty/non-JSON response diagnostics in `src/extension/background.js`.
- [ ] T005 Poll semantic composer control for a bounded period in `src/extension/background.js`.
- [ ] T006 Click once, verify composer state, then Enter/form-submit once if needed in `src/extension/background.js`.
- [ ] T007 Return stage-specific result and artifact build marker in `src/extension/background.js`.

## Phase 3 — Backend correlation

- [ ] T008 Persist pending before extension dispatch in `src/server/server.js`.
- [ ] T009 Make result/DOM correlation order-independent in `src/server/server.js` and `src/server/repositories/ConversationRepository.js`.
- [ ] T010 Handle existing `fb_message_id` collisions transactionally without throwing in `src/server/server.js`.
- [ ] T011 Add timeout/retryable failure transition without deleting attempts in `src/server/server.js`.

## Phase 4 — UI and artifact

- [ ] T012 [P] Show stage-specific pending/failed diagnostics and retry IDs in `src/client/App.jsx` and `src/client/components/MessageBubble.jsx`.
- [ ] T013 [P] Add build marker and verify `dist/extension` in `scripts/obfuscate-extension.js`.

## Phase 5 — Validation

- [ ] T014 Run all automated tests and the quickstart one-send test.
- [ ] T015 Run ten sequential real-message E2E test and duplicate replay test.
- [ ] T016 Run `graphify update` and review outbound event edges.
