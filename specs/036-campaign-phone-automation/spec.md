# Feature Specification: Campaign Phone Automation

**Feature Branch**: `036-campaign-phone-automation`
**Created**: 2026-08-14
**Status**: Draft
**Input**: Make phone-number capture a visible campaign automation: customers who supply a valid number are automatically marked with the selected status such as `Đã có số`, stopped or thanked as chosen, and can be found immediately through the CRM status filter. Suppress duplicated Meta system notices captured by the Page observer.

## User Scenarios & Testing

### User Story 1 - Configure phone-result automation while creating a campaign (Priority: P1)

As a campaign operator, I can see and configure what happens when a recipient sends a phone number before I create the campaign, without having to discover a hidden advanced setting.

**Why this priority**: The sales workflow only becomes automatic when the operator can deliberately choose the target status and follow-up behaviour once for the campaign, rather than editing contacts one at a time.

**Independent Test**: Create a campaign with an existing `Đã có số` status, choose “mark status and stop remaining messages”, and reopen the campaign to confirm the selected policy and target status are clearly shown.

**Acceptance Scenarios**:

1. **Given** at least one reusable customer status exists, **When** an operator creates a campaign, **Then** they see a dedicated “Khi khách gửi số điện thoại” section before creating the snapshot.
2. **Given** a status named `Đã có số` exists, **When** the section opens, **Then** it is presented as the recommended target but the operator can select another status or choose not to change status.
3. **Given** the operator selects “dừng các tin chưa gửi” or “cảm ơn rồi dừng”, **When** they save the campaign, **Then** the target status and chosen action are retained and displayed in the campaign details.
4. **Given** no target status is chosen, **When** the operator saves the campaign, **Then** the campaign remains valid but the UI plainly says that the number will be saved without automatic status change.

---

### User Story 2 - See and filter converted leads automatically (Priority: P1)

As a campaign operator, when any of 100 recipients supplies a valid phone number, I immediately see that customer marked with the configured status in the conversation list and can filter all such customers without manual contact edits.

**Why this priority**: The operator needs an actionable conversion list, not just a phone value buried in contact details.

**Independent Test**: Run a multi-recipient campaign configured with target status `Đã có số`; send a valid incoming number for several recipients; confirm their sidebar chips update live and the status filter returns exactly those recipients.

**Acceptance Scenarios**:

1. **Given** a running campaign configured with a target status, **When** a recipient sends a valid incoming number, **Then** their contact, open detail panel and conversation-list status update to that status without a page reload.
2. **Given** several campaign recipients received the target status, **When** the operator opens the conversation filter and selects that status, **Then** only matching conversations are shown.
3. **Given** a customer phone is captured outside a campaign, **When** no explicit automation policy applies, **Then** the CRM saves the number and provenance but leaves the current status unchanged.
4. **Given** an already-dispatched campaign message exists, **When** capture arrives, **Then** the UI/audit records only future-work suppression and never claims the sent message was recalled.

---

### User Story 3 - Keep Page inbox history free from repeated Meta notices (Priority: P2)

As a CRM operator, I see a clean conversation history even when the Page observer re-renders a Meta system notification repeatedly.

**Why this priority**: Repeated notices hide real customer replies and make campaign conversion review unreliable.

**Independent Test**: Load/re-render a Page thread containing “Đã tự động tạo hoạt động về khách hàng tiềm năng cho bạn dựa trên cuộc trò chuyện này.” and confirm it never creates a CRM message; send a genuine customer message with no Facebook ID and confirm it is not discarded merely for lacking an ID.

**Acceptance Scenarios**:

1. **Given** the known Meta lead-activity notice is observed one or many times, **When** the observer sends it to CRM, **Then** CRM does not persist or display it as a customer message.
2. **Given** a different recognised non-customer/system notice is re-observed without a message identity, **When** it reappears during the short observer re-render window, **Then** it creates at most one display record.
3. **Given** a genuine incoming customer text has no Facebook message ID, **When** it is observed, **Then** it remains eligible for normal persistence and phone capture.

### Edge Cases

- A campaign can intentionally choose to capture only; it must not silently cancel recipients or assign a status.
- A target status may be deleted after campaign setup; phone capture and safe stop still complete, and the audit explains the missing target.
- A contact that already has manual/legacy phone data is never silently overwritten; any new number remains a dated candidate.
- The recommended `Đã có số` choice must match status names case-insensitively and handle there being zero or multiple matching names predictably.
- System-notice suppression must be exact/semantic and must not treat arbitrary human messages as Meta notices.

## Requirements

### Functional Requirements

- **FR-001**: Campaign creation and editable campaign draft views MUST surface a first-class “Khi khách gửi số điện thoại” configuration section, separate from generic pacing/retry settings.
- **FR-002**: The section MUST let the operator choose capture-only, stop remaining messages, or thank then stop; it MUST show the currently selected target status and thank-you text where relevant.
- **FR-003**: When a reusable status named `Đã có số` exists, the UI MUST recommend it as the target; choosing it remains an explicit, reviewable campaign choice.
- **FR-004**: Before preview/start, the UI MUST summarize whether status automation is enabled and what will happen to remaining campaign messages.
- **FR-005**: On a valid incoming capture for a matching running campaign, the CRM MUST apply the selected target status using the existing safe capture-policy action and publish the resulting contact/status state to all active CRM views.
- **FR-006**: Conversation-list status chips and the existing status filter MUST reflect the published target status without requiring refresh or manual contact saving.
- **FR-007**: A phone captured outside a campaign, or in a campaign with capture-only/no target status, MUST not have its contact status changed automatically.
- **FR-008**: Campaign audit history MUST use understandable Vietnamese outcome labels for capture, status applied/unavailable, safe stop, thank-you queued/confirmed/failed.
- **FR-009**: The system MUST suppress the known Meta automatic-lead-activity notice before ordinary message persistence and must be resilient to observer re-render duplicates of recognised system notices lacking a message ID.
- **FR-010**: System-notice handling MUST not suppress genuine customer messages solely because they lack a Facebook message ID.
- **FR-011**: Existing manual/legacy phone protection, number provenance, campaign action idempotency and outbound confirmation behaviour MUST remain unchanged.

### Key Entities

- **Campaign phone-result policy**: The operator’s visible choice for capture-only, safe stop, or thank-and-stop and its optional target customer status.
- **Recommended target status**: A reusable status whose name represents having received a phone number; it is a UI recommendation, not a new status category.
- **Contact conversion update**: The realtime contact/status change emitted after an accepted campaign policy action.
- **Observer system notice**: A non-customer Meta UI message that must not become CRM conversation history.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a 100-recipient campaign configured with a target status, 100% of test recipients who send a valid number before their next undispatched message show the target status in the CRM list without reload.
- **SC-002**: Selecting the target status in the conversation filter returns exactly the test recipients that received the automatic update.
- **SC-003**: An operator can determine the campaign’s number-handling outcome and target status before preview in one visible section, without opening generic advanced settings.
- **SC-004**: Repeated observer rendering of the known Meta activity notice creates zero CRM conversation messages.
- **SC-005**: All existing number provenance, manual-phone protection, campaign policy and message-persistence automated tests continue to pass.

## Assumptions

- The existing per-campaign phone-capture policy and custom status model remain the source of truth; this feature improves discoverability and realtime presentation rather than introducing a global automatic status rule.
- `Đã có số` is a recommended Vietnamese status name, not a mandatory immutable system status.
- A campaign operator chooses the behaviour once per campaign; no per-recipient manual filtering or state update is required afterward.
- The Page observer can identify the known Meta notice by stable wording/semantic marker before it reaches ordinary incoming-message handling.
