# Quickstart: Outbound Messaging Validation

## Prerequisites

1. Start backend with `npm start`.
2. Load the current extension and connect the same Facebook account.
3. Open the target Messenger thread and CRM conversation.
4. Keep backend and extension logs visible; do not print tokens or cookies.

## MVP manual test

1. Send a unique text such as `crm-send-check-<timestamp>` from CRM.
2. Verify logs show dispatch, extension receipt, Facebook response classification, and an official `message_id`.
3. Verify the recipient's Messenger shows exactly one copy.
4. Reload CRM and verify the message remains `sent`.

## Failure tests

- Disconnect the extension before sending: CRM must show `failed`, not `sent`.
- Use an invalid/stale session: response must be classified as failure and expose a retryable error.
- Replay the same `SEND_MESSAGE_RESULT` and DOM event: one persisted bubble only.
- Retry a failed message: a new client attempt is created; the old failure remains auditable.

## Automated validation

Run `npm run test:persistence` and the outbound contract/integration tests added by the implementation tasks. Use a real Facebook account only for the final manual end-to-end check.
