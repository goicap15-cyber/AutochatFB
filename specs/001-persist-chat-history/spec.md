# Feature Specification: Persist Chat History

**Feature Branch**: `001-persist-chat-history`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "CRM must retain newly discovered Facebook conversations and their message history across Facebook reloads, CRM reloads, and temporary extension disconnections."

## User Scenarios & Testing

### User Story 1 - Reopen CRM with prior conversations (Priority: P1)

As a CRM operator, I can reopen or reload the CRM and immediately see every previously discovered conversation with its stored history, even when Facebook or the extension is temporarily offline.

**Why this priority**: Losing contacts or history after reload makes the CRM unreliable as a customer record.

**Independent Test**: Discover two new conversations, capture their histories, reload Facebook and CRM repeatedly, and verify both conversations and the same stored messages remain visible.

**Acceptance Scenarios**:

1. **Given** a conversation and its messages were previously synchronized, **When** the CRM reloads, **Then** the conversation and stored messages appear from local data without waiting for Facebook.
2. **Given** the extension is disconnected, **When** the CRM opens, **Then** stored conversations and histories remain readable and only live synchronization/sending is unavailable.
3. **Given** a conversation is absent from the current Facebook sidebar snapshot, **When** synchronization completes, **Then** the stored conversation is not deleted or hidden solely because of that absence.

---

### User Story 2 - Backfill once, then append changes (Priority: P2)

As a CRM operator, when a Facebook conversation is first discovered, the CRM captures the history Facebook makes available, stores it once, and subsequently adds only new or missing messages.

**Why this priority**: This removes repeated full scraping while keeping the local record current.

**Independent Test**: Discover a conversation with existing history, complete its first synchronization, exchange new messages, and verify later syncs add only the new messages without losing or duplicating old ones.

**Acceptance Scenarios**:

1. **Given** a newly discovered conversation has no stored history, **When** initial synchronization succeeds, **Then** all available historical messages are retained locally.
2. **Given** initial history is already stored, **When** another synchronization runs, **Then** only new or missing messages are added.
3. **Given** a new incoming or outgoing message is observed, **When** it reaches the CRM, **Then** it is persisted before being treated as successfully available to the user.
4. **Given** synchronization is interrupted, **When** the CRM is reopened, **Then** previously stored messages remain intact and synchronization can resume.

---

### User Story 3 - Keep one stable conversation identity (Priority: P3)

As a CRM operator, the same Facebook conversation remains one CRM conversation even when Facebook exposes different identifiers through sidebar URLs, encrypted routes, or realtime payloads.

**Why this priority**: Identifier drift currently makes an existing person look like a new user and fragments message history.

**Independent Test**: Observe the same test contact through normal sidebar discovery, encrypted thread routing, realtime network data, and page reload; verify all messages resolve to one stored conversation.

**Acceptance Scenarios**:

1. **Given** multiple trusted external identifiers refer to one conversation, **When** any identifier is observed, **Then** the CRM resolves it to the same stored conversation.
2. **Given** an identifier cannot be safely matched, **When** data arrives, **Then** the CRM records a reviewable unresolved state instead of silently merging unrelated contacts.
3. **Given** existing stored conversations are migrated, **When** the feature is enabled, **Then** no valid conversation or message is lost.

### Edge Cases

- Facebook exposes only part of a long history or stops loading older pages.
- A conversation changes between normal and end-to-end encrypted routes.
- The same message arrives from network interception, DOM observation, history sync, and an optimistic send.
- Facebook reloads while an initial history synchronization is running.
- The backend or extension disconnects immediately after a message is sent.
- A sidebar snapshot is empty, partial, or temporarily inconsistent.
- Two different Facebook accounts expose the same external thread identifier.
- Existing rows contain missing URLs, unknown timestamps, or historical synthetic message identifiers.

## Requirements

### Functional Requirements

- **FR-001**: The CRM MUST use persisted conversations and messages as the source for initial display.
- **FR-002**: The CRM MUST retain stored conversations and messages across CRM reloads, Facebook reloads, and extension disconnections.
- **FR-003**: A sidebar synchronization MUST update discovered conversation metadata without deleting or hiding previously stored conversations solely because they are absent from the snapshot.
- **FR-004**: The CRM MUST start an initial history backfill when a newly discovered conversation has not completed one.
- **FR-005**: The CRM MUST track backfill state and allow interrupted or failed backfills to resume without discarding stored data.
- **FR-006**: After initial backfill, the CRM MUST synchronize incrementally from a stored progress marker instead of repeatedly replacing the full history.
- **FR-007**: Incoming, outgoing, automated, and broadcast messages MUST be persisted before the UI reports them as durably available.
- **FR-008**: Repeated delivery of the same Facebook message MUST not create duplicate stored messages.
- **FR-009**: The CRM MUST maintain a stable internal conversation identity scoped to the owning Facebook account.
- **FR-010**: The CRM MUST associate trusted external identifier aliases with the same internal conversation while preventing unsafe automatic merges.
- **FR-011**: Failed synchronization MUST preserve the last known conversation and history and expose a retryable status.
- **FR-012**: The CRM MUST migrate existing conversations and messages without destructive reset.
- **FR-013**: Search and conversation previews MUST remain consistent with message insertions, updates, and deletions.
- **FR-014**: The CRM MUST provide enough synchronization diagnostics to distinguish discovery, backfill, incremental sync, identity resolution, and failure states.

### Key Entities

- **Conversation**: Stable CRM record owned by one Facebook account, including contact metadata, latest activity, workflow status, and synchronization state.
- **Conversation Alias**: A trusted external identifier and source that resolves to one stable conversation.
- **Message**: A persisted incoming or outgoing item belonging to one conversation, with stable deduplication identity and timestamp provenance.
- **Sync Checkpoint**: Progress and status for initial backfill or incremental synchronization, including last success, failure reason, and retry state.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Two newly discovered test conversations remain visible with identical stored histories after 10 consecutive Facebook and CRM reload cycles.
- **SC-002**: Stored conversations and messages become readable within 2 seconds of opening the CRM without waiting for Facebook connectivity.
- **SC-003**: Five repeated synchronizations of an unchanged conversation create zero duplicate messages and remove zero valid messages.
- **SC-004**: A message accepted by the CRM remains visible after reload in 100% of test cases where persistence succeeds.
- **SC-005**: Normal URL, encrypted URL, and realtime identifiers for the same test conversation resolve to one CRM conversation in all defined identity tests.
- **SC-006**: An interrupted backfill can resume and complete without losing messages already stored.

## Assumptions

- "Full history" means all history Facebook makes available to the logged-in browser session during supported pagination or scrolling.
- Stored conversations and messages are retained indefinitely unless the operator explicitly deletes them in a future feature.
- Version one covers personal one-to-one Messenger conversations, including encrypted routes; group and Marketplace-specific behavior is outside this fix unless already compatible.
- Existing Facebook login/profile handling remains unchanged.
- Cloud backup and cross-device database synchronization are outside this feature.
