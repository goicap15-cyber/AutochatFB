# Feature Specification: Advanced Conversation Filters

**Feature Branch**: `033-advanced-conversation-filters`  
**Created**: 2026-08-14  
**Status**: Draft  
**Input**: User description: The conversation filter needs many more choices and a way to filter manually.

## User Scenarios & Testing

### User Story 1 - Apply practical CRM filters (Priority: P1)

As a CRM operator, I can filter conversations by source/account, workflow state, customer state, labels, unread state, reminder state, archive scope, latest activity and contact completeness, so I can focus on the right customers.

**Why this priority**: Source and customer state alone are insufficient for daily follow-up and sales work.

**Independent Test**: With a mixed inbox, choose one option from several groups and confirm every remaining conversation satisfies all chosen groups while multiple values inside the same group work as alternatives.

**Acceptance Scenarios**:

1. **Given** the filter is open, **When** I choose sources, workflow states, customer states or labels, **Then** I can choose one or more values in each group.
2. **Given** I choose multiple values in one group and values in another group, **When** I apply, **Then** any selected value within a group matches, while selected groups all must match.
3. **Given** I choose contact completeness, reminder state, unread state, archive scope or latest-activity range, **When** I apply, **Then** the list reflects that condition without changing CRM data.

---

### User Story 2 - Use quick filters for recurring work (Priority: P1)

As a CRM operator, I can activate clear quick filters for Cần nhắc, Chưa đọc, VIP and Cần xử lý without assembling conditions manually.

**Why this priority**: Common daily work should take one click instead of navigating a large filter form.

**Independent Test**: Turn on each quick filter in an inbox with matching and nonmatching conversations; verify the result and active indication are correct.

**Acceptance Scenarios**:

1. **Given** the filter is open, **When** I choose Cần nhắc, **Then** conversations with an active due reminder are shown.
2. **Given** I choose Chưa đọc or VIP, **When** I apply, **Then** only unread or VIP-tagged conversations are shown respectively.
3. **Given** I choose Cần xử lý, **When** I apply, **Then** conversations in Chưa xử lý or Đang xử lý workflow states are shown.
4. **Given** a quick filter and advanced conditions are selected, **When** I apply, **Then** both constraints are respected and visible in the active-filter summary.

---

### User Story 3 - Build a manual condition (Priority: P2)

As a CRM operator, I can add and remove manual rules by choosing a field, an operator and a value, so I can target a precise customer segment not covered by quick filters.

**Why this priority**: The CRM must support ad hoc segmentation without requiring a developer to add a new preset for every question.

**Independent Test**: Add a label rule, an activity-date rule and a contact-information rule; apply them together, edit or remove one, and verify the result changes only after applying.

**Acceptance Scenarios**:

1. **Given** the filter is open, **When** I add a manual condition, **Then** I can choose an available field and see only compatible operators and value inputs.
2. **Given** multiple manual conditions, **When** I apply, **Then** every valid condition must match.
3. **Given** a manual condition is incomplete or invalid, **When** I try to apply, **Then** it is clearly identified and does not silently produce misleading results.
4. **Given** I edit then cancel or close the filter, **When** I return to the inbox, **Then** the prior applied conditions and list are unchanged.

### Edge Cases

- A tag, lead status or inbox source removed after it was selected is discarded safely at apply time and explained in the active summary if needed.
- Missing contact data is treated as not having that field; malformed tags and dates do not crash filtering.
- No results retains a clear empty state with a direct way to edit or clear filters.
- Search, workflow tabs, reminder priority, campaign selection and keyboard navigation continue to operate on the resulting visible list.
- On narrow screens and 200% zoom the filter becomes a scrollable dialog/drawer rather than an off-screen popover.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide filter groups for source/account, workflow state, customer state, labels, unread state, reminder state, archive scope, latest activity and contact completeness.
- **FR-002**: The system MUST provide quick filters Cần nhắc, Chưa đọc, VIP and Cần xử lý.
- **FR-003**: The system MUST provide manual rules with a field, compatible operator and value, supporting at least label membership, contact completeness and latest-activity date conditions.
- **FR-004**: Multiple values within one selectable group MUST use OR matching; selected groups and manual rules MUST use AND matching.
- **FR-005**: The system MUST apply existing search, workflow tabs and archive visibility before showing the final matching list, and then preserve existing due-reminder priority.
- **FR-006**: The filter MUST keep applied and draft state separate; only Apply alters the list. Cancel, Escape, close and outside click discard draft changes.
- **FR-007**: The system MUST show an understandable active-filter count and summary, support clearing all filters, and make quick/manual selections discoverable by keyboard and screen reader.
- **FR-008**: The system MUST make required contact and tag data available to the current conversation list without creating additional per-filter network requests.
- **FR-009**: The feature MUST not write to conversations, contacts, reminders, statuses, labels or archive state.

### Key Entities

- **Applied filter**: Confirmed set of quick selections, grouped choices and manual rules defining the current list.
- **Filter draft**: Editable copy of the applied filter, discarded unless Apply is chosen.
- **Manual rule**: One field, operator and value used for a precise condition.
- **Filterable conversation summary**: Existing conversation data enriched with labels and contact-presence signals needed for client-side matching.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An operator can apply any one quick filter in no more than two primary actions.
- **SC-002**: An operator can construct and apply a three-condition manual filter in under one minute.
- **SC-003**: In all automated matching scenarios, 100% of visible conversations satisfy every selected group and manual condition.
- **SC-004**: Cancel, Escape, close and outside click preserve the previous applied filter and visible list in 100% of tested cases.
- **SC-005**: No extra data request is made solely when a user changes, applies or clears a filter.

## Assumptions

- The existing keyword search remains in the sidebar and is not duplicated as a manual condition in this increment.
- Latest activity supports common presets and an inclusive custom date range; it uses the CRM local time display convention.
- Archive scope replaces the separate archive-view toggle so all list visibility choices can be reviewed in one place.
- Filter configuration remains in the current browser session; saved reusable views are outside this increment.
