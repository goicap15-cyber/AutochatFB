# Feature Specification: Phone Capture Automation

**Feature Branch**: `035-phone-capture-automation`
**Created**: 2026-08-14
**Status**: Draft
**Input**: User description: Detect valid Vietnamese mobile numbers sent by customers, retain their source date, and optionally stop or acknowledge a campaign response.

## User Scenarios & Testing

### User Story 1 - Capture a customer's valid phone number (Priority: P1)

As a CRM operator, when a customer sends a valid Vietnamese mobile number in an incoming Messenger message, I see that number saved to the customer record with the date and message from which it was obtained.

**Why this priority**: Capturing a usable phone number is the core business outcome; no campaign automation is valuable if the CRM cannot reliably recognise and retain it.

**Independent Test**: Send an incoming message containing a valid mobile number in common Vietnamese formats and confirm the correct normalized number, source message and original message date appear on the matching contact.

**Acceptance Scenarios**:

1. **Given** a customer sends `0345 678 901`, `034.567.8901`, `+84 345 678 901`, or `84 345 678 901`, **When** that message is first saved, **Then** the CRM recognizes the same normalized domestic number `0345678901`.
2. **Given** an incoming message has a 10-digit sequence with an invalid mobile prefix, **When** it is saved, **Then** the CRM does not store it as a customer phone number.
3. **Given** a valid number has been captured, **When** an operator opens that customer, **Then** the number, source message reference and message date/time are visible.
4. **Given** the extension replays an already stored incoming message, **When** it reaches the server again, **Then** no duplicate capture or automation action is created.

---

### User Story 2 - Preserve trustworthy contact data (Priority: P1)

As a CRM operator, I can safely keep or correct a customer phone number without automatic extraction silently overwriting a number staff already entered.

**Why this priority**: A wrong overwrite would make a real lead less useful than no automation.

**Independent Test**: Save a manual phone number, receive a different valid number from the customer, and verify that the existing value remains while the new number is available as a dated candidate.

**Acceptance Scenarios**:

1. **Given** a contact has no phone number, **When** its first valid incoming number is captured, **Then** it becomes the displayed phone and is labelled as message-captured.
2. **Given** a contact has a manual or legacy phone, **When** a different valid number arrives, **Then** the existing number is not replaced automatically and the new value is available as a dated candidate.
3. **Given** an operator accepts a candidate or edits the phone field, **When** they save, **Then** the displayed number reflects that choice while capture history remains auditable.
4. **Given** a message contains the same valid number already known for that contact, **When** it is saved, **Then** the CRM creates no duplicate candidate.

---

### User Story 3 - Stop follow-up safely after a number arrives (Priority: P2)

As a campaign operator, I can choose what a campaign does after a recipient supplies a phone number: continue normally, stop remaining messages, or send one approved thank-you and then stop. I can also choose a target status such as `Đã có số`.

**Why this priority**: This turns captured contact data into a respectful sales workflow without unnecessary follow-ups.

**Independent Test**: Start a multi-message campaign with stop enabled, have a recipient send a valid number before their next message, and verify no later campaign message is sent and the configured status is applied.

**Acceptance Scenarios**:

1. **Given** a campaign uses the default policy, **When** a recipient sends a valid number, **Then** the CRM captures the number but sends no acknowledgement and does not alter campaign progress.
2. **Given** a campaign uses stop-after-capture, **When** a recipient supplies a valid number before their next undispatched message, **Then** no remaining campaign message is sent to that recipient and the timeline explains why.
3. **Given** a campaign uses thank-and-stop, **When** the number is captured, **Then** exactly one approved acknowledgement uses the normal confirmed sending flow and remaining work is stopped only after that acknowledgement is safely recorded.
4. **Given** a configured status is available, **When** capture triggers the policy, **Then** the contact moves to it; if it was removed, capture and stop still complete and the audit records the unavailable status.
5. **Given** a message was already dispatched before capture is received, **When** policy runs, **Then** the CRM never claims to recall it and prevents only undispatched work.

### Edge Cases

- Only incoming customer text is eligible; staff, system and outgoing campaign text never trigger detection.
- The detector accepts ordinary spaces, dots, hyphens and parentheses, but does not join arbitrary digits inside a longer identifier.
- One message may contain several valid candidates; all are retained in history.
- `+84` and `84` forms normalize to domestic `0xxxxxxxxx`.
- Future prefix changes are configurable and versioned.
- Unavailable route/status, thank-you failure or simultaneous worker activity has an auditable result and cannot create duplicate acknowledgement.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST recognize only whitelisted Vietnamese mobile prefixes after normalizing permitted domestic and `+84`/`84` forms to 10 digits.
- **FR-002**: The active whitelist MUST include `032–039`, `052`, `055`, `056`, `058`, `059`, `070`, `076–079`, `081–089`, `090–094`, and `096–099`; newly allocated values such as `095` MUST be enableable through configuration with an effective date or activation state.
- **FR-003**: The system MUST reject malformed values, invalid prefixes, wrong normalized lengths, and number fragments embedded in longer digit sequences.
- **FR-004**: The system MUST extract only from first-time persisted incoming customer messages and make capture processing idempotent by source message and normalized number.
- **FR-005**: For every recognized candidate, the system MUST retain normalized value, original presentation, source message identity, message timestamp, detection timestamp and extraction-rule version.
- **FR-006**: The system MUST fill an empty contact phone with a valid capture, but MUST NOT automatically replace an existing manual, legacy or confirmed phone.
- **FR-007**: The system MUST show current number, acquisition date/source and alternative dated candidates, with a deliberate accept/replace action.
- **FR-008**: Manual contact editing, exports and `Có số điện thoại` filtering MUST continue to use the selected current contact phone.
- **FR-009**: Each campaign MUST support `continue`, `stop_remaining`, or `thank_then_stop`; default MUST be `continue`.
- **FR-010**: Stop/thank policies MUST apply only to remaining undispatched work for the matching recipient and MUST create an audit event tied to the capture.
- **FR-011**: A thank-you MUST use the existing trusted outbound confirmation path and be idempotent across sync replay, retry and restart.
- **FR-012**: A campaign policy MAY name an existing target status. The system MUST not create, rename or delete statuses automatically.
- **FR-013**: The system MUST clearly report failed status/acknowledgement application while preserving capture evidence and campaign audit.

### Key Entities

- **Phone capture**: Immutable evidence that a valid candidate appeared in one incoming message, including original text and message time.
- **Current contact phone**: The selected number used in routine CRM work and export.
- **Phone candidate**: A captured value different from the current phone that awaits an operator decision.
- **Campaign phone-capture policy**: Explicit per-campaign continuation, stop or thank-and-stop choice with optional target status.
- **Campaign phone-capture action**: Idempotent audited reaction for one campaign recipient and one capture.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All approved valid-format examples are captured and displayed normalized on first incoming-message ingestion.
- **SC-002**: 100% of invalid-prefix, wrong-length and longer-identifier test examples leave current contact phone unchanged.
- **SC-003**: An operator can find source date and source message for a captured number in one contact view without searching history manually.
- **SC-004**: Under stop policy, 100% of still-undispatched messages for a matched recipient are prevented after successful action.
- **SC-005**: Replaying the same incoming message creates zero duplicate capture records and zero duplicate thank-you sends.

## Assumptions

- A valid mobile number is plausible contact data, not proof the sender owns or uses it.
- Supported Messenger/Page routes continue to provide durable incoming-message identities and timestamps.
- Default behaviour is capture only: no new message or campaign cancellation unless an operator selects a policy.
- The feature does not verify carrier activity and does not call external carrier services.
- Existing contacts with a phone but no provenance are protected legacy values.
