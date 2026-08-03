# Feature Specification: Outbound Messaging Pipeline Hardening

**Feature Branch**: `005-outbound-pipeline-hardening`
**Created**: 2026-08-03
**Status**: Draft

## User Stories

### US1 — One CRM send becomes one Messenger message (P1)

Given a connected Facebook account and open thread, sending one unique text from CRM must create exactly one recipient-visible Messenger message and exactly one CRM `sent` record.

**Acceptance**: API failure falls back to DOM send; DOM button is waited for and clicked; if not confirmed, Enter/form submit is attempted once; confirmation is correlated without duplicate rows.

### US2 — Truthful state and diagnostics (P2)

The operator sees `pending`, `sent`, or `failed` with the actual pipeline stage and can retry only failed attempts.

**Acceptance**: GraphQL, composer click, Enter fallback, confirmation timeout, and persistence errors are distinguishable; no GraphQL error masks a composer error.

### US3 — Race-safe idempotency (P3)

Out-of-order DOM events, send results, reconnects, and duplicate Facebook IDs never create a second message or crash the WebSocket handler.

**Acceptance**: DOM-before-result, result-before-DOM, duplicate ID, and two sequential sends each produce one final record.

## Functional Requirements

- **FR-001**: Generate one immutable `client_message_id` per send attempt.
- **FR-002**: Persist `pending` before dispatching to the extension.
- **FR-003**: Attempt GraphQL, then poll for the semantic Messenger send control for a bounded period.
- **FR-004**: Click `[role="button"][aria-label="Nhấn Enter để gửi"]` (or equivalent localized semantic selector), never screen coordinates.
- **FR-005**: If click does not clear/confirm the composer, attempt Enter/form submit at most once.
- **FR-006**: Treat a send as `sent` only after official ID or correlated DOM/network confirmation.
- **FR-007**: Correlate confirmations before and after `SEND_MESSAGE_RESULT` without ordering assumptions.
- **FR-008**: Handle existing `fb_message_id` collisions as idempotent duplicates, never as an uncaught exception.
- **FR-009**: Preserve failed attempts and expose retry with a new client ID.
- **FR-010**: Preserve stage-specific diagnostics without logging tokens or cookies.
- **FR-011**: Build and load the exact extension artifact used by the E2E test.

## Success Criteria

- **SC-001**: 10 sequential unique CRM sends produce 10 and only 10 recipient-visible messages.
- **SC-002**: DOM-before-result and result-before-DOM both converge to `sent` within 3 seconds.
- **SC-003**: Replaying a confirmation 10 times creates no duplicate and no WebSocket exception.
- **SC-004**: A failed click falls back to Enter once; it never sends two copies.
- **SC-005**: Every failed test identifies one stage: `GRAPHQL`, `COMPOSER_CLICK`, `ENTER_SUBMIT`, `CONFIRMATION`, or `CORRELATION`.

## Scope and Assumptions

Text-only one-to-one conversations are in scope. Attachments, bulk broadcast, coordinate automation, and blind resend after reload are out of scope.
