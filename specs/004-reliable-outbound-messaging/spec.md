# Feature Specification: Reliable CRM-to-Messenger Outbound Messaging

**Feature Branch**: `004-reliable-outbound-messaging`
**Created**: 2026-08-03
**Status**: Draft
**Input**: Make messages sent from CRM reach Facebook Messenger recipients and show truthful delivery state.

## User Scenarios & Testing

### User Story 1 - Send a real Messenger message (Priority: P1)

As a CRM operator, I can send text from an open conversation and the recipient receives it in Messenger.

**Why this priority**: Sending is the primary CRM workflow; a locally visible bubble without recipient delivery is misleading.

**Independent Test**: With Facebook and the extension connected, send one unique text from CRM and verify it appears in the recipient Messenger conversation and receives a Facebook message ID.

**Acceptance Scenarios**:
1. Given a valid thread and connected account, when the operator sends text, then Facebook receives exactly one message and the CRM shows it as sent.
2. Given the extension is disconnected, when the operator sends text, then no false sent bubble is shown and the CRM reports a retryable failure.

### User Story 2 - Truthful pending, sent, and failed states (Priority: P2)

As an operator, I can distinguish a message waiting for Facebook confirmation from one actually accepted or rejected.

**Why this priority**: Prevents duplicate retries and false confidence.

**Independent Test**: Simulate delayed, successful, and failed Facebook responses and verify each state transition and visible error.

**Acceptance Scenarios**:
1. Given Facebook has not acknowledged a message, when the CRM renders it, then it is marked pending.
2. Given Facebook returns an official message ID, when the CRM receives the result, then pending becomes sent and keeps one bubble.
3. Given Facebook rejects the request, when the result arrives, then the message becomes failed with a retry action.

### User Story 3 - Safe retry and deduplication (Priority: P3)

As an operator, I can retry a failed message without creating duplicate messages when acknowledgements or DOM events arrive more than once.

**Why this priority**: Facebook and the extension can deliver duplicate events or delayed acknowledgements.

**Independent Test**: Replay the same client ID and official message event multiple times and verify one persisted message.

**Acceptance Scenarios**:
1. Given an acknowledged message, when its Facebook DOM event repeats, then CRM does not add a duplicate.
2. Given a failed message, when retry is selected, then a new client attempt is tracked while the original failure remains auditable.

## Edge Cases

- Missing/expired `fb_dtsg`, stale GraphQL response, invalid thread ID, wrong Facebook account, closed tab, timeout, WebSocket reconnect, duplicate acknowledgement, empty text, and recipient thread unavailable.
- A Facebook response containing errors but no official message ID must never be treated as success.
- A locally pending message must survive CRM reload and resume reconciliation without being resent automatically.

## Requirements

### Functional Requirements

- **FR-001**: System MUST route each CRM send request to the extension connection for the thread's account.
- **FR-002**: System MUST validate thread/account ownership, non-empty text, and extension readiness before dispatch.
- **FR-003**: System MUST persist a client attempt as `pending` before dispatch and expose its client ID to the UI.
- **FR-004**: System MUST mark an attempt `sent` only after Facebook returns a non-empty official message ID.
- **FR-005**: System MUST mark an attempt `failed` with a safe operator-facing reason when dispatch, authentication, timeout, or Facebook validation fails.
- **FR-006**: System MUST correlate results by `client_message_id` and official Facebook message ID.
- **FR-007**: System MUST be idempotent for repeated send results and repeated Facebook DOM events.
- **FR-008**: System MUST emit state changes to the CRM UI without creating duplicate message bubbles.
- **FR-009**: System MUST provide structured logs for dispatch, Facebook response classification, correlation, and final state.
- **FR-010**: System MUST NOT log cookies, tokens, message contents beyond existing bounded diagnostics, or recipient-sensitive payloads.
- **FR-011**: System MUST preserve pending/failed history across reload and avoid automatic duplicate resend.

## Key Entities

- **OutboundMessageAttempt**: client ID, thread/account, content, status, official Facebook ID, attempt number, timestamps, error code.
- **DeliveryResult**: success flag, official ID, normalized error code, raw-response diagnostics safe for logs.
- **ThreadAccountBinding**: mapping that proves a CRM thread belongs to the connected Facebook account.

## Success Criteria

- **SC-001**: In an end-to-end test, 100% of valid sends produce exactly one recipient-visible Messenger message.
- **SC-002**: No message without an official Facebook ID is displayed as sent.
- **SC-003**: Replaying any acknowledgement 10 times creates no additional persisted message.
- **SC-004**: A disconnected extension produces a visible failure within 2 seconds and never sends a false success.
- **SC-005**: Pending/failed state and retry metadata remain correct after CRM reload.

## Assumptions

- The operator is already logged into Facebook in a browser tab that matches the registered account.
- Existing extension WebSocket, Socket.IO, SQLite, and Facebook request mechanisms remain the integration boundary.
- Text-only outbound messages are MVP; attachments and bulk broadcast are out of scope.
