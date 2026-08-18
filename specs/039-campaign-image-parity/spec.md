# Feature Specification: Campaign Image Transport Parity

**Feature Branch**: `039-campaign-image-parity`  
**Created**: 2026-08-15  
**Status**: Draft  
**Input**: Allow campaign images to be delivered through both Facebook Page Messenger and personal Messenger, using the exact saved recipient route and evidence-based Facebook confirmation.

## User Scenarios & Testing

### User Story 1 - Create a mixed image campaign (Priority: P1)

As an operator, I want to attach an image to a campaign containing Page and personal Messenger recipients, so I can send one approved image without splitting the audience manually.

**Independent Test**: Select at least two Page and two personal recipients, attach a supported image, and verify each recipient displays its route and image eligibility before start.

**Acceptance Scenarios**:

1. **Given** a supported image and eligible mixed recipients, **when** the campaign is previewed, **then** Page and personal counts and image capability are shown per recipient.
2. **Given** a recipient whose route cannot send images, **when** preview validation runs, **then** only that recipient is marked ineligible with a specific reason.
3. **Given** an image-only campaign, **when** it is previewed, **then** the campaign does not silently convert the image into text-only delivery.

### User Story 2 - Send through the exact Page or personal identity (Priority: P1)

As an operator, I want every image to be sent through the identity recorded for that recipient, so no customer receives an image from the wrong Page or account.

**Independent Test**: Run a mixed image campaign and verify Page recipients use their Page identity, personal recipients use their personal identity, and no recipient is rerouted after a disconnect or route change.

**Acceptance Scenarios**:

1. **Given** an eligible Page recipient, **when** dispatched, **then** the send contains the saved Page identity.
2. **Given** an eligible personal recipient, **when** dispatched, **then** the send contains no Page identity and uses the saved personal account.
3. **Given** the route or account changes after snapshot, **when** dispatch is attempted, **then** that recipient fails closed and is never sent through another source.
4. **Given** a mixed campaign where one route disconnects, **when** the campaign runs, **then** independently eligible recipients continue under the existing failure policy.

### User Story 3 - Confirm actual Facebook image delivery (Priority: P1)

As an operator, I want an image to become sent only after Facebook visibly confirms it, so a locally saved CRM preview cannot create a false success.

**Independent Test**: Dispatch an image, observe the queue remain pending/processing, then emit a matching Facebook DOM image observation and verify the message, queue, attempt, and recipient become sent exactly once.

**Acceptance Scenarios**:

1. **Given** the extension reports composer dispatch, **when** Facebook has not confirmed the image, **then** the message remains pending and the queue remains processing.
2. **Given** a matching Page or personal DOM image observation, **when** correlation succeeds, **then** only the matching attempt becomes sent.
3. **Given** a replayed, duplicate, caption-only, or locally stored image event, **when** it reaches the backend, **then** it does not create a duplicate or false sent state.
4. **Given** confirmation does not arrive before the bounded timeout, **when** recovery runs, **then** the attempt becomes unknown or failed according to the existing delivery policy.

### User Story 4 - Retry and recover safely (Priority: P1)

As an operator, I want failed or uncertain image sends to retry without changing route or duplicating a customer-visible image.

**Independent Test**: Force upload failure, tab mismatch, disconnect, late confirmation, and retry; verify route identity remains unchanged and at most one attempt is active.

## Edge Cases

- Image-only message has no caption text.
- Caption confirmation arrives before image confirmation.
- Facebook displays a CRM-local image preview before accepting the send.
- DOM observer emits the same image more than once.
- One account owns both a Page route and a personal route.
- Personal Messenger and Business Suite expose different attachment controls.
- The tab is reloaded or navigated to another identity while an upload is in progress.
- The image checksum or local file changes after staging.
- A legacy Page-only campaign has no personal route snapshot fields.

## Requirements

### Functional Requirements

- **FR-001**: The campaign MUST accept only validated JPEG, PNG, or WebP images within the configured size limit.
- **FR-002**: Each recipient MUST be validated independently for image capability using its persisted account, source type, source identity, and current connection.
- **FR-003**: Page recipients MUST retain and use their saved Page identity; personal recipients MUST use their saved personal account and MUST have a null Page identity.
- **FR-004**: Dispatch MUST fail closed when the saved route, account, source, authorization, tab identity, or capability no longer matches.
- **FR-005**: The queue envelope MUST carry attachment metadata, route identity, campaign recipient identity, and campaign attempt identity.
- **FR-006**: Campaign queue idempotency MUST remain separate from rich-message outbound attempt idempotency.
- **FR-007**: A dispatch acknowledgement MUST NOT mark the message, queue, or campaign attempt as sent before Facebook image confirmation.
- **FR-008**: A confirmation MUST correlate to exactly one thread, route, attachment/message, and active attempt before changing state to sent.
- **FR-009**: Caption-only, local-preview-only, replayed, or ambiguous events MUST NOT confirm image delivery.
- **FR-010**: Page and personal adapters MUST report source-specific upload, composer, tab, and confirmation errors without fallback to another source.
- **FR-011**: Retry, pause, cancel, and recovery MUST preserve the original recipient route and at-most-one-active-attempt guarantee.
- **FR-012**: The UI MUST show image eligibility, route type, confirmation state, and actionable failure reasons per recipient.
- **FR-013**: Existing text campaigns and historical Page-only campaigns MUST retain their current behavior.
- **FR-014**: The feature MUST remain disabled for personal image delivery until the personal tab, attachment control, upload, send, and DOM confirmation flow passes live verification.

## Key Entities

- **Campaign Image Attachment**: Validated staged image with checksum, MIME type, byte size, safe local path, and campaign message binding.
- **Recipient Route Snapshot**: Immutable account/source/type/Page identity used for preview and dispatch.
- **Image Delivery Attempt**: Recipient-specific attempt with queue state, confirmation state, source-specific error, and correlation evidence.
- **Image Capability Decision**: Per-recipient eligible/ineligible result and user-facing reason.

## Success Criteria

- **SC-001**: A mixed campaign with at least two Page and two personal recipients sends every eligible image through the saved identity with zero cross-route sends.
- **SC-002**: 100% of dispatch acknowledgements remain pending/processing until a matching Facebook image observation or a bounded failure outcome.
- **SC-003**: Duplicate/replayed DOM observations create zero duplicate messages and zero duplicate confirmed attempts.
- **SC-004**: Route changes, disconnects, tab mismatches, and unsupported capabilities produce recipient-local actionable failures without blocking independently eligible recipients.
- **SC-005**: Page image, personal image, mixed campaign, retry, recovery, and legacy Page-only tests pass with no regressions in the existing persistence suite.
- **SC-006**: Personal image transport is not enabled in production configuration until a live verification checklist passes for upload, send, and confirmation.

## Assumptions

- Facebook Page and personal Messenger continue to expose different composer and attachment DOM surfaces.
- The backend remains the authority for route identity and capability decisions.
- The Chrome extension and CRM server run on the same machine, allowing staged local files to be supplied to the browser file chooser.
- Existing campaign pacing, caps, audit, and failure policy remain unchanged.
- Generic campaign files and PDFs remain out of scope.

## Out of Scope

- Automatic fallback to another Page or personal account.
- PDF or arbitrary-file campaign attachments.
- Bypassing Facebook permissions, anti-abuse controls, or rate limits.
- Rewriting historical campaign snapshots.
- Changing the one-to-one rich-message idempotency model.
