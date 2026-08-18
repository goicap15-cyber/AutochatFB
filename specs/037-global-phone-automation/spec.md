# Feature Specification: Global Phone Automation

**Feature Branch**: `037-global-phone-automation`  
**Created**: 2026-08-14  
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 — Configure a global number rule (P1)

As a CRM operator, I can enable or disable one workspace-wide rule and choose the status to apply when a customer sends a valid Vietnamese mobile number.

**Acceptance:** the rule starts disabled; enabling it requires an existing target status; disabling it preserves captured phone evidence but stops future automatic status changes.

### User Story 2 — Convert ordinary inbound conversations (P1)

As an operator, I do not need a campaign for a customer who messages a phone number to appear under the correct status and in status filtering.

**Acceptance:** a genuine inbound number stores its source/date and updates the status immediately; outgoing messages never trigger it; manual/legacy phone values are never overwritten.

### User Story 3 — Keep campaign intent explicit (P1)

As an operator, a campaign that deliberately selects its own target status remains more specific than the global default.

**Acceptance:** global automation runs first for broad coverage; an active campaign with a configured target status replaces it with its own selected status. A campaign without a target status inherits the global outcome.

## Functional Requirements

- FR-001: Operators can open a clearly labeled global phone-automation setting from CRM navigation.
- FR-002: The setting is disabled by default and requires a valid existing target status before it can be enabled.
- FR-003: A valid incoming customer number applies the enabled target status even outside campaigns.
- FR-004: Captured number provenance and manual/legacy phone protection remain unchanged.
- FR-005: An active campaign target status has priority over the global target.
- FR-006: The existing live contact update, sidebar chip, and status filter reflect the resulting status without reload.
- FR-007: Invalid, outgoing, or system messages never trigger the rule.

## Success Criteria

- A user can enable the rule and choose a status in one modal without editing a contact.
- 100% of tested valid inbound numbers outside campaigns receive the configured status while enabled.
- 0 tested messages from CRM/agents change status through this rule.
- All existing persistence and UI build checks remain green.

## Assumptions

- The workspace has one shared local CRM operator configuration.
- Existing campaign phone policy stays intact and is more specific only when it supplies a target status.
