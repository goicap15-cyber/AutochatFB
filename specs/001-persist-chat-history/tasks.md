# Tasks: Persist Chat History

**Input**: Design documents from `specs/001-persist-chat-history/`

**Organization**: Tasks are grouped by independently testable user story. Tests are included because persistence, migration, and identity changes require regression coverage.

## Phase 1: Setup

**Purpose**: Add isolated validation infrastructure without touching production data.

- [X] T001 Add `node:test` persistence test scripts to `package.json`
- [X] T002 [P] Create sanitized thread/message fixtures in `tests/fixtures/conversation-sync.js`
- [X] T003 [P] Create temporary SQLite test database helper in `tests/helpers/testDatabase.js`

---

## Phase 2: Foundational

**Purpose**: Establish safe migration and persistence boundaries used by every story.

- [X] T004 Add versioned, backup-first migration runner and row-count/integrity guards in `src/server/database/db.js`
- [X] T005 Add persistence/sync fields, indexes, and FTS insert-update-delete triggers in `src/server/database/schema.sql`
- [X] T006 Create transactional conversation/message access layer in `src/server/repositories/ConversationRepository.js`
- [ ] T007 Create sync checkpoint state machine in `src/server/services/HistorySyncManager.js`

**Checkpoint**: Migrations can be tested on a database copy and all later handlers use one persistence boundary.

---

## Phase 3: User Story 1 — Reload CRM with stored conversations (Priority: P1) 🎯 MVP

**Goal**: Previously discovered conversations and messages remain visible after CRM/Facebook reload and while the extension is offline.

**Independent Test**: Store two conversations, disconnect the extension, reload the client, and verify both conversations and identical message counts load from SQLite.

### Tests

- [X] T008 [P] [US1] Add local-first reload and offline-read integration tests in `tests/integration/conversationPersistence.test.js`
- [X] T009 [P] [US1] Add sidebar partial/empty snapshot preservation tests in `tests/integration/sidebarSyncPersistence.test.js`

### Implementation

- [X] T010 [US1] Route sidebar discovery through non-destructive upsert logic and stop resetting workflow status in `src/server/server.js`
- [X] T011 [US1] Persist newly observed conversations and accepted realtime messages before client emission in `src/server/server.js`
- [X] T012 [US1] Make `/api/threads` and `/api/threads/:id/messages` return persisted state plus sync status in `src/server/server.js`
- [X] T013 [US1] Keep persisted thread/message state during reconnect, empty sync, and sync failure events in `src/client/App.jsx`

**Checkpoint**: Reloading either Facebook or CRM cannot remove the two stored test users or their persisted history.

---

## Phase 4: User Story 2 — Backfill once, then append (Priority: P2)

**Goal**: Capture available history once in resumable batches and use incremental synchronization afterward.

**Independent Test**: Interrupt an initial backfill after one batch, resume it, append two new messages, and run the unchanged sync twice with zero duplicates.

### Tests

- [ ] T014 [P] [US2] Add batch retry, checkpoint resume, and idempotency unit tests in `tests/unit/historySyncManager.test.js`
- [ ] T015 [P] [US2] Add optimistic-send reconciliation and duplicate-source tests in `tests/integration/messagePersistence.test.js`

### Implementation

- [ ] T016 [US2] Emit started/batch/completed/failed history events with deterministic message fingerprints in `src/extension/background.js`
- [ ] T017 [US2] Preserve stable message identity and timestamp provenance in DOM/network extraction in `src/extension/content.js`
- [ ] T018 [US2] Handle history batches transactionally, retain partial progress, and request incremental mode from checkpoints in `src/server/server.js`
- [ ] T019 [US2] Reconcile pending outgoing messages with official Facebook IDs without duplicate rows in `src/server/repositories/ConversationRepository.js`

**Checkpoint**: Initial history survives interruption, and future syncs append only new or missing messages.

---

## Phase 5: User Story 3 — Stable identity across Facebook sources (Priority: P3)

**Goal**: Normal URL, E2EE URL, sidebar, participant, and network identifiers resolve to one account-scoped CRM conversation.

**Independent Test**: Feed all known identifier forms for the same test contact and verify one conversation record; feed an ambiguous mapping and verify it is not auto-merged.

### Tests

- [ ] T020 [P] [US3] Add account-scoped alias, E2EE, conflict, and multi-account collision tests in `tests/unit/conversationIdentityResolver.test.js`
- [ ] T021 [P] [US3] Add existing-data migration preservation test in `tests/integration/conversationIdentityMigration.test.js`

### Implementation

- [ ] T022 [US3] Add stable conversation ownership and alias tables with non-destructive legacy mapping in `src/server/database/schema.sql`
- [ ] T023 [US3] Implement trusted alias resolution and conflict reporting in `src/server/services/ConversationIdentityResolver.js`
- [ ] T024 [US3] Include typed identifier candidates in sidebar/history/realtime payloads in `src/extension/background.js`
- [ ] T025 [US3] Include participant/network identifier candidates without selecting a canonical ID in `src/extension/injected.js`
- [ ] T026 [US3] Resolve identifiers before conversation/message upsert and translate sends to the preferred external thread ID in `src/server/server.js`
- [ ] T027 [US3] Migrate existing contacts/messages to stable conversation ownership and verify pre/post row counts in `src/server/database/db.js`

**Checkpoint**: The two test contacts no longer reappear as new users after reload or E2EE route changes.

---

## Phase 6: Polish & Cross-Cutting Validation

- [ ] T028 [P] Show local, syncing, partial, failed, and offline states without hiding stored content in `src/client/components/ChatHeader.jsx`
- [ ] T029 Add structured discovery/backfill/incremental/identity logs in `src/server/server.js`
- [ ] T030 Run all automated persistence tests and the five scenarios in `specs/001-persist-chat-history/quickstart.md`
- [ ] T031 Validate SQLite integrity, foreign keys, row-count preservation, and zero FTS orphan rows using `data/database.db` backup copies
- [ ] T032 Update architecture documentation in `README.md` and run `graphify update .`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User Story 1 (MVP).
- User Story 2 depends on the repository and sync state from Phase 2, but not on User Story 3.
- User Story 3 depends on the repository abstraction; its migration runs only after preservation tests pass.
- Phase 6 runs after the selected user stories are complete.

## Parallel Opportunities

- T002 and T003 can run in parallel.
- Test tasks marked `[P]` can be written in parallel with other tests in the same story.
- Extension payload work and backend unit-test preparation can run in parallel after contracts are fixed.

## Implementation Strategy

1. Deliver T001–T013 first as the persistence MVP.
2. Validate the two real test contacts across reload/offline cycles.
3. Add resumable history with T014–T019.
4. Add identity normalization with T020–T027.
5. Complete consistency, documentation, and Graphify maintenance with T028–T032.
