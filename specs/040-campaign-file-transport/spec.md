# Feature Specification: Campaign File Transport

**Feature Branch**: `040-campaign-file-transport`  
**Created**: 2026-08-15  
**Status**: Draft  
**Input**: Extend campaign delivery beyond images so a campaign can send validated files through the exact Facebook Page or personal Messenger route for each recipient.

## Relationship to Existing Features

- Spec 027 defines one-to-one CRM rich messaging and its validated attachment model.
- Spec 038 defines mixed Page/personal campaign routing.
- Spec 039 defines campaign image transport and image confirmation.
- This spec adds campaign file transport; it does not replace image transport or the one-to-one rich-message contract.

## User Scenarios & Testing

### User Story 1 - Create a campaign with a file (Priority: P1)

As an operator, I want to attach files or a folder to a campaign, so I can send the same materials to selected Page and personal Messenger recipients without uploading them separately for every conversation.

**Independent Test**: Select a mixed recipient list, attach arbitrary files and a folder, and verify the file list, generated ZIP, types, sizes, checksums, route capability, and recipient-level eligibility before starting.

**Acceptance Scenarios**:

1. **Given** readable files of different types, **when** it is attached, **then** the campaign shows its filename, type, size, checksum-backed readiness, and remove action.
2. **Given** a file-only campaign, **when** it is previewed, **then** text is not required and the campaign does not silently downgrade to text-only.
3. **Given** a file that is oversized, empty, corrupted, unreadable, or MIME-mismatched, **when** it is selected, **then** it is rejected before any recipient is queued.
4. **Given** a folder, **when** it is selected, **then** its permitted contents are packaged as one ZIP attachment with a visible file count and total size.

### User Story 2 - Send through the saved Page or personal route (Priority: P1)

As an operator, I want each recipient to receive the file from the exact identity saved in the campaign snapshot, so documents are never sent from the wrong Page or personal account.

**Independent Test**: Run a mixed Page/personal file campaign and verify Page recipients include their Page identity while personal recipients have no Page identity.

**Acceptance Scenarios**:

1. **Given** an eligible Page recipient, **when** the file is dispatched, **then** the Business Suite Page route is used.
2. **Given** an eligible personal recipient, **when** the file is dispatched, **then** the personal Messenger route is used with `page_id` absent or null.
3. **Given** a route, account, source, permission, or tab identity change after snapshot, **when** dispatch is attempted, **then** that recipient fails closed without fallback.
4. **Given** one source disconnects, **when** the campaign continues, **then** independently eligible recipients remain processable under the existing failure policy.

### User Story 3 - Confirm actual file delivery (Priority: P1)

As an operator, I want the campaign to show a file as sent only after Facebook confirms the intended file in the intended conversation.

**Independent Test**: Dispatch an arbitrary file manifest, confirm the queue remains processing, then provide a matching Page or personal DOM file observation and verify exactly one recipient attempt becomes confirmed.

**Acceptance Scenarios**:

1. **Given** the extension reports that the composer accepted the file, **when** Facebook has not confirmed it, **then** the message remains pending and the queue remains processing.
2. **Given** Facebook confirms a file with a matching route and attempt, **when** the confirmation is received, **then** only that attempt becomes sent.
3. **Given** a caption-only event, local CRM preview, duplicate DOM event, or ambiguous file observation, **when** it reaches the backend, **then** it cannot confirm delivery.
4. **Given** confirmation never arrives, **when** the bounded timeout or recovery policy runs, **then** the attempt becomes unknown or failed with an actionable reason.

### User Story 4 - Retry safely (Priority: P1)

As an operator, I want upload and delivery failures to be retryable without changing the recipient route or creating an unintended duplicate document.

**Independent Test**: Exercise upload failure, tab mismatch, disconnect, delayed confirmation, and retry for both source types; verify route preservation and at-most-one active attempt.

## Edge Cases

- Attached filename contains spaces, Vietnamese characters, or a misleading extension.
- File is changed on disk after staging.
- File-only message has no caption.
- Caption confirmation arrives before file confirmation.
- Page and personal Messenger expose different attachment controls.
- A customer receives the same filename in multiple campaign messages.
- DOM observer replays the same file several times after a tab reload.
- One account owns both a Page route and a personal route.
- Historical Page-only campaigns do not have personal route fields.
- A file is valid for one route but the adapter is not yet verified for another route.

## Requirements

### Functional Requirements

- **FR-001**: The campaign MUST accept arbitrary readable file types subject to configured size, security, safe-path, and Facebook transport limits; it MUST NOT restrict the feature to a fixed MIME allowlist.
- **FR-002**: The operator MUST be able to select a folder; the system MUST package its permitted contents into one ZIP attachment while preserving relative filenames and directory structure.
- **FR-003**: The operator MUST be able to attach multiple files, inspect each filename/type/size/readiness, and optionally add caption text.
- **FR-004**: Attachment-only campaign messages MUST be supported; caption text MUST NOT be required.
- **FR-005**: Validation MUST check declared MIME when available, detected content type, readability, empty-file state, byte size, safe filename/path, checksum, archive traversal, symlinks, and executable-risk policy before queueing.
- **FR-006**: Every recipient MUST be validated independently for file capability using the persisted route, current account/source status, connection, and adapter support.
- **FR-007**: Page recipients MUST use their saved Page identity; personal recipients MUST use their saved personal account with no Page identity.
- **FR-008**: Route mismatch, disconnected source, missing permission, wrong tab identity, or unsupported adapter MUST fail closed without fallback.
- **FR-009**: The queue envelope MUST carry one attachment manifest containing file metadata, ZIP metadata when applicable, route identity, campaign recipient identity, and campaign attempt identity.
- **FR-010**: Campaign queue idempotency MUST remain separate from one-to-one rich-message outbound-attempt idempotency.
- **FR-011**: Dispatch acknowledgement MUST leave the queue and message pending/processing until Facebook file confirmation.
- **FR-012**: Confirmation MUST correlate exactly one file, thread, route, and active attempt before setting message, queue, recipient, and attempt to sent/confirmed.
- **FR-013**: Local CRM storage, caption-only events, duplicate/replayed events, or ambiguous observations MUST NOT confirm file delivery.
- **FR-014**: Page and personal adapters MUST report source-specific upload, composer, tab, and confirmation failures without routing fallback.
- **FR-015**: Retry, pause, cancel, and recovery MUST preserve the saved route and at-most-one-active-attempt guarantee.
- **FR-016**: Campaign preview, detail, recipient table, and audit history MUST show file capability, route type, filename, delivery state, and actionable failure reason.
- **FR-017**: Existing campaign image delivery, one-to-one rich messaging, text campaigns, and historical Page-only campaigns MUST remain compatible.
- **FR-018**: Personal arbitrary-file delivery MUST remain disabled until live verification confirms the personal attachment control, upload, send, and DOM confirmation flow.

## Key Entities

- **Campaign File Attachment**: One or more validated staged files, or one generated ZIP for a selected folder, bound to a campaign message, with safe filename, detected type, byte size, checksum, and lifecycle state.
- **Recipient File Capability**: Per-recipient decision indicating whether the saved route can deliver the selected file and why not.
- **File Delivery Attempt**: One recipient-specific dispatch, confirmation, failure, or retry preserving route and attachment identity.
- **File Confirmation Evidence**: The source, Facebook identifier, DOM/media markers, timestamp, and correlation fields proving the file was accepted.

## Success Criteria

- **SC-001**: In a mixed campaign with at least two Page and two personal recipients, every eligible arbitrary-file manifest is delivered through the saved identity with zero cross-route sends.
- **SC-002**: 100% of dispatch acknowledgements remain pending/processing until matching Facebook file confirmation or a bounded failure outcome.
- **SC-003**: Oversized, corrupted, unsafe, MIME-mismatched, unreadable files, unsafe folder entries, and archive traversal attempts are rejected before any customer-facing dispatch.
- **SC-004**: Duplicate/replayed DOM events create zero duplicate confirmed attempts or customer-visible duplicate files.
- **SC-005**: Route changes, disconnects, tab mismatches, and unsupported adapters produce recipient-local actionable failures while eligible recipients continue.
- **SC-006**: Page file, personal file, mixed campaign, retry, recovery, and historical Page-only tests pass without regressions in the existing persistence suite.
- **SC-007**: Personal file transport remains off in production configuration until the documented live verification checklist passes.

## Assumptions

- Spec 027's attachment validation, safe filename, checksum, and retention rules are reused rather than duplicated.
- The CRM and extension run on the same machine, so a staged local path can be supplied to the browser file chooser.
- One campaign message contains one file manifest and optional caption text. A manifest may contain multiple files or one generated ZIP for a folder.
- Existing pacing, daily caps, campaign failure policy, audit trail, and recovery rules remain unchanged.
- Facebook transport capability is evaluated for the resulting attachment manifest; arbitrary local file types do not bypass Facebook limits or safety policy.

## Out of Scope

- Replacing the image transport defined in Spec 039.
- Sending a folder as a native folder object; folders are always packaged as ZIP.
- Arbitrary files without capability, safety, size, and integrity validation.
- Fallback to another Page or personal account.
- Bypassing Facebook permissions, attachment limits, anti-abuse controls, or account restrictions.
- Rewriting historical campaign snapshots.
