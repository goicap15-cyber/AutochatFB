# Feature Specification: Page Messaging Extension Sync

**Feature Branch**: `009-page-extension-sync`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Replace the current Meta Webhook/API approach for Facebook Pages with a Chrome Extension (DOM/CDP) approach. This will unify the messaging architecture (both Personal and Page messenger use the extension) to bypass the 24-hour API limit and prevent API bans. Crucially, a central Queue system with simulated human delays must be implemented to prevent Facebook from flagging the account for simultaneous multi-tab actions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Centralized Message Queue (Priority: P1)

When an operator in the CRM sends messages to multiple customers across different Pages at the same time, the system places all these outgoing messages into a single queue. The Chrome Extension processes this queue sequentially, simulating human delays between each action, rather than executing them simultaneously.

**Why this priority**: Essential to avoid Facebook anti-spam bans caused by superhuman simultaneous actions across multiple tabs.

**Independent Test**: Can be tested by firing 5 outgoing messages to 5 different pages instantly. The logs should show them being queued and processed one by one with a few seconds of delay in between.

**Acceptance Scenarios**:

1. **Given** an operator clicks "Send" on 3 different conversations simultaneously, **When** the backend receives these requests, **Then** it places them in a queue and does not send them to the extension immediately all at once.
2. **Given** the extension is processing the queue, **When** it finishes sending Message 1, **Then** it waits a random human-like delay (e.g., 2-5 seconds) before starting to process Message 2.
3. **Given** the extension processes a message, **When** it executes the typing and sending actions, **Then** it focuses the correct background tab representing that specific Page's inbox.

---

### User Story 2 - Receive Realtime Page Messages via Extension (Priority: P1)

The CRM receives incoming messages from connected Facebook Pages in real-time by reading the DOM in background tabs managed by the Chrome extension, completely replacing the Meta Webhook.

**Why this priority**: To maintain real-time capabilities without relying on Meta's official API, which requires HTTPS tunnels, App Reviews, and strict policy compliance.

**Independent Test**: Send a message to a Page from a test account. The CRM should receive it within a few seconds without any webhook events hitting the server.

**Acceptance Scenarios**:

1. **Given** a Page is connected via the extension, **When** a customer sends a message to the Page, **Then** the extension detects the DOM change in the background tab and forwards the message to the CRM.
2. **Given** the extension is running, **When** multiple Pages are being managed, **Then** it maintains the necessary background connections to listen to all of them simultaneously without active user intervention.

---

### User Story 3 - Send Page Messages beyond 24 Hours (Priority: P2)

An operator can reply to a Page conversation from the CRM even if the last customer interaction was more than 24 hours ago, and the message will be delivered successfully without Meta API blocks.

**Why this priority**: Bypassing the 24-hour limit is one of the primary reasons for migrating to this architecture.

**Independent Test**: Reply to a conversation older than 24 hours. It should succeed without any "Outside 24-hour window" API errors.

**Acceptance Scenarios**:

1. **Given** a Page conversation is older than 24 hours, **When** the operator types a reply and sends, **Then** the message is queued and successfully sent via the extension.
2. **Given** the system previously blocked 24-hour+ messages, **When** the new extension sync is active, **Then** the CRM UI no longer shows a hard block or warning preventing the operator from sending.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST process all outgoing messages through a centralized queue on the backend before handing them to the extension.
- **FR-002**: The extension MUST enforce a randomized, human-like delay (e.g., 2-5 seconds) between sending consecutive messages to prevent spam detection.
- **FR-003**: System MUST NOT use `PageMessengerAdapter.js` or the Meta Webhook (`/webhook`) for receiving or sending Page messages once this feature is active.
- **FR-004**: The extension MUST support monitoring multiple Facebook Page inboxes simultaneously via background tabs or offscreen documents.
- **FR-005**: The extension MUST correctly identify which background tab belongs to which Page ID when dispatching a send action (`dispatchTrustedEnter`).
- **FR-006**: System MUST parse the DOM of Business Suite or the Page Inbox to extract incoming message data (sender ID, message text, timestamp) equivalent to what the webhook previously provided.
- **FR-007**: System MUST provide feedback to the CRM UI if a queued message fails to send (e.g., DOM element not found).

### Key Entities

- **Message Queue**: A sequential list of pending outgoing messages stored in the backend (memory or database) to control the rate of sending.
- **Extension Tab Registry**: A mapping maintained by the extension that links a Facebook Page ID to a specific Chrome tab ID, used for routing send commands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of outgoing Page messages bypass the Meta Send API and are sent via the Chrome extension.
- **SC-002**: 100% of incoming Page messages are received via DOM reading by the Chrome extension, with webhook endpoints disabled.
- **SC-003**: The system can successfully deliver messages to customers who last interacted more than 24 hours ago.
- **SC-004**: When 10 messages are triggered simultaneously, the system spreads their actual delivery over a minimum of 20 seconds to simulate human behavior, preventing simultaneous cross-tab actions.

## Assumptions

- The Meta Business Suite DOM structure is relatively stable, but we assume it may change over time requiring maintenance of the DOM selectors in `content.js`.
- The host machine running the Chrome extension has sufficient RAM and CPU to keep multiple background tabs alive for all managed Pages.
- A single Facebook account has admin access to all the Pages being managed, and this account is actively logged in on the Chrome browser running the extension.
