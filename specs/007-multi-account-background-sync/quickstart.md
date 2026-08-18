# Quickstart: Multi-Account Background Messenger Sync

## Prerequisites

- Backend running with `npm start`.
- Two Facebook accounts connected and extension WebSocket registered.
- Current trusted-send fix loaded in Chrome extension.

## Manual Validation

1. Start backend and wait for both accounts to register.
2. Do not manually open or reload Messenger threads.
3. Send a message from account A to account B.
4. Watch backend logs for:
   - `INBOX_SYNC_TICK`
   - `INBOX_SYNC_THREADS_DISPATCHED`
   - `INBOX_SYNC_THREAD_CHANGED`
   - `INBOX_SYNC_MESSAGES_DISPATCHED`
   - `THREAD_MESSAGES_SYNCED`
5. Confirm B's CRM list preview updates and moves upward.
6. Open B's CRM chat and verify the new incoming message appears.
7. Send B → A and repeat the check.

## Regression Validation

- Send 5 CRM messages from one account and confirm no duplicate composer text.
- Reload CRM and confirm existing threads/messages still load.
- Restart backend and confirm scheduler resumes after account registration.
