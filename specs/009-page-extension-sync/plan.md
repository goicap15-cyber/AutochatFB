# Implementation Plan: Page Extension Sync

**Feature Branch**: `009-page-extension-sync`
**Feature Spec**: [spec.md](./spec.md)

## 1. Technical Context
- **Problem**: Meta API bans due to 24-hour limits and strict Webhook policies for Pages.
- **Solution**: Shift Page Messaging from Meta Webhook to a Chrome Extension utilizing DOM reading and CDP actions. Implement a Message Queue with simulated human delays to prevent concurrent multi-tab sending and avoid anti-bot detection.
- **Dependencies**: SQLite (for queue), Chrome Extension (V3), Socket.io (for backend-extension communication).

## 2. Constitution Check
- **Compliance**: This architectural shift violates Meta's Terms of Service for scraping/automating, but aligns with the project's goal of "reliable CRM-to-Messenger outbound messaging" and bypassing the 24-hour rule, which is a core business requirement.
- **Security**: Extension requires broad host permissions (`business.facebook.com/*`, `messenger.com/*`) which is already established in `manifest.json`. No external API keys required.

## 3. Phase 0: Research & Discovery
- **Decision**: Use a single SQLite table (`message_queue`) to track all outgoing messages.
- **Rationale**: Keeps the architecture simple. Background worker in `server.js` or `ProcessManager` will pop one message at a time, send it to the extension via Socket.io, wait for an ack, sleep for 2-5s, then proceed to the next.
- **Alternatives**: Managing the queue directly in `background.js` (rejected because it's harder to persist state if the extension reloads).

## 4. Phase 1: Data Model & Contracts
- **Data Model**: [data-model.md](./data-model.md) created. Added `message_queue` table.
- **Contracts**: Extension needs a new socket listener for `SEND_QUEUED_MESSAGE` and an emitter for `QUEUED_MESSAGE_RESULT`.

## 5. Phase 2: Implementation Steps

### Backend
1. Create `MessageQueueRepository.js` to handle insert, pop, and update status for the queue.
2. Modify `PageMessengerAdapter.sendMessage()` to no longer use `fetch` to Graph API, but instead insert the message into `message_queue`. The old webhook and fetch code will be commented out and kept as a fallback.
3. Create a `QueueWorker.js` service that continuously polls `message_queue` for `pending` messages.
4. When picking a message, `QueueWorker` emits a socket event to the extension to process it, waits for the result, updates status to `sent` or `failed`, and then `await delay(Math.random() * 3000 + 2000)` before the next iteration.

### Extension
1. Update `manifest.json` to include `*://business.facebook.com/*` in host permissions and content scripts.
2. Write `page_content.js` to observe DOM mutations in Business Suite Inbox for new incoming messages and emit them back to the background script.
3. Update `background.js` to receive `SEND_QUEUED_MESSAGE`.
4. Implement routing logic in `background.js` to find the correct background tab for the requested Page. If the tab is not open, the extension will automatically open a pinned background tab for `business.facebook.com/latest/inbox` for that specific Page.
5. Focus the tab, and execute `dispatchTrustedText` and `dispatchTrustedEnter`.

## 6. Phase 3: Integration & Testing
- Deploy extension to local browser.
- Open 2 Page tabs and 1 Messenger tab.
- Blast 5 messages from CRM. Verify they send sequentially with delays.
- Verify incoming messages from test account appear instantly via DOM observation.
