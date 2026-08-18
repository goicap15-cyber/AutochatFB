# Tasks: Multi-Account Background Messenger Sync

## Phase 1 — Artifacts and safety

- [X] T001 Create Speckit artifacts for background sync scope.
- [X] T002 Confirm working tree starts from pushed trusted-send checkpoint.

## Phase 2 — Backend scheduler

- [X] T003 Add `InboxSyncScheduler` runtime service with account interval, in-flight tracking, and thread cooldowns.
- [X] T004 Wire scheduler to extension register/close and socket manual sync requests.

## Phase 3 — Changed thread detection

- [X] T005 Compare `SYNC_THREADS_RESULT` items against DB before upsert.
- [X] T006 Enqueue `SYNC_THREAD_MESSAGES` for changed owned threads with reason logs.
- [X] T007 Add `thread_key` to backend thread/message payloads without changing DB primary keys.

## Phase 4 — Extension background tab

- [X] T008 Ensure a usable Messenger/Facebook messages tab exists for sidebar and thread sync.
- [X] T009 Add bounded diagnostic logs for background tab selection and sync failures.

## Phase 5 — UI hardening

- [X] T010 Use `thread_key` for React list keys and message map where available, fallback to `id`.
- [X] T011 Keep account filter/list sort behavior stable.

## Phase 6 — Validation

- [X] T012 Run syntax checks for touched JS files.
- [X] T013 Run persistence tests.
- [X] T014 Run `git diff --check`.
- [X] T015 Run `graphify update .`.

- [X] T016 Add backward-compatible `external_thread_id` migration and resolve colliding Messenger thread ids per account.
