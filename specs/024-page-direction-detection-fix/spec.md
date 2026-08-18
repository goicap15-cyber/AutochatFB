# Feature Specification: Page Direction Detection Fix

**Feature Branch**: 024-page-direction-detection-fix
**Created**: 2026-08-10
**Status**: Draft

**Input**: In Page thread 100092115712908, six messages the Page sent (what, ok khong, 123456, 31321, dadadadada, khoai qua) were displayed in the CRM as incoming. Business Suite shows all six as right-aligned blue Page messages. The rows were manually corrected once as a stopgap, with backup data/database.db.bak_fix-direction-flip-2026-08-10T06-35-26-441Z, but the live geometry heuristic can still re-flip them.

## User Stories

### US1 - Evidence-backed direction classification (P1)

Given a Page message visible in Business Suite, the CRM classifies Page-sent messages as outgoing and contact-sent messages as incoming, including when the currently mounted virtualized window contains messages from only one side.

### US2 - Unknown direction is safe and durable (P1)

Given a message whose geometry is unavailable or ambiguous, the capture path does not silently treat it as an incoming message and does not lose it when the DOM window changes or the extension restarts.

### US3 - Existing rows do not regress (P1)

Given an existing message with a verified direction, a weak or unknown observation does not change the stored direction. A high-confidence disagreement can correct the row through the existing hysteresis policy.

### US4 - Existing capture behavior remains intact (P2)

Personal Messenger capture, duplicate prevention, chronological ordering, Page outbound sending, and feature 023 message eligibility continue to work.

## Functional Requirements

- **FR-001**: The research evidence in research.md MUST document the one-sided virtualization failure before implementation.
- **FR-002**: isMessageOutgoing MUST have an explicit unknown result when the input element or required geometry is unavailable. Unknown MUST NOT be represented as false.
- **FR-003**: Direction detection MUST use container-relative edge evidence. If the message-list container is unavailable or edge distances are ambiguous, the result MUST be unknown; the implementation MUST NOT guess via a global midpoint.
- **FR-004**: A captured Page message with unknown or ambiguous direction MUST be retained as a persisted pending-direction message keyed by fb_message_id when available. It MUST NOT be dropped merely because direction is not known yet.
- **FR-005**: The messages table MUST keep is_outgoing as a non-null boolean for compatibility. Pending rows MUST use a documented storage placeholder and a separate direction_status value; the placeholder MUST NOT be used by the UI as confirmed incoming direction.
- **FR-006**: A pending row MUST be promoted to confirmed only after high-confidence direction evidence. A high-confidence disagreement with an already-confirmed row follows the existing two-observation hysteresis and updates the row in place by fb_message_id.
- **FR-007**: Repeated scans of one Facebook message MUST update one row and MUST NOT create duplicate messages, including while its direction is pending.
- **FR-008**: The backend and UI MUST expose and honor direction_status so pending rows are rendered neutrally rather than as contact-sent messages.
- **FR-009**: The six known messages in thread 100092115712908 MUST be verified after implementation. The existing backup and current database state are evidence to inspect, not permission for a blanket update.
- **FR-010**: The personal content.js path, outbound queue, timestamp ordering, and feature 023 containment behavior MUST NOT regress.

## Key Entities

- **Captured Page Message**: transport object with Facebook identity, content, timestamp, direction result, and direction confidence.
- **Persisted Message**: existing messages row with non-null is_outgoing and new direction_status.
- **Direction Evidence**: container/bubble geometry and classifier result.
- **Direction State**: confirmed or pending.

## Success Criteria

- **SC-001**: The six known Page messages classify as outgoing in the narrow-window reproduction, observed in live extension diagnostics.
- **SC-002**: A geometry-unknown message is retained as pending and later promotes to the correct direction without a duplicate row.
- **SC-003**: A weak observation never changes a confirmed row; a repeated high-confidence disagreement still self-corrects.
- **SC-004**: The six known rows remain outgoing after 10 minutes of normal scanning and one server/extension restart.
- **SC-005**: At least two other Page threads meet the feature 010 direction, order, and duplicate criteria, and personal Messenger remains unchanged.

## Scope and Assumptions

In scope: page_content.js, background bridge forwarding, server ingest, ConversationRepository reconciliation, messages schema migration, and ChatArea pending rendering.

Out of scope: personal content.js direction logic, outbound queue/send implementation, timestamp algorithm changes, and feature 023 container eligibility logic.

Assumes Business Suite container bounds are available for a real message-list region. If they are unavailable for a scan, the message is retained pending rather than guessed as incoming.
