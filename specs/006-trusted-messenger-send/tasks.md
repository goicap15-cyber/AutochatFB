# Tasks: Trusted Messenger Send Replacement

## Phase 1 — Contracts and tests

- [ ] T001 [P] Define feature flag, states, stages, and error codes in `src/server/services/OutboundMessageService.js`.
- [ ] T002 [P] Add adapter contract fixtures in `tests/fixtures/trusted-send.js`.
- [ ] T003 Add tests for click success, click timeout, CDP fallback, event ordering, duplicate ID, and rollback in `tests/integration/trustedSend.test.js`.

## Phase 2 — Extension browser adapter

- [ ] T004 Add `debugger` permission and explicit adapter version marker in `src/extension/manifest.json`.
- [ ] T005 Replace one-shot composer query with bounded semantic polling in `src/extension/background.js`.
- [ ] T006 Implement one DOM click and confirmation probe in `src/extension/background.js`.
- [ ] T007 Implement CDP `Input.dispatchKeyEvent` Enter fallback with attach/detach cleanup in `src/extension/background.js`.
- [ ] T008 Remove synthetic-key success assumptions and return stage-specific diagnostics in `src/extension/background.js`.

## Phase 3 — Backend and UI

- [ ] T009 Preserve pending until confirmation/timeout and correlate either event order in `src/server/server.js`.
- [ ] T010 Make duplicate `fb_message_id` handling transactional and idempotent in `src/server/repositories/ConversationRepository.js`.
- [ ] T011 Add bounded timeout and rollback-safe feature flag handling in `src/server/server.js`.
- [ ] T012 [P] Render stage/error and retry state in `src/client/App.jsx` and `src/client/components/MessageBubble.jsx`.

## Phase 4 — Build and validation

- [ ] T013 Build `dist/extension` and verify manifest/adapter marker in `scripts/obfuscate-extension.js`.
- [ ] T014 Run all automated tests and ten-message real E2E test.
- [ ] T015 Test rollback with the old path disabled/enabled without data mutation.
- [ ] T016 Run `graphify update` and review the replacement event graph.
