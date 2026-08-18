# Tasks: Page Extension Sync

**Feature Branch**: `009-page-extension-sync`
**Feature Spec**: [spec.md](./spec.md)

## Implementation Strategy
- **MVP First**: Start with User Story 1 (Queue System) to establish the basic backend architecture. Then move to the Chrome extension changes.
- **Incremental Delivery**: The queue can be tested without the extension initially (just logging). Then extension DOM reading, then extension sending.

## Phase 1: Setup
- [x] T001 Create SQLite migration to add `message_queue` table in `src/server/database/migrations/`
- [x] T002 Update `manifest.json` in `src/extension/manifest.json` to include `*://business.facebook.com/*` in `host_permissions` and `content_scripts`.

## Phase 2: Foundational (Backend Data Models)
- [x] T003 Create `MessageQueueRepository.js` in `src/server/repositories/MessageQueueRepository.js` for DB operations (insert, pop_pending, update_status).
- [x] T004 Create `QueueWorker.js` in `src/server/services/QueueWorker.js` to poll and dispatch messages via Socket.io.
- [x] T005 Update `server.js` (or `ProcessManager.js`) to initialize and start `QueueWorker` in `src/server/server.js`.

## Phase 3: User Story 1 (Centralized Message Queue)
- [x] T006 [US1] Comment out Meta Webhook API send code in `src/server/services/PageMessengerAdapter.js`.
- [x] T007 [US1] Update `PageMessengerAdapter.sendMessage()` to insert into `message_queue` instead of calling `fetch()` in `src/server/services/PageMessengerAdapter.js`.
- [x] T008 [US1] Add Socket.io listener in `src/extension/background.js` to receive `SEND_QUEUED_MESSAGE` from backend.
- [x] T009 [US1] Add Socket.io emitter in `src/extension/background.js` to send `QUEUED_MESSAGE_RESULT` back to backend.
- [x] T010 [US1] Implement delay function (`Math.random() * 3000 + 2000`) inside `QueueWorker.js` loop in `src/server/services/QueueWorker.js`.

## Phase 4: User Story 2 (Receive Realtime Page Messages)
- [x] T011 [US2] Create `src/extension/page_content.js` to observe DOM mutations in Business Suite Inbox.
- [x] T012 [US2] Implement DOM parsing logic in `page_content.js` to extract `thread_id` (PSID), `content`, `is_outgoing`.
- [x] T013 [US2] Add logic to send `NEW_PAGE_MESSAGE_FROM_DOM` to `background.js` in `src/extension/page_content.js`.
- [x] T014 [US2] Update `background.js` to listen for `NEW_PAGE_MESSAGE_FROM_DOM` and forward to backend (`NEW_MESSAGE_RECEIVED` with `source_type=page_messenger`).
- [x] T015 [US2] Update `src/server/server.js` (around `NEW_MESSAGE_RECEIVED` handler) to map `page_messenger` events correctly to the page account.

## Phase 5: User Story 3 (Auto Tab Open & Send Beyond 24h)
- [x] T015 [US3] Implement routing logic to find existing background tabs for a specific Page ID in `src/extension/background.js`.
- [x] T016 [US3] Add `chrome.tabs.create` logic to automatically open a pinned background tab for `business.facebook.com/latest/inbox` if no tab exists for that Page in `src/extension/background.js`.
- [x] T017 [US3] Ensure the newly opened tab injects `page_content.js` and is ready before sending the message in `src/extension/background.js`.
- [x] T018 [US3] Focus the target tab and execute `dispatchTrustedText` and `dispatchTrustedEnter` on the Page chatbox DOM elements in `src/extension/background.js`.

## Phase 6: Polish
- [x] T019 Update UI to gracefully handle messages that fail to send due to closed tabs or DOM changes in `src/client/components/Chat/MessageList.jsx`.
- [x] T020 Run end-to-end tests blasting 5 messages to ensure queue processes sequentially without cross-tab interference.
