# Tasks: Hover Navigation Sidebar

**Input**: Design documents from specs/034-hover-navigation-sidebar/

## Phase 1: Interaction foundation

- [X] T001 [P] Write delayed collapse, re-entry cancellation, focus retention and compact fallback tests in tests/unit/appSidebarPresentation.test.js
- [X] T002 Implement pure hover/focus presentation helpers in src/client/utils/appSidebarPresentation.js

## Phase 2: User Story 1 - Expand navigation on hover (Priority: P1) MVP

**Goal**: Reveal full, recognizable navigation without moving the conversation or chat layout.

**Independent Test**: Hover inside the left rail, observe labels/active state; leave and observe compact rail after a short delay while the main CRM layout remains fixed.

- [X] T003 [US1] Refactor compact shell, expanded overlay and close-timer lifecycle in src/client/components/AppSidebar.jsx
- [X] T004 [US1] Preserve all existing navigation, modal, theme, checkpoint and lead-collapse actions while rendering their expanded labels in src/client/components/AppSidebar.jsx
- [X] T005 [US1] Add overlay geometry, label reveal, active/checkpoint visual treatment and layer rules in src/client/index.css
- [X] T006 [US1] Verify AppSidebar overlay does not create grid-column reflow in src/client/index.css and src/client/App.jsx

## Phase 3: User Story 2 - Keyboard, touch and motion safety (Priority: P2)

**Goal**: Keep the expanded experience accessible without degrading compact/touch behavior.

**Independent Test**: Tab into/out of the sidebar, test a no-hover narrow viewport, then enable reduced motion and verify all controls remain operable.

- [X] T007 [US2] Add focus-within open/close behavior, accessible names and compact-only tooltip behavior in src/client/components/AppSidebar.jsx
- [X] T008 [US2] Add hover-capability, narrow-layout and prefers-reduced-motion fallbacks in src/client/index.css

## Phase 4: Validation

- [X] T009 Run npm run test:persistence and npm run build:ui
- [ ] T010 Manually validate all scenarios in specs/034-hover-navigation-sidebar/quickstart.md and mark results accurately

## Dependencies & Execution Order

- T001 must precede T002.
- T002 is the interaction foundation for T003 and T007.
- T003–T006 deliver the P1 MVP in order; T005 and T006 may be finalized together after the component structure exists.
- T007–T008 depend on the P1 overlay and do not alter navigation actions.
- T009 follows implementation; T010 remains manual until verified in the running CRM.

## MVP Scope

Complete T001–T006: desktop hover overlay, labels and current actions with no layout shift. Keyboard/touch/motion hardening follows immediately in T007–T008.
