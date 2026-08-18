# Research: Bulk Message Campaigns

## Decision 1: Snapshot recipients at campaign creation

**Decision**: Copy the explicitly selected conversation ids and their source/account routing into campaign-recipient records. Do not recompute the inbox filter while a campaign is running.

**Rationale**: The operator must be able to preview and verify the exact 50-person list. A live query could add, remove, or reorder recipients while sending.

**Alternatives considered**:

- Re-run the filter for every batch: rejected because it can send to an unintended set.
- Store only a list of ids in one JSON field: rejected because per-recipient state, retries, and audit queries need individual rows.

## Decision 2: Use an explicit execution sequence

**Decision**: Store `selection_order` and derive a separate `execution_order` at preview/start time from `start_position` and `direction`. Persist the resulting order on each recipient.

**Rationale**: Inserting queue rows in reverse order or relying on timestamps is fragile when retries, pauses, or concurrent campaigns exist.

**Alternatives considered**:

- Insert recipients in reverse chronological order: rejected because retries and recovery change insertion timing.
- Sort by current sidebar order at dispatch time: rejected because the sidebar is mutable.

## Decision 3: Reuse the existing sequential queue as a transport boundary, not as the campaign model

**Decision**: Campaigns own recipient state and attempts; the existing queue remains a low-level dispatch mechanism with campaign metadata and idempotency keys attached.

**Rationale**: The current queue already routes Page sends through the extension, but it only stores text and has no campaign lifecycle. Keeping those responsibilities separate allows pause/resume and audit without corrupting ordinary one-to-one sends.

**Alternatives considered**:

- Put the campaign directly into `message_queue`: rejected because it lacks snapshot, ordering, attempts, and audit semantics.
- Create a second unrelated sender: rejected because it would duplicate routing and delivery confirmation logic.

## Decision 4: Page-first media rollout

**Decision**: Implement text first, then add attachments only through adapters that explicitly support and validate the requested media type. Personal Messenger campaign sending is not part of the MVP.

**Rationale**: Current outbound paths pass text through the queue and composer; inbound media columns do not prove outbound upload support. Page and personal routes have different capabilities and failure modes.

**Alternatives considered**:

- Assume all existing media columns enable outbound media: rejected because queue and extension payloads currently carry only `content`.
- Implement Page and personal media simultaneously: rejected because it expands the blast radius before the lifecycle and idempotency model is proven.

## Decision 5: Fail closed on eligibility, source, and operational limits

**Decision**: A recipient without a valid source/account route, authorization/consent state, or available send capacity is ineligible and is never silently rerouted or sent.

**Rationale**: Bulk actions amplify a routing or permission error. Existing account/source separation must be preserved for every attempt.

**Alternatives considered**:

- Fall back to another connected account: rejected because it can send from the wrong identity.
- Continue on missing limits and rely on adapter errors: rejected because the campaign would not have a predictable safety boundary.
