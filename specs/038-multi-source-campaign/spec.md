# Feature Specification: Multi-source Campaign Delivery

**Feature Branch**: `038-multi-source-campaign`
**Created**: 2026-08-15
**Status**: Draft
**Input**: User description: "Allow one bulk-message campaign to deliver to a mixed list of Facebook Page and personal Messenger conversations, routing every recipient through its own recorded source."

## User Scenarios & Testing

### User Story 1 - Create one campaign from a mixed inbox selection (Priority: P1)

As a staff member, I want to create a campaign from selected conversations that may belong to Facebook Pages and personal Messenger accounts, so that I can work from one saved recipient list instead of splitting the work manually.

**Why this priority**: A mixed snapshot is the feature's core value; without it, the campaign remains Page-only.

**Independent Test**: Select two Page conversations and two personal Messenger conversations, create a draft campaign, and verify that all four recipients are retained with their own route and eligibility result.

**Acceptance Scenarios**:

1. **Given** a mixed selection, **when** the operator creates a campaign, **then** every selection is retained with its immutable stored route.
2. **Given** an inactive, disconnected, or unauthorized source, **when** the campaign is reviewed, **then** only that recipient is marked ineligible with an actionable source-specific reason.
3. **Given** a historical Page-only campaign, **when** it is viewed or resumed, **then** its existing snapshot and behavior remain unchanged.

### User Story 2 - Deliver through the correct Page or personal identity (Priority: P1)

As a staff member, I want every recipient in a mixed campaign to receive through the Page or personal account recorded for their conversation, so that no customer receives a message from the wrong identity.

**Why this priority**: Correct identity and fail-closed routing are more important than campaign throughput.

**Independent Test**: Run a text campaign across two active Page routes and two active personal routes. Verify each recipient receives exactly one message from its stored identity and no recipient is rerouted after a disconnect.

**Acceptance Scenarios**:

1. **Given** an eligible Page recipient, **when** dispatched, **then** the outbound item contains the stored Page identity and route.
2. **Given** an eligible personal recipient, **when** dispatched, **then** the outbound item contains the stored personal account route and no Page identity.
3. **Given** the source, account, authorization, or route changed after snapshot, **when** dispatch is attempted, **then** only that recipient fails closed and is never sent through another source.
4. **Given** one source disconnects in a mixed campaign, **when** another source remains eligible, **then** the campaign records the failed recipient and continues under its existing failure policy.

### User Story 3 - Review source-aware eligibility and outcomes (Priority: P1)

As a staff member, I want to see which source each recipient will use and why any recipient was skipped or failed, so that I can act without reading logs.

**Independent Test**: Review a campaign with an eligible Page recipient, an eligible personal recipient, and a disconnected personal recipient. Verify the preview and results identify each source type and its reason.

**Acceptance Scenarios**:

1. **Given** a mixed campaign draft, **when** it is reviewed, **then** the Page and personal counts are visible and unsupported recipients are not hidden.
2. **Given** a recipient cannot deliver the chosen content, **when** the campaign is validated, **then** the recipient has a specific source/content reason before dispatch.
3. **Given** the campaign completes, **when** results or audit records are opened, **then** every attempt shows source type, source identity, delivery state, and relevant failure reason.

### User Story 4 - Send campaign images only to supported routes (Priority: P2)

As a staff member, I want a campaign image sent only where the saved recipient route supports it, so mixed campaigns stay truthful about what customers received.

**Independent Test**: Attach an image to a mixed campaign with capable Page/personal routes and one personal route without image capability. Verify only capable recipients dispatch the image, while the unsupported recipient is recorded before sending.

**Acceptance Scenarios**:

1. **Given** a campaign image, **when** recipients are revalidated, **then** image delivery is allowed only where their stored capability permits it.
2. **Given** a recipient lacks image capability, **when** the campaign starts, **then** it is not silently downgraded into text-only delivery.
3. **Given** Facebook confirms an image for a supported route, **when** confirmation arrives, **then** the matching campaign attempt reaches its final state without affecting another recipient.

### Edge Cases

- One account owns both personal and Page routes; route type and source identity remain distinct.
- A recipient route changes, is deleted, or becomes inactive after the snapshot.
- A source reconnects while another source in the campaign remains ready.
- A personal source can send text but not the attached image.
- A retry after uncertain dispatch preserves the original recipient route.
- Two recipients share an account but use different Page/personal identities; limits must not be accidentally shared or bypassed.

## Requirements

### Functional Requirements

- **FR-001**: Newly created campaigns MUST snapshot mixed `page_messenger` and `personal_messenger` conversations.
- **FR-002**: Every recipient snapshot MUST retain its resolved source id, source type, account id, and source identity.
- **FR-003**: Sending MUST derive route only from persisted recipient data, never from a client-provided type, and MUST never fall back to another Page/account.
- **FR-004**: Before every dispatch, the current thread route, source/account status, connection, and content capability MUST be revalidated.
- **FR-005**: Page recipients MUST use their stored Page identity; personal recipients MUST use their stored personal identity without a Page id.
- **FR-006**: Ineligible, unsupported, changed, or disconnected recipients MUST fail closed with a specific reason, while independently eligible recipients may continue under the existing failure policy.
- **FR-007**: Page-only campaigns created before this feature MUST retain their existing behavior and snapshots.
- **FR-008**: Creation, preview, results, and audit views MUST disclose recipient source type and source-specific eligibility/outcome reasons.
- **FR-009**: Text and image capability MUST be determined independently for each recipient route.
- **FR-010**: A recipient lacking content capability MUST NOT receive only a caption/text as an implicit fallback.
- **FR-011**: Retry, recovery, pause, and cancel MUST preserve recipient route identity and the current at-most-one-active-attempt guarantee.
- **FR-012**: Source/account operational limits and pacing MUST prevent impersonation or bypass between identities.
- **FR-013**: Aggregate campaign counters and recipient states MUST remain accurate for mixed-source results.
- **FR-014**: Every dispatch and confirmation MUST be traceable to one recipient, source type, source identity, and attempt.

### Key Entities

- **Campaign Recipient Route Snapshot**: Immutable account, source, source type, source identity, and route data for one dispatch.
- **Route Capability Decision**: Text/image validation result for a saved recipient route, including a user-facing unsupported reason.
- **Campaign Attempt**: One recipient-specific dispatch/retry that preserves the route snapshot and awaits confirmation from that route.
- **Source-aware Campaign Outcome**: Result and audit data that identify Page Messenger versus personal Messenger.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a test campaign with at least two Page and two personal recipients, 100% of eligible recipients receive from the stored identity and zero are cross-routed.
- **SC-002**: The preview displays Page/personal counts and recipient route outcomes before start.
- **SC-003**: A disconnected or capability-ineligible recipient displays a reason and does not prevent independently eligible recipients completing.
- **SC-004**: Retry, reconnect, and recovery tests yield zero cross-source sends and zero duplicate customer-visible messages.
- **SC-005**: Existing Page-only campaign integration tests pass without rewriting historical snapshots.
- **SC-006**: Supported image routes update their matching campaign result after confirmation; unsupported routes never report false sent status.

## Assumptions

- The inbox source model remains the authority for Page versus personal routing.
- An exact source/account connection is required; this feature does not create or manage Facebook logins.
- Text is mandatory cross-source support. Campaign images are capability-gated; generic campaign file/PDF support is out of scope.
- Existing pacing and limits remain conservative; the implementation clarifies their route/account scope instead of increasing volume.
- The feature applies to new campaign snapshots; old Page-only snapshots are not rewritten.

## Out of Scope

- Falling back to another Page or personal account when the intended source is unavailable.
- Bypassing Facebook permissions, rate limits, anti-abuse controls, or account restrictions.
- Generic file/PDF campaign attachments, per-recipient personalization, or branching automation.
- Changing the one-to-one rich-message contract except for a shared routing/capability helper.
