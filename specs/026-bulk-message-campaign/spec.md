# Feature Specification: Bulk Message Campaigns

**Feature Branch**: `026-bulk-message-campaign`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: Create a campaign that sends one or more messages to a filtered list of conversations, with selectable ordering such as recipient 50 down to recipient 1, and support for attachments such as images and videos.

## User Scenarios & Testing

### User Story 1 - Create and review a recipient campaign (Priority: P1)

As a staff member, I want to turn the current conversation filter and selection into a fixed campaign recipient list so that the campaign does not change when the inbox changes later.

**Why this priority**: A reliable recipient snapshot is the foundation for every later send and prevents accidental sends to a moving or incorrect list.

**Independent Test**: Filter conversations, select 50 eligible conversations, create a draft campaign, and verify that the campaign contains exactly those 50 recipients with their source, account, and original order preserved.

**Acceptance Scenarios**:

1. **Given** a filtered inbox with selected eligible conversations, **when** the staff member creates a draft campaign, **then** the campaign stores a snapshot of the selected conversations and their source/account routing data.
2. **Given** a draft campaign, **when** a conversation is later removed from the inbox filter, **then** the campaign recipient snapshot remains unchanged.
3. **Given** a selected conversation that is not sendable or has no valid source, **when** the campaign is created, **then** it is marked ineligible with a reason and cannot be silently sent.

### User Story 2 - Compose a text campaign and send in a chosen order (Priority: P1)

As a staff member, I want to enter a message, choose a start position and direction, preview the order, and send sequentially so that a list of 50 recipients can run from recipient 50 to recipient 1.

**Why this priority**: Text-only sequential sending provides the smallest useful campaign and directly covers the requested reverse-order workflow.

**Independent Test**: Create a campaign with 5 recipients, choose the last recipient as the starting point and descending order, start it, and verify the send order is 5, 4, 3, 2, 1 with one result per recipient.

**Acceptance Scenarios**:

1. **Given** a campaign with recipients ordered 1 through 50, **when** the operator chooses start position 50 and descending direction, **then** the preview and execution order are 50 through 1.
2. **Given** a running campaign, **when** one recipient succeeds, **then** the next eligible recipient is dispatched only after the configured pacing interval and the completed recipient is not sent again.
3. **Given** a running campaign, **when** the operator pauses it, **then** no new recipient is dispatched and an in-flight send is allowed to settle before the campaign becomes paused.
4. **Given** a campaign with a failed recipient, **when** the failure is classified as retryable, **then** the system retries only up to the campaign retry limit; permanent failures are recorded and the campaign continues according to its failure policy.
5. **Given** an active campaign, **when** the operator cancels it, **then** unsent recipients are cancelled and no new message is dispatched.

### User Story 3 - Send attachments as campaign content (Priority: P2)

As a staff member, I want to attach supported media to campaign messages so that a campaign can contain an image, video, or file where the selected source supports that content type.

**Why this priority**: Attachments are part of the requested workflow, but they require a separate outbound transport and validation path beyond the current text queue.

**Independent Test**: Create a draft campaign with one supported image attachment, preview it, validate the file, and verify that the attachment is persisted and included in the outbound job without altering the recipient order.

**Acceptance Scenarios**:

1. **Given** a draft campaign, **when** the operator uploads a supported attachment within the configured size/type limits, **then** it is stored once and referenced by the campaign message.
2. **Given** an unsupported, oversized, missing, or unreadable attachment, **when** the operator tries to add it, **then** the campaign remains unchanged and shows a specific validation error.
3. **Given** a source that does not support the selected media type, **when** the operator previews or starts the campaign, **then** the affected campaign is blocked with a clear reason rather than silently sending text only.
4. **Given** a recipient receives a campaign message with an attachment, **then** the recipient result records the attachment send outcome independently from the text outcome.

### User Story 4 - Monitor, retry, and audit campaign execution (Priority: P2)

As a staff member, I want to see campaign progress and per-recipient outcomes so that I can safely pause, retry failures, or investigate what happened.

**Why this priority**: Bulk operations need operational controls and an audit trail to prevent duplicate sends and make failures recoverable.

**Independent Test**: Run a campaign with successful, retryable, permanent-failure, and cancelled recipients, then verify aggregate counters, recipient states, timestamps, error reasons, and audit events.

**Acceptance Scenarios**:

1. **Given** a campaign with mixed outcomes, **when** the operator opens its detail view, **then** totals for pending, processing, sent, failed, skipped, and cancelled recipients are consistent with the recipient rows.
2. **Given** a failed recipient, **when** the operator chooses retry, **then** only that recipient is re-queued with a new attempt and the original failure remains in the audit history.
3. **Given** a campaign that is paused or cancelled, **when** the server restarts, **then** its persisted state is recovered without dispatching messages until explicitly resumed.
4. **Given** a campaign operation, **when** it changes state or dispatches a send, **then** the system records who initiated it, when it occurred, and the resulting status.

### Edge Cases

- The filter returns no conversations: campaign creation is disabled with an actionable message.
- A selected thread is deleted, merged, disconnected, or changes source after the snapshot: it becomes ineligible or failed without affecting other recipients.
- The selected start position is outside the snapshot or the direction produces no recipients: the campaign cannot start.
- Two campaign actions arrive at nearly the same time: only one start, pause, resume, retry, or cancel transition is accepted.
- The account or Page extension disconnects during a send: the in-flight item is recovered as retryable or unknown, never duplicated automatically.
- The server restarts while a queue item is processing: recovery must not dispatch the same item twice without an explicit idempotency decision.
- A message template is empty after normalization: campaign start is rejected.
- A campaign targets multiple sources or accounts: routing is resolved per recipient and a failure in one source does not route through another source.
- An attachment is removed or becomes unavailable before dispatch: the recipient is marked failed with an attachment-specific reason.
- The operator attempts to target recipients without a valid permission or consent state: the campaign must block those recipients and record why.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST allow an operator to create a draft campaign from explicitly selected conversations and store a stable recipient snapshot.
- **FR-002**: Each campaign recipient MUST retain the conversation id, source id, account id, original selection order, eligibility state, and eligibility reason.
- **FR-003**: The system MUST allow an operator to choose a valid start position and ascending or descending execution direction.
- **FR-004**: The system MUST preview the exact planned recipient order before a campaign can start.
- **FR-005**: The system MUST dispatch at most one new recipient send at a time for a campaign and MUST wait for the configured pacing/recovery decision before dispatching the next one.
- **FR-006**: Campaign and recipient state transitions MUST be persisted and idempotent across duplicate UI actions and server restarts.
- **FR-007**: The system MUST support pause, resume, cancel, and retry-failed-recipient operations with explicit state transition validation.
- **FR-008**: The system MUST prevent duplicate delivery attempts for the same campaign recipient and message unless the operator explicitly requests a retry.
- **FR-009**: The system MUST record per-recipient attempt count, status, timestamps, error code/reason, and outbound client id.
- **FR-010**: The system MUST route each recipient through its recorded inbox source and account; it MUST NOT fall back to another account or source.
- **FR-011**: The system MUST validate message content before start and reject empty or invalid campaign content.
- **FR-012**: The system MUST allow supported attachments to be uploaded once, validated, persisted, and referenced by campaign messages.
- **FR-013**: The system MUST reject attachments that exceed configured type, size, or availability constraints and explain the rejection.
- **FR-014**: The system MUST verify that every selected source supports the requested message/attachment type before dispatch.
- **FR-015**: The system MUST expose aggregate and per-recipient progress to the operator without requiring a page reload.
- **FR-016**: The system MUST maintain an audit record for campaign creation, preview, start, pause, resume, cancel, retry, dispatch, success, and failure events.
- **FR-017**: Campaign sending MUST be limited to recipients the operator is authorized to contact and must provide a way to exclude or record opted-out/ineligible recipients.
- **FR-018**: The system MUST apply configurable operational limits, including pacing, maximum retries, quiet hours, and a campaign/account send cap; it MUST fail closed when a limit is missing or exceeded.

### Key Entities

- **Campaign**: A saved outbound operation with source scope, content, execution direction, start position, pacing policy, lifecycle state, and audit metadata.
- **Campaign Recipient**: A snapshot row for one conversation, including original order, source/account routing, eligibility, current status, attempt count, and last error.
- **Campaign Message**: One text/media payload in the campaign sequence, with explicit order and validation state.
- **Campaign Attachment**: A persisted upload with type, size, storage location, checksum, and validation status.
- **Campaign Attempt**: An immutable record of one explicit dispatch attempt and its result.
- **Campaign Audit Event**: An immutable record of operator or system actions affecting campaign state or delivery.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For a 50-recipient campaign, the previewed and executed order matches the selected direction exactly, including reverse order, with zero unintended recipients.
- **SC-002**: A text campaign with 50 eligible recipients creates exactly 50 recipient jobs and never creates more than one active attempt per recipient without an explicit retry.
- **SC-003**: Pause and cancel actions prevent any new dispatch after the persisted state transition is acknowledged.
- **SC-004**: After a server restart, campaign counters and recipient states reconcile with persisted attempt records, and no item is dispatched twice automatically.
- **SC-005**: Operators can identify the status and latest reason for every recipient from the campaign detail view without inspecting server logs.
- **SC-006**: Invalid or unsupported attachments are rejected before the campaign starts, with no partial recipient dispatch.
- **SC-007**: Every campaign state change and delivery attempt is auditable with actor, timestamp, recipient, and outcome data.
- **SC-008**: A campaign does not send to a recipient outside its stored snapshot, source/account route, authorization, or configured operational limits.

## Assumptions

- The first implementation targets Page conversations because the repository already has a Page queue path; personal Messenger campaigns require a separate risk and capability review.
- The initial campaign sends one common message sequence to all eligible recipients; per-recipient personalization is out of scope for the MVP.
- The current inbox filters and selected conversation ids are available to the campaign creation flow.
- Media support is implemented only for source/type combinations that the outbound adapter can verify; unsupported combinations fail closed.
- The campaign snapshot is immutable after start. Editing recipients after start is out of scope; retry is per recipient.
- Operators are responsible for using campaigns only with contacts they are authorized to message and for honoring applicable platform and privacy requirements.
- Mobile UI is out of scope for the first release.

## Out of Scope

- Automated unsolicited messaging to arbitrary users.
- Techniques intended to evade platform rate limits, anti-abuse controls, or account enforcement.
- AI-generated per-recipient personalization.
- Multi-step marketing automation triggered by arbitrary events.
