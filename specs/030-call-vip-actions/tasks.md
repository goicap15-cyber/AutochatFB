# Tasks: CRM VIP Quick Action

**Input**: Design documents from \`/specs/030-call-vip-actions/\`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/quick-actions-ui.md, quickstart.md

**Tests**: Required by the plan; write focused VIP tests before changing the component and run the existing regression suite afterward.

**Organization**: Tasks are grouped by user story. Gọi, Nhắc and Lưu have no task because they are explicitly deferred.

## Phase 1: Setup

**Purpose**: Confirm the existing tag transaction can be reused without new persistence.

- [x] T001 Inspect and preserve the established tag helpers and contact-save contract in \`src/client/utils/tags.js\` and \`src/client/components/LeadDetailsPanel.jsx\`.

---

## Phase 2: User Story 1 - Đánh dấu khách VIP (Priority: P1) 🎯 MVP

**Goal**: Toggle one logical VIP tag, persist it for the active customer, preserve other tags, roll back failures and ignore stale responses after a customer switch.

**Independent Test**: Start with a customer with non-VIP tags, toggle VIP on then off, reload to verify persistence, and simulate a failed/stale save to verify rollback is limited to the originating customer.

- [x] T002 [US1] Add focused VIP membership, preservation and tag-limit cases in \`tests/unit/leadVipAction.test.js\`.
- [x] T003 [US1] Implement the active-contact/operation guard around tag saves in \`src/client/components/LeadDetailsPanel.jsx\`.
- [x] T004 [US1] Wire the VIP quick-action card to the existing tag toggle transaction in \`src/client/components/LeadDetailsPanel.jsx\`.
- [x] T005 [US1] Surface VIP-save failures near the quick-action area in \`src/client/components/LeadDetailsPanel.jsx\`.

**Checkpoint**: VIP can be toggled and persisted independently; Gọi, Nhắc and Lưu remain unchanged.

---

## Phase 3: User Story 2 - Nhận biết và thao tác an toàn (Priority: P2)

**Goal**: Make VIP clearly selected/unselected and usable by keyboard without relying only on color.

**Independent Test**: Tab to VIP, toggle it with Enter/Space, and verify accessible name/state, visible focus, saving disabled state and selected cue.

- [x] T006 [US2] Add semantic state, keyboard-safe disabling, visible focus and a non-colour selected cue to the VIP button in \`src/client/components/LeadDetailsPanel.jsx\`.
- [x] T007 [US2] Verify desktop panel and narrow drawer use the same VIP behavior through \`src/client/components/LeadDetailsPanel.jsx\`.

---

## Phase 4: Polish & Validation

**Purpose**: Validate the focused feature and its existing CRM integrations.

- [x] T008 Run the VIP-focused unit test in \`tests/unit/leadVipAction.test.js\` and update any expected regression cases.
- [x] T009 Run the full persistence suite with \`npm run test:persistence\`.
- [x] T010 Run the frontend production build with \`npm run build:ui\`.
- [ ] T011 Perform the manual scenarios in \`specs/030-call-vip-actions/quickstart.md\` and record any environment limitation.

## Dependencies & Execution Order

- T001 precedes T002–T007.
- T002 is written before T003–T006.
- T003–T005 complete the P1 behavior; T006–T007 complete accessible polish.
- T008–T011 occur after implementation.

## Implementation Strategy

1. Reuse the existing tag layer rather than adding VIP storage.
2. Deliver and validate the P1 toggle/rollback flow first.
3. Add accessible state and verify both panel variants.
4. Run focused, full-suite and build validation before marking tasks complete.
