# Feature Specification: CRM Rich Messaging

**Feature Branch**: 027-crm-rich-messaging

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: Allow staff to stay entirely inside the CRM while sending emojis, images, and file attachments to customers through either a connected personal Messenger account or the correct Facebook Page.

## User Scenarios & Testing

### User Story 1 - Send emoji-rich messages from the CRM (Priority: P1)

As a staff member, I want to choose emojis from the CRM composer and insert them into my message so that I can communicate naturally without opening Facebook.

**Why this priority**: Emoji insertion is the smallest complete improvement, uses the existing message flow, and validates the shared composer experience before attachment handling is added.

**Independent Test**: Open one personal Messenger conversation and one Page conversation in the CRM, compose text containing standard, skin-tone, and combined emojis, send each message, and verify that the customer receives the same visible content from the correct Facebook identity.

**Acceptance Scenarios**:

1. **Given** an active CRM conversation, **when** the operator opens the emoji picker and selects an emoji, **then** the emoji is inserted at the current cursor position without replacing existing text.
2. **Given** a message containing text and multiple emojis, **when** the operator sends it from a personal Messenger conversation, **then** the customer receives the same visible content from the connected personal account.
3. **Given** a message containing text and multiple emojis, **when** the operator sends it from a Page conversation, **then** the customer receives the same visible content from the selected Page.
4. **Given** an empty composer with no attachment, **when** the operator uses the quick-like action, **then** a single visible like emoji is sent and tracked as an ordinary outbound message.

### User Story 2 - Send an image from the CRM to either Facebook source (Priority: P1)

As a staff member, I want to select and preview an image in the CRM and send it to the current customer so that I do not need to switch to Messenger or Business Suite.

**Why this priority**: Images are a core customer-support workflow and the requested experience is incomplete unless it works for both personal and Page conversations.

**Independent Test**: From the CRM, send a supported image without a caption and then with a caption to one personal Messenger conversation and one Page conversation; verify the correct recipient, sender identity, rendered image, caption, and final delivery state.

**Acceptance Scenarios**:

1. **Given** a supported image within the displayed limit, **when** the operator selects it, **then** the CRM shows its name, size, preview, and a remove action before sending.
2. **Given** a selected image and no text, **when** the operator sends it from either supported source, **then** the customer receives the image and the CRM records the outbound message.
3. **Given** a selected image and caption, **when** the operator sends it, **then** the customer receives both as one intended send operation without duplicate text or media.
4. **Given** an invalid, corrupted, unsupported, or oversized image, **when** it is selected, **then** the CRM rejects it before dispatch and preserves the operator's typed text.

### User Story 3 - Send a file attachment from the CRM to either Facebook source (Priority: P1)

As a staff member, I want to attach a supported business document from the CRM so that customers can receive quotations, instructions, or records through the current Facebook conversation.

**Why this priority**: File sending is explicitly requested and must provide the same CRM-only workflow and routing guarantees as text and images.

**Independent Test**: Send each initially supported file type from a personal Messenger conversation and a Page conversation, then verify that the customer can see and download the original file with the expected filename and that unsupported files are blocked before dispatch.

**Acceptance Scenarios**:

1. **Given** a supported file within the displayed limit, **when** the operator selects it, **then** the CRM shows its filename, type, size, and a remove action before sending.
2. **Given** a selected file with or without accompanying text, **when** the operator sends it from either supported source, **then** the customer receives the file from the correct Facebook identity.
3. **Given** a filename containing spaces or Vietnamese characters, **when** the customer receives the file, **then** the displayed filename remains understandable and the file contents are unchanged.
4. **Given** a type that the current Facebook source cannot accept, **when** the operator selects or attempts to send it, **then** the CRM blocks the operation with a specific explanation and does not silently send only the caption.

### User Story 4 - See reliable delivery progress and recover safely (Priority: P1)

As a staff member, I want the CRM to show whether a rich message is preparing, sending, sent, or failed so that I know what the customer actually received and can retry safely.

**Why this priority**: Media operations are slower and more failure-prone than text; incorrect success indicators or duplicate retries would directly harm customer conversations.

**Independent Test**: Exercise successful delivery, disconnected extension, rejected file, interrupted upload, Facebook composer failure, and retry scenarios on both sources; verify deterministic states and no unintended duplicate delivery.

**Acceptance Scenarios**:

1. **Given** a rich message has been submitted, **when** it is still being prepared or dispatched, **then** the CRM displays a non-final progress state and prevents a second submission of the same draft.
2. **Given** Facebook confirms the outbound item in the intended conversation, **when** the confirmation reaches the CRM, **then** the CRM marks the matching text/media/file item as sent.
3. **Given** the required account or Page connection is unavailable, **when** the operator attempts to send, **then** the CRM reports the missing connection, keeps the draft available, and does not route through another identity.
4. **Given** an outcome is uncertain after dispatch, **when** the operator requests a retry, **then** the CRM first reconciles the existing attempt and does not create a duplicate when the original item is already present.

### User Story 5 - Use one consistent composer across source types (Priority: P2)

As a staff member, I want the same controls and validation in every CRM conversation so that I do not need to understand the different Facebook transport paths.

**Why this priority**: A unified operator experience reduces errors, while source-specific differences remain an internal delivery concern.

**Independent Test**: Switch between personal and Page conversations and verify that the composer preserves the same interaction pattern, while unsupported capabilities are clearly disabled or explained before the operator composes an unsendable payload.

**Acceptance Scenarios**:

1. **Given** the operator switches from a personal conversation to a Page conversation, **when** the composer loads, **then** emoji, image, and file controls appear consistently and reflect the selected conversation's actual capabilities.
2. **Given** a draft contains an attachment, **when** the operator changes conversations, **then** the CRM prevents accidental delivery to the new recipient and requires an explicit decision to discard or retain the original draft.
3. **Given** a supported outbound item is sent, **when** it appears in history, **then** its presentation, filename, preview, and delivery state are consistent regardless of source type.

### Edge Cases

- The operator selects a file and immediately clicks send before preview or validation finishes.
- The selected conversation changes while an upload or send is in progress.
- The same file is selected twice or the send button is double-clicked.
- A message contains only whitespace plus an attachment or only an emoji.
- A combined emoji uses skin-tone modifiers or zero-width joiners.
- The file extension does not match its actual content type, or the file is empty, corrupted, or renamed deceptively.
- The extension disconnects after upload but before Facebook dispatch.
- Facebook accepts the dispatch but confirmation is delayed or the CRM reconnects before confirmation arrives.
- The Page/account identity changes in a background Facebook tab during dispatch.
- The customer conversation is unavailable, blocked, deleted, or no longer permits messaging.
- The customer receives media but not the optional caption, or vice versa; the CRM must report a partial or uncertain outcome rather than a false success.
- A local preview URL expires or an abandoned upload is cleaned up before it is sent.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST allow authorized staff to compose and send rich messages while remaining entirely within the CRM interface.
- **FR-002**: The system MUST support the same operator workflow for connected personal Messenger conversations and Facebook Page conversations.
- **FR-003**: The system MUST route every outbound item through the account or Page recorded for the active conversation and MUST NOT fall back to a different identity.
- **FR-004**: The composer MUST provide an emoji picker with categorized browsing, search, and recently used emojis.
- **FR-005**: Selecting an emoji MUST insert it at the current cursor position and MUST preserve existing text and other selected emojis.
- **FR-006**: The composer MUST support common Unicode emoji sequences, including skin-tone modifiers and combined emojis, without visibly changing the intended content.
- **FR-007**: The composer MUST provide a quick-like action when no text or attachment is present and treat the result as a normal tracked outbound message.
- **FR-008**: The operator MUST be able to select one supported image, preview it, remove it, and optionally add a caption before sending.
- **FR-009**: The operator MUST be able to select one supported file, review its filename/type/size, remove it, and optionally add accompanying text before sending.
- **FR-010**: The system MUST support attachment-only sends; text MUST NOT be required when a valid image or file is selected.
- **FR-011**: The system MUST validate declared type, actual content type, size, readability, and empty-file conditions before dispatch.
- **FR-012**: The CRM MUST display the currently allowed image/file types and size limit before or during selection.
- **FR-013**: The first release MUST provide at least JPEG, PNG, WebP, and PDF delivery on both source types; any additional file type MUST be enabled only after end-to-end capability validation on its target source.
- **FR-014**: Unsupported content MUST fail closed before dispatch and MUST NOT degrade silently into a text-only message.
- **FR-015**: The composer MUST show attachment preparation/validation progress and MUST prevent sending until the selected item is ready.
- **FR-016**: The CRM MUST create one visible outbound history item representing the intended text-plus-attachment operation and MUST correlate later Facebook confirmation to that item.
- **FR-017**: The CRM MUST expose preparing, sending, sent, failed, and uncertain states with a specific actionable error when available.
- **FR-018**: A message MUST be marked sent only after evidence confirms that the intended item appears in the intended Facebook conversation.
- **FR-019**: Duplicate clicks, reconnects, delayed confirmations, and explicit retries MUST NOT cause duplicate customer delivery without an intentional new-send action.
- **FR-020**: A failed or disconnected send MUST preserve the text and attachment reference long enough for the operator to retry or discard it.
- **FR-021**: Switching conversations with an unsent rich-message draft MUST require an explicit discard/retain decision and MUST NOT retarget the attachment automatically.
- **FR-022**: Outbound images and files MUST appear in CRM history with an appropriate preview or download action and their delivery status.
- **FR-023**: The system MUST preserve a safe, recognizable filename for downloadable files and MUST verify that stored and delivered content has not changed unexpectedly.
- **FR-024**: Temporary or abandoned uploads MUST be removed according to a documented retention policy without deleting media referenced by a pending or completed outbound message.
- **FR-025**: The system MUST record the operator, conversation, source identity, attachment metadata, timestamps, attempt identity, and final outcome for each rich-message send.
- **FR-026**: The system MUST present source-specific capability failures in user language while keeping source routing details available for diagnostics.

### Key Entities

- **Rich Message Draft**: The operator's unsent text, selected emoji content, optional single attachment, target conversation, and validation state.
- **Outbound Attachment**: A validated image or file with original display name, safe name, actual content type, size, integrity fingerprint, storage reference, and lifecycle state.
- **Outbound Message**: One intended customer-visible operation containing text, an optional attachment, target conversation, source identity, operator, and delivery state.
- **Delivery Attempt**: One dispatch of an outbound message through its recorded source, including correlation identity, timestamps, transport state, confirmation evidence, and error information.
- **Source Capability**: The attachment and message capabilities currently verified for a personal account or Page delivery path.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In end-to-end acceptance testing, 100% of supported emoji, image, and file sends reach the selected test conversation from the correct personal account or Page, with zero cross-identity deliveries.
- **SC-002**: Operators can select, preview, and submit a supported image or file from the CRM in no more than four deliberate actions after opening a conversation.
- **SC-003**: At least 95% of successful rich-message sends show a final sent state in the CRM within 15 seconds of the item becoming visible to the customer under normal connectivity.
- **SC-004**: Duplicate-click, reconnect, and retry test suites produce zero duplicate customer-visible messages across both source types.
- **SC-005**: All unsupported, oversized, corrupted, or mismatched test files are rejected before customer dispatch with a specific visible reason.
- **SC-006**: Emoji acceptance samples, including skin-tone and combined sequences, render with the same intended visible meaning in CRM history and Facebook on both source types.
- **SC-007**: In usability validation, at least 90% of operators complete each emoji, image, and file send without opening Facebook or requiring technical assistance.
- **SC-008**: Every tested rich-message attempt can be traced from the CRM history item to its target conversation, source identity, attempt outcome, and attachment metadata.

## Assumptions

- Staff already have permission to access the selected CRM conversation and its connected Facebook identity.
- A correctly authenticated extension and the required personal account/Page session are prerequisites, but staff do not need to view or operate those Facebook tabs during normal sending.
- Version one supports one attachment per outbound message; multiple attachments can be evaluated separately after single-attachment reliability is proven.
- JPEG, PNG, WebP, and PDF are the minimum cross-source acceptance set. Other document types are capability-gated and not promised until validated end to end.
- Emoji in this feature means Unicode emoji inserted into outgoing content plus a quick-like send. Reactions attached to an existing Facebook message are a separate feature.
- Existing authentication, conversation routing, and message-history permissions are reused.
- Attachment limits and retention periods are configurable and visible to operators.
- Desktop CRM is the primary target; responsive behavior should remain usable but a dedicated mobile workflow is not part of this feature.

## Out of Scope

- Reacting with heart, laugh, or another reaction to an already-sent Facebook message.
- Facebook stickers, GIF search, voice recording, video upload, and multiple attachments in one send.
- Sending through an account or Page that is not connected and authorized for the active conversation.
- Bypassing Facebook attachment limits, permissions, anti-abuse controls, or account restrictions.
- Bulk/campaign media behavior; this feature covers the one-to-one CRM composer.
