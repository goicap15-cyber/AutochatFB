# Tasks: Reliable CRM-to-Messenger Outbound Messaging

**Input**: Design documents from `/specs/004-reliable-outbound-messaging/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/outbound-events.md, quickstart.md

## Phase 1: Setup

- [ ] T001 Add outbound test scripts and fixtures in `package.json` and `tests/fixtures/outbound-events.js`.
- [ ] T002 [P] Add the outbound event contract test scaffold in `tests/contract/outboundEvents.test.js`.

## Phase 2: Foundational

- [ ] T003 Define normalized outbound statuses, error codes, and safe diagnostic helpers in `src/server/services/OutboundMessageService.js`.
- [ ] T004 [P] Add repository helpers for correlation and idempotent state updates in `src/server/repositories/ConversationRepository.js`.
- [ ] T005 Add structured outbound lifecycle logging with token/content redaction in `src/server/server.js` and `src/extension/background.js`.
- [ ] T006 [P] Add schema/migration design only if existing `messages` fields cannot represent status/error metadata in `src/server/database/db.js` and `src/server/database/schema.sql`.

## Phase 3: User Story 1 — Real Messenger delivery (P1) 🎯 MVP

**Goal**: A valid CRM send reaches Facebook and is marked sent only after an official message ID.

**Independent Test**: Send a unique text through CRM and verify one recipient-visible Messenger message plus an official ID.

- [ ] T007 [P] [US1] Add failing relay contract tests for `SEND_MESSAGE` validation in `tests/contract/outboundEvents.test.js`.
- [ ] T008 [P] [US1] Add integration coverage for CRM → server → extension result correlation in `tests/integration/outboundMessaging.test.js`.
- [ ] T009 [US1] Validate thread/account ownership and extension readiness before dispatch in `src/server/server.js`.
- [ ] T010 [US1] Persist one pending attempt and correlate it by `client_message_id` in `src/server/server.js` and `src/server/repositories/ConversationRepository.js`.
- [ ] T011 [US1] Normalize Facebook GraphQL response and fail closed unless an official `message_id` exists in `src/extension/background.js`.
- [ ] T012 [US1] Confirm the extension uses the registered account's active Facebook tab/session and return categorized errors in `src/extension/background.js`.
- [ ] T013 [US1] Update the pending row to sent and emit one confirmation event in `src/server/server.js`.

## Phase 4: User Story 2 — Truthful states (P2)

**Goal**: Operators see pending, sent, or failed accurately and can understand/retry failures.

**Independent Test**: Simulate delayed, successful, rejected, and disconnected responses and inspect UI state after reload.

- [ ] T014 [P] [US2] Add unit tests for pending/sent/failed transitions and safe error mapping in `tests/unit/outboundMessage.test.js`.
- [ ] T015 [P] [US2] Add integration tests for timeout, missing token, invalid thread, and extension disconnect in `tests/integration/outboundMessaging.test.js`.
- [ ] T016 [US2] Replace optimistic sent rendering with explicit outbound status rendering in `src/client/components/MessageBubble.jsx` and `src/client/components/MessageComposer.jsx`.
- [ ] T017 [US2] Handle `MESSAGE_SEND_CONFIRMED` and `MESSAGE_SEND_FAILED` without replacing unrelated history in `src/client/App.jsx`.
- [ ] T018 [US2] Persist and restore status/error metadata across reload in `src/server/repositories/ConversationRepository.js` and `src/client/App.jsx`.

## Phase 5: User Story 3 — Retry and deduplication (P3)

**Goal**: Retries are explicit and duplicate result/DOM events never create duplicate bubbles.

**Independent Test**: Replay acknowledgements and DOM events, then retry a failed message and verify one row per attempt.

- [ ] T019 [P] [US3] Add duplicate result and DOM-event tests in `tests/integration/outboundMessaging.test.js`.
- [ ] T020 [US3] Make official-ID/client-ID result processing idempotent in `src/server/repositories/ConversationRepository.js` and `src/server/server.js`.
- [ ] T021 [US3] Add explicit retry action that generates a new client attempt without auto-resending pending rows in `src/client/components/MessageBubble.jsx` and `src/client/App.jsx`.
- [ ] T022 [US3] Reconcile Facebook DOM confirmation with pending attempts without inserting duplicates in `src/extension/content.js` and `src/server/server.js`.

## Phase 6: Polish and validation

- [ ] T023 [P] Add bounded outbound diagnostics and redact sensitive fields in `src/server/server.js` and `src/extension/background.js`.
- [ ] T024 Run `npm run test:persistence` and outbound contract/integration tests; document results in `specs/004-reliable-outbound-messaging/quickstart.md`.
- [ ] T025 Execute the real Facebook manual E2E checklist and record observed response/error codes in `specs/004-reliable-outbound-messaging/quickstart.md`.
- [ ] T026 Run `graphify update` after implementation and review the generated graph for outbound event edges.

## Dependencies and execution order

`T001–T006` → `T007–T013` → `T014–T018` → `T019–T022` → `T023–T026`.

Parallel opportunities: T002/T004/T006; T007/T008; T014/T015; T019; T023. The MVP is Phase 3 (T007–T013).
