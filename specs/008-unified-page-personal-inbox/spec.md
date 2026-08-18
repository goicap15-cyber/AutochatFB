# Feature Specification: Unified Page & Personal Inbox

**Feature Branch**: `008-unified-page-personal-inbox`

**Created**: 2026-08-05

**Status**: Draft

**Input**: CRM unified inbox combining personal Messenger (via Chrome extension) and Facebook Page Messenger (via Meta Webhook/API) into a single conversation list with source-aware filtering, routing, and sending.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View All Conversations in One Unified Inbox (Priority: P1)

A CRM operator opens the dashboard and sees all conversations—both from personal Messenger accounts and from Facebook Pages—in a single, unified thread list. Each conversation clearly shows which source it belongs to (e.g., "Messenger cá nhân · Acc A" or "Page · MissPrice").

**Why this priority**: This is the core value of the feature. Without a unified view, operators must switch between multiple dashboards, reducing efficiency and increasing response time.

**Independent Test**: Can be tested by connecting 1 personal Messenger account and 1 Page, then verifying both appear in the same thread list with correct source labels.

**Acceptance Scenarios**:

1. **Given** an operator has connected 1 FB personal account and 2 Pages, **When** they open the CRM inbox, **Then** they see conversations from all 3 sources in one list, each with a visible source badge
2. **Given** a new message arrives on Page "MissPrice", **When** the operator views the inbox, **Then** the conversation appears with the label "Page · MissPrice" and is sorted by recency
3. **Given** a new personal Messenger message arrives, **When** the operator views the inbox, **Then** the conversation appears with the label "Messenger cá nhân · [Account Name]"

---

### User Story 2 - Filter Conversations by Source (Priority: P1)

An operator can filter the conversation list by source type (All, Personal Messenger, Page) and by specific source (e.g., "Page: MissPrice", "Account: Acc A") to focus on a subset of conversations.

**Why this priority**: With potentially hundreds of conversations across 6+ sources, filtering is essential for efficient workflow management.

**Independent Test**: Can be tested by selecting different filter options and verifying the thread list updates accordingly with correct counts.

**Acceptance Scenarios**:

1. **Given** conversations exist from both personal and Page sources, **When** the operator selects "Page" filter, **Then** only Page conversations are shown
2. **Given** multiple Pages are connected, **When** the operator selects "Page: MissPrice", **Then** only MissPrice conversations appear
3. **Given** the "Tất cả nguồn" filter is active, **When** the operator views the list, **Then** all conversations from all sources appear

---

### User Story 3 - Receive Realtime Page Messages via Webhook (Priority: P1)

When a customer sends a message to a connected Facebook Page, the CRM receives the message in real-time via Meta webhook and displays it in the correct Page conversation thread.

**Why this priority**: Realtime message reception is fundamental to a CRM inbox. Without it, operators would not know when customers contact Pages.

**Independent Test**: Can be tested by sending a message to a connected Page from a test Facebook account and verifying it appears in the CRM within seconds.

**Acceptance Scenarios**:

1. **Given** a Page "MissPrice" is connected with a valid webhook, **When** a customer sends "Hello" to MissPrice, **Then** the CRM shows the message in the correct thread within 3 seconds
2. **Given** the same webhook event is delivered twice by Meta, **When** the CRM processes both, **Then** only one message is persisted (deduplication by message ID)
3. **Given** the webhook receives a messaging event, **When** the event includes sender PSID and message text, **Then** the message is stored with the correct source, thread, and contact info

---

### User Story 4 - Reply to Page Conversations via Page Send API (Priority: P2)

An operator can reply to a Page conversation from the CRM, and the reply is sent through the Meta Page Send API (not through the Chrome extension).

**Why this priority**: Operators need to respond to Page customers. Using the official API ensures reliability and compliance with Meta's messaging policies.

**Independent Test**: Can be tested by typing a reply in a Page conversation and verifying it arrives on the customer's Messenger.

**Acceptance Scenarios**:

1. **Given** an operator is viewing a Page conversation, **When** they type "Thanks!" and send, **Then** the message is sent via Page Send API and the customer receives it
2. **Given** a Page conversation is older than 24 hours since the last customer message, **When** the operator tries to reply, **Then** the system warns about Meta's 24-hour messaging window policy
3. **Given** a reply fails (e.g., token expired), **When** the send fails, **Then** the CRM shows a clear error and the message is marked as "failed"

---

### User Story 5 - Connect a Facebook Page to CRM (Priority: P2)

An admin can add a Facebook Page as an inbox source by providing the Page access token. The system validates the token, retrieves Page info, and begins receiving messages via webhook.

**Why this priority**: This is the setup flow that enables all Page-related features. It must be secure and intuitive.

**Independent Test**: Can be tested by adding a Page with a valid access token and verifying it appears as a new inbox source.

**Acceptance Scenarios**:

1. **Given** an admin has a valid Page access token, **When** they add the Page in CRM settings, **Then** the Page appears as an inbox source with correct name and avatar
2. **Given** a Page is connected, **When** the admin views the sources list, **Then** it shows source type, Page name, status (Active/Disconnected), and the owning personal account
3. **Given** an invalid/expired token is provided, **When** the admin attempts to add the Page, **Then** a clear error message is shown without crashing

---

### User Story 6 - Backfill Page Conversation History (Priority: P3)

When a new Page is connected, the system attempts to sync recent conversation history from the Page using the Conversations API, so operators have context for existing customer threads.

**Why this priority**: While realtime webhook is essential, historical context helps operators handle ongoing conversations. However, the feature works without backfill (webhook-only mode).

**Independent Test**: Can be tested by connecting a Page that has existing conversations and verifying historical messages appear in the CRM.

**Acceptance Scenarios**:

1. **Given** a Page is newly connected and has 20 existing conversations, **When** the system runs backfill, **Then** conversations and their recent messages appear in CRM
2. **Given** the Page token lacks conversation read permissions, **When** backfill runs, **Then** it gracefully skips and the system continues receiving realtime messages only
3. **Given** backfill is in progress, **When** a realtime webhook message arrives, **Then** the realtime message is not duplicated with backfill data

---

### User Story 7 - Source-Aware Sending Router (Priority: P2)

When an operator sends a message from the CRM, the system automatically routes it through the correct adapter: personal Messenger messages go through the Chrome extension; Page messages go through the Meta Send API.

**Why this priority**: Correct routing prevents sending a Page reply through a personal account (or vice versa), which would confuse customers and violate Meta policies.

**Independent Test**: Can be tested by sending messages from both a personal and a Page conversation and verifying each uses the correct sending method.

**Acceptance Scenarios**:

1. **Given** an operator is in a personal Messenger thread, **When** they send a message, **Then** it is routed through `sendViaExtension()`
2. **Given** an operator is in a Page thread, **When** they send a message, **Then** it is routed through `PageMessengerAdapter.sendMessage()`
3. **Given** a Page conversation, **When** the operator sends, **Then** the system never uses the Chrome extension adapter

---

### Edge Cases

- What happens when a Page access token expires mid-conversation? → System marks the source as "Disconnected" and shows a warning in the CRM UI
- What happens when the same customer messages both a personal account and a Page? → Two separate conversations are created, each under the correct source, never merged
- What happens when Meta's webhook verification fails? → The webhook endpoint returns 403 and logs the error
- What happens when the webhook endpoint receives events for an unregistered Page? → Events are logged and discarded gracefully
- What happens when a personal Messenger thread has the same external ID as a Page conversation ID? → The unique key `(source_id, external_conversation_id)` prevents collision since they have different source_ids

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a unified conversation list that includes both personal Messenger and Page Messenger conversations
- **FR-002**: System MUST store an `inbox_sources` table that tracks each connected source (personal account or Page) with its type, credentials, and status
- **FR-003**: Each conversation MUST be uniquely identified by `(source_id, external_conversation_id)` to prevent cross-source collisions
- **FR-004**: System MUST provide webhook endpoints (`GET /webhooks/meta/page` for verification, `POST /webhooks/meta/page` for events) that comply with Meta's webhook protocol
- **FR-005**: System MUST validate incoming webhook events using `X-Hub-Signature-256` to ensure authenticity
- **FR-006**: System MUST deduplicate incoming webhook messages by Meta's `message.mid` to prevent duplicate message storage
- **FR-007**: System MUST route outgoing messages through the correct adapter based on source type: Chrome extension for personal, Meta Send API for Page
- **FR-008**: System MUST display a source badge on each conversation item and chat header so operators can identify the source at a glance
- **FR-009**: System MUST provide source-based filtering in the conversation sidebar (All, Personal Messenger, Page, specific Page/Account)
- **FR-010**: System MUST NOT break the existing personal Messenger extension flow when adding Page support
- **FR-011**: System MUST respond to webhook POST events with HTTP 200 within 5 seconds to satisfy Meta's delivery requirements
- **FR-012**: System MUST warn operators when attempting to reply to a Page conversation outside Meta's 24-hour messaging window
- **FR-013**: System MUST support backfill of Page conversation history via `GET /{page-id}/conversations` and `GET /{conversation-id}/messages` when token permissions allow
- **FR-014**: System MUST persist Page access tokens securely (encrypted at rest)
- **FR-015**: All Page-related events MUST be logged with structured tags: `[PAGE_WEBHOOK_RECEIVED]`, `[PAGE_MESSAGE_PERSISTED]`, `[PAGE_SEND_REQUEST]`, `[PAGE_SEND_RESULT]`, `[UNIFIED_INBOX_SOURCE_RESOLVED]`

### Key Entities

- **Inbox Source**: Represents a connected messaging channel (personal account or Facebook Page). Key attributes: source type, external ID, display name, owner account, access token, status
- **Conversation/Thread**: A messaging thread between an operator and a contact, belonging to exactly one inbox source. Key attributes: source ID, external conversation ID, contact info, last activity
- **Message**: A single message within a conversation. Key attributes: thread reference, sender, content, timestamp, delivery status, source-specific message ID
- **Contact**: A customer who has messaged through any source. Identified per-thread, with extracted lead info

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can view conversations from up to 6 sources (1 personal + 5 Pages) in a single unified inbox without switching dashboards
- **SC-002**: Page messages received via webhook appear in the CRM within 3 seconds of being sent by the customer
- **SC-003**: Operators can filter conversations by source type and specific source, with the filtered list updating within 500ms
- **SC-004**: Replies sent to Page conversations are delivered to customers via the official Meta API with the same reliability as direct Facebook usage
- **SC-005**: No existing personal Messenger functionality is degraded after adding Page support
- **SC-006**: Duplicate webhook events produce exactly 0 duplicate messages in the database
- **SC-007**: The system correctly routes 100% of outgoing messages through the appropriate adapter (personal → extension, Page → API)
- **SC-008**: Source badges are visible and accurate for every conversation in the inbox

## Assumptions

- Operators have Meta Business accounts with access to Pages they manage, and can generate long-lived Page access tokens with `pages_messaging` and `pages_manage_metadata` permissions
- The CRM server is accessible via HTTPS for webhook delivery (either directly or through a tunnel like ngrok during development)
- Meta's Messenger Platform API v18+ is used for webhook and Send API interactions
- The existing SQLite database schema can be extended with additive migrations (new tables, new columns) without dropping existing tables
- Mobile support for the unified inbox UI is not required in the initial version
- Token encryption uses a server-side secret key managed by the deployment environment
- The 24-hour messaging window policy is handled as a UI warning, not a hard block (operators may have messaging tags for certain use cases)
