# Tasks: Advanced Conversation Filters

## Phase 1: Data and pure filtering foundation

- [X] T001 [US1] Write grouped, quick-filter, manual-rule and sanitization cases in tests/unit/advancedConversationFilters.test.js
- [X] T002 [US1] Implement normalized filter state, validation and matching in src/client/utils/conversationFilters.js
- [X] T003 [US1] Add filterable tags/contact fields to normal and sync thread summaries in src/server/services/AssignmentManager.js and src/server/server.js
- [X] T004 [US1] Add summary query coverage in tests/integration/conversationFilterSummary.test.js

## Phase 2: Practical and quick filters

- [X] T005 [US1] Expand draft/applied controls, groups, active summary and responsive surface in src/client/components/ConversationFilterPopover.jsx
- [X] T006 [US1] Integrate richer options, archive scope and final filter pipeline in src/client/components/ConversationSidebar.jsx
- [X] T007 [US2] Add Cần nhắc, Chưa đọc, VIP and Cần xử lý quick filters in src/client/components/ConversationFilterPopover.jsx

## Phase 3: Manual rules

- [X] T008 [US3] Create accessible field/operator/value rows in src/client/components/ConversationFilterRuleBuilder.jsx
- [X] T009 [US3] Connect manual-rule validation, draft behavior and active summary in src/client/components/ConversationFilterPopover.jsx

## Phase 4: Validation

- [X] T010a Run npm run test:persistence and npm run build:ui
- [ ] T010b Manually validate scenarios in specs/033-advanced-conversation-filters/quickstart.md
