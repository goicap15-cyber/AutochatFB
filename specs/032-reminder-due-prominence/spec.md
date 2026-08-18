# Feature Specification: Reminder Due Prominence

**Feature Branch**: `032-reminder-due-prominence`  
**Created**: 2026-08-14  
**Status**: Draft  
**Input**: User description: Make due reminders much more prominent in the CRM conversation list.

## User Scenarios & Testing

### User Story 1 - Spot customers needing follow-up immediately (Priority: P1)

As a CRM operator, I can identify every visible conversation whose active reminder is due without reading small metadata chips, so I can act before missing a promised follow-up.

**Why this priority**: A reminder only provides value if it is immediately noticeable during normal inbox scanning.

**Independent Test**: Create one due reminder and one future reminder in the Inbox; the due card is visually distinct and its urgency is understandable at a glance.

**Acceptance Scenarios**:

1. **Given** a visible conversation has an active reminder due now or earlier, **When** I view the list, **Then** its card has a clear urgency treatment, bell indicator, and `CẦN NHẮC` label.
2. **Given** a conversation has an active reminder in the future, **When** I view the list, **Then** it remains visually calm and does not receive overdue treatment.
3. **Given** I select a due conversation, **When** it becomes active, **Then** both selected state and urgency remain understandable.

---

### User Story 2 - Reach due follow-ups before routine conversations (Priority: P1)

As a CRM operator, I see due reminders first among the conversations already visible under my current view, while filters, tabs, search and archive choices remain respected.

**Why this priority**: A due follow-up must not be buried below routine conversations.

**Independent Test**: Under an active tab, search and filter selection, create matching due and non-due conversations; only matching due conversations move to the top and relative order is preserved.

**Acceptance Scenarios**:

1. **Given** several conversations match the current view, **When** one or more are due, **Then** matching due conversations appear before matching non-due conversations.
2. **Given** two visible conversations are due, **When** they are shown, **Then** their existing activity ordering relative to each other is preserved.
3. **Given** a conversation does not match search, filters, tab or archive view, **When** its reminder becomes due, **Then** it is not injected into that view.

---

### User Story 3 - Understand how urgent a reminder is (Priority: P2)

As a CRM operator, I can tell whether a reminder is due now or overdue, and how long it has been overdue, so I can prioritize the most urgent follow-up.

**Why this priority**: Once a reminder is found, the operator needs enough context to decide which customer to contact first.

**Independent Test**: View reminders that are due now, 20 minutes overdue and 3 hours overdue; each urgency label is understandable without a tooltip or animation.

**Acceptance Scenarios**:

1. **Given** a reminder is overdue, **When** I view its card, **Then** I see concise Vietnamese text such as `Quá 20 phút` or `Quá 3 giờ`.
2. **Given** a reminder has just become due, **When** I view its card, **Then** I see `Đến hạn` rather than an inaccurate overdue duration.
3. **Given** reduced motion is enabled, **When** I view a due reminder, **Then** urgency remains clear without continuous animation.

### Edge Cases

- Missing or invalid reminder times are non-due and never break the list.
- Completed or cancelled reminders never receive due styling or priority.
- Due archived conversations retain existing archive-view membership rules.
- Long names, source chips and unread counts remain readable with the urgency treatment.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST identify an active reminder as due when its scheduled time is at or before the current time.
- **FR-002**: The system MUST give every due conversation a card-level urgency treatment that remains recognizable beside selected, unread, custom-status and source states.
- **FR-003**: The system MUST show a prominent bell indicator, `CẦN NHẮC` text, and concise Vietnamese relative urgency text for due conversations.
- **FR-004**: The system MUST order due conversations before non-due conversations only after applying existing archive, filter, workflow-tab and search membership rules.
- **FR-005**: The system MUST preserve the existing relative order inside each due and non-due group.
- **FR-006**: The system MUST respect reduced-motion preferences and must not rely on color or animation alone.
- **FR-007**: The system MUST not add, alter, complete, cancel or reschedule reminders as a result of this enhancement.

### Key Entities

- **Active reminder**: Existing follow-up reminder for one conversation, including scheduled time and active status.
- **Due presentation state**: Derived view state for due condition and urgency wording.
- **Visible conversation set**: Conversations that already match the current tab, search, filters and archive view.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An operator can identify all due reminders among 20 visible conversations within 5 seconds without opening a conversation.
- **SC-002**: In a list containing due and non-due matching conversations, 100% of due conversations appear first.
- **SC-003**: Due treatment remains understandable with animation disabled and while selected.
- **SC-004**: Existing filter, search, tab, archive and campaign-selection membership remains unchanged; only order and presentation of due items change.

## Assumptions

- Existing follow-up data continues to provide active reminder time and status with each conversation.
- The enhancement applies to all CRM layouts sharing the conversation list.
- Vietnamese relative time updates on normal list refreshes; a live second-by-second clock is outside scope.
- No sound, browser notification, extra permission or new persisted field is required.
