# Feature Specification: Trusted Messenger Send Replacement

**Feature Branch**: `006-trusted-messenger-send`
**Created**: 2026-08-03
**Status**: Draft

## User Stories

### US1 — Send exactly one CRM message to Messenger (P1)

When an operator sends one text from CRM, the active Messenger conversation receives exactly one message and CRM reaches `sent` only after confirmation.

**Acceptance scenarios**:

1. Given a visible Messenger composer, when CRM sends text, then the extension waits for the semantic send control, clicks it once, and observes one outgoing message.
2. Given the click does not submit, when the confirmation timeout expires, then the extension sends one browser-level Enter fallback and observes one outgoing message.
3. Given neither path confirms, then CRM shows `failed` and keeps the attempt retryable without sending another copy.

### US2 — Truthful lifecycle and diagnostics (P2)

The operator can see whether the attempt is queued, button-clicked, Enter-fallback, confirmed, or failed.

### US3 — Safe replacement and rollback (P3)

The old GraphQL/synthetic-key path can be disabled behind a feature flag, and the new path can be rolled back without changing history data.

## Functional Requirements

- **FR-001**: System MUST create one immutable client attempt ID per CRM send.
- **FR-002**: System MUST persist pending before any browser action.
- **FR-003**: System MUST poll the active composer for up to 3 seconds using semantic DOM selectors, never coordinates.
- **FR-004**: System MUST click the accessible Messenger send control at most once.
- **FR-005**: System MUST verify composer clear or outgoing DOM/network confirmation after the click.
- **FR-006**: System MUST use a browser-level trusted Enter fallback at most once after click timeout.
- **FR-007**: System MUST not treat synthetic `KeyboardEvent` or `requestSubmit()` alone as delivery confirmation.
- **FR-008**: System MUST correlate confirmation before/after result events and handle duplicate Facebook IDs idempotently.
- **FR-009**: System MUST mark `sent` only after one correlated confirmation.
- **FR-010**: System MUST mark `failed` after bounded timeouts with stage-specific error codes.
- **FR-011**: System MUST gate the replacement path and allow rollback to the old path without deleting messages.
- **FR-012**: System MUST redact cookies, tokens, full message text, and private response bodies from diagnostics.

## Success Criteria

- **SC-001**: 10 sequential unique CRM sends create 10 recipient-visible Messenger messages and no duplicates.
- **SC-002**: Click success confirms within 3 seconds in 95% of connected test sends.
- **SC-003**: Click failure triggers exactly one Enter fallback; no attempt uses a second retry automatically.
- **SC-004**: DOM-before-result and result-before-DOM both converge to one `sent` record.
- **SC-005**: A failed send identifies `COMPOSER_NOT_FOUND`, `CLICK_TIMEOUT`, `CDP_ENTER_FAILED`, or `CONFIRMATION_TIMEOUT`.

## Scope

Text-only one-to-one Messenger conversations. Attachments, bulk sends, coordinate automation, and blind resend after reload are excluded.
