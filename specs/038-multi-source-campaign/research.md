# Research: Multi-source Campaign Delivery

## Decisions

### 1. Persist a complete route snapshot per recipient

**Decision**: A new campaign recipient stores source id, source type, account id, and external source identity resolved by the backend at snapshot time. Dispatch compares that snapshot with the current thread/source state before queueing.

**Rationale**: The present recipient record stores account id and source id, but derives source type and Page external id from mutable source tables. Capturing the complete route makes a mixed campaign auditable and prevents a source edit from silently changing the sending identity.

**Alternatives considered**:

- Let the browser submit `source_type` or `page_id`: rejected because the UI is not a routing authority.
- Resolve the current route only at dispatch: rejected because it can use a different identity from the one the operator reviewed.
- Rewrite historical recipients: rejected because past Page-only campaigns must retain their existing semantics.

### 2. Reuse the queue v2 source-aware envelope

**Decision**: Campaign messages sent through Page or personal routes use the existing queue contract that carries `source_type`, `source_id`, `account_id`, and `page_id` (null for personal). The existing extension source switch remains the transport boundary.

**Rationale**: The queue worker and extension already validate both `page_messenger` and `personal_messenger`; individual rich-message tests prove a personal image envelope with no Page id and Facebook-observed confirmation. Campaign work should supply the same canonical route facts instead of inventing another personal sender.

**Alternatives considered**:

- A separate personal campaign queue: rejected because it duplicates idempotency, confirmation, recovery, and pause/cancel behavior.
- Treat personal as a Page with a synthetic Page id: rejected because it risks cross-identity routing and violates the extension contract.

### 3. Evaluate capability per recipient, not per campaign

**Decision**: Text and image eligibility are calculated independently for each recipient's authoritative route. A personal source without enabled image capability becomes an ineligible/unsupported image recipient; it does not receive caption-only fallback.

**Rationale**: Page and personal source capabilities can differ. Mixed source selection is only trustworthy when outcomes explain the difference before dispatch.

**Alternatives considered**:

- Reject the entire campaign when one route lacks image support: rejected because text-capable/eligible recipients should remain usable.
- Silently omit image and send caption: rejected because it misrepresents customer delivery.

### 4. Keep one sequential campaign runner, isolate failures per recipient

**Decision**: Preserve the existing one-active-attempt runner, pacing, retry, pause, cancel, recovery, and aggregate counters. Route/capability errors are terminal for the individual recipient unless the existing retry classifier explicitly marks the exact error retryable.

**Rationale**: Serial dispatch already provides reliable lifecycle controls. Mixed sources change route validation, not the ownership of campaign sequencing.

**Alternatives considered**:

- One runner per source: rejected for this increment because it changes ordering and overloads the current campaign reliability model.
- Continue through a different connected source: rejected because it is an impersonation/cross-route risk.

### 5. Represent source choice visibly at review and result time

**Decision**: Show Page and personal counts in creation/preview, a source badge and source identity in recipient rows, and source-aware audit/outcome labels. Existing Page-only UI wording is generalized.

**Rationale**: Operators need to notice an unsupported personal source before starting and diagnose source-specific results afterward.

**Alternatives considered**:

- Keep the source hidden in the technical audit payload: rejected because it forces operators to inspect logs.

## Existing architecture facts used by the plan

- `CampaignEligibilityService` currently explicitly rejects non-Page recipients and attachments for them; this is the primary Page-only gate to replace.
- `enqueueCampaignMessage` repeats a Page-only guard and gets `page_id` from the mutable source row; it must consume the validated route snapshot instead.
- `QueueWorker` already validates both route types and requires a Page id only for Page items.
- `RichMessageCapabilityService` already resolves source-specific image/file capability and connection state for both types. Its route-resolution logic should be extracted/reused without trusting client input.
- The extension's existing source switch calls the Business Suite Page handler only when the envelope says `page_messenger` with a Page id; otherwise it calls the personal handler. The campaign must only issue a valid v2 envelope after backend route validation.

## Open implementation safeguards

- The existing spec 025 tab-identity guarantees remain prerequisites for personal-route campaign dispatch; do not weaken or bypass the coordinator/cooldown checks.
- Confirmation stays evidence-based. A dispatched event does not make a campaign recipient sent; Facebook observation/reconciliation does.
- `message_queue.idempotency_key` continues to use campaign attempt semantics. This is separate from one-to-one rich-message `outbound_attempts.idempotency_key`.
