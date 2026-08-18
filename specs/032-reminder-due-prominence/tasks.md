# Tasks: Reminder Due Prominence

**Input**: Design documents from `/specs/032-reminder-due-prominence/`

## Phase 1: Foundational due-state utility

- [x] T001 [US1] Write due detection, Vietnamese urgency-label and stable due-first ordering tests in tests/unit/reminderPresentation.test.js
- [x] T002 [US1] Implement pure reminder presentation helpers in src/client/utils/reminderPresentation.js

## Phase 2: User Story 1 - Spot customers needing follow-up immediately (Priority: P1)

**Goal**: A due reminder is unmistakable on its conversation card while selection/unread states remain legible.

**Independent Test**: A due and a future reminder can be viewed together and only the due card receives urgent treatment.

- [x] T003 [US1] Update due card treatment, bell overlay, accessible wording and urgency text in src/client/components/ConversationItem.jsx
- [x] T004 [US1] Add optional reminder pulse with reduced-motion support in src/client/index.css

## Phase 3: User Story 2 - Reach due follow-ups before routine conversations (Priority: P1)

**Goal**: Due conversations are first inside the current visible result set without changing its membership.

**Independent Test**: Under an active search/filter/tab, due matching conversations move first with stable relative order.

- [x] T005 [US2] Apply stable due-first ordering only after existing visibility checks in src/client/components/ConversationSidebar.jsx

## Phase 4: User Story 3 - Understand how urgent a reminder is (Priority: P2)

**Goal**: Operators can distinguish newly due from overdue reminders with accessible Vietnamese text.

**Independent Test**: Utility tests cover due-now, minutes and hours overdue labels plus invalid dates.

- [x] T006 [US3] Verify urgency-label boundaries and invalid reminder handling in tests/unit/reminderPresentation.test.js

## Phase 5: Validation

- [x] T007 Run npm run test:persistence and npm run build:ui
- [ ] T008 Run manual scenarios in specs/032-reminder-due-prominence/quickstart.md
