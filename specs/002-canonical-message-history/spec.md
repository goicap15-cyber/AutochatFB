# Feature Specification: Canonical Message History

**Feature Branch**: `002-canonical-message-history`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "Chuẩn hóa lịch sử tin nhắn và thứ tự hiển thị — dùng timestamp_ms duy nhất cho sắp xếp/chia ngày, lọc accessibility label, khử duplicate, đảm bảo thứ tự CRM khớp Messenger."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — History messages display in the correct day group (Priority: P1)

An operator opens a conversation in the CRM. History messages that Facebook labels "Thứ Sáu 10:09 sáng" must appear under the "Thứ Sáu" date divider, not under "Hôm nay."

**Why this priority**: This is the most visible bug. Every history message with a past-date label currently lands in "Hôm nay" because the UI groups by `created_at` (the INSERT timestamp) while sorting by `timestamp_ms` (the Facebook label timestamp).

**Independent Test**: Load a thread containing messages from different days. Verify each message's date divider matches the day extracted from its canonical timestamp.

**Acceptance Scenarios**:

1. **Given** a synced thread containing a message labeled "Thứ Sáu 10:09 sáng", **When** the operator opens the thread in CRM, **Then** that message is displayed under a date divider for Friday (not "Hôm nay").
2. **Given** a thread with messages spanning 3+ days, **When** the operator scrolls through history, **Then** date dividers appear in chronological order and every message falls under the correct date.
3. **Given** a message whose Facebook label contains only a time (e.g. "10:09") with no day context, **When** the system parses it, **Then** it assigns the timestamp to today's date with that time, and the date divider reads "Hôm nay."

---

### User Story 2 — Accessibility labels are not stored as message content (Priority: P1)

When viewing synced messages, operators must never see raw accessibility label text like "Tin nhắn do Nguyễn Văn A gửi lúc Thứ Sáu 10:09 sáng" as the actual message bubble content.

**Why this priority**: This creates confusing, unreadable chat history that destroys trust in the CRM's data quality.

**Independent Test**: Sync a thread and inspect every message row in the database. No `content` field should contain the pattern "Tin nhắn do … gửi lúc …".

**Acceptance Scenarios**:

1. **Given** a DOM node whose `textContent` includes "Tin nhắn do Bạn gửi lúc Thứ Sáu 10:09 sáng: xin chào", **When** the parser processes it, **Then** only "xin chào" is stored as content.
2. **Given** a message bubble whose entire text is the accessibility label with no actual user content, **When** the parser processes it, **Then** the message is discarded (not stored).
3. **Given** an existing database with accessibility-polluted content, **When** the system starts up, **Then** a migration or clean-up pass removes those labels from stored content.

---

### User Story 3 — Repeated sync does not create duplicate messages (Priority: P1)

An operator triggers "Đồng bộ lại hội thoại" multiple times. The message count must remain stable.

**Why this priority**: Duplicates make conversations unreadable and break auto-reply logic (which may fire on phantom "new" messages).

**Independent Test**: Sync a thread, record message count, sync again 5 times, verify count is unchanged.

**Acceptance Scenarios**:

1. **Given** a thread with 10 messages already synced, **When** the operator syncs again, **Then** the message count remains 10.
2. **Given** a thread synced from two different sources (DOM observer + network interceptor) within 2 seconds, **When** both payloads arrive, **Then** only one copy of each message is stored.
3. **Given** Facebook does not provide native message IDs for history, **When** the system generates deterministic IDs, **Then** repeating the same DOM parse produces identical IDs (no random components).

---

### User Story 4 — CRM message order matches Messenger order (Priority: P2)

Side-by-side, the CRM shows messages in the same top-to-bottom order as Facebook Messenger.

**Why this priority**: Mismatched order confuses operators who compare CRM vs. Facebook windows.

**Independent Test**: Open the same thread in Messenger and CRM simultaneously. Verify that the sequence of messages (by content) is identical.

**Acceptance Scenarios**:

1. **Given** a thread with interleaved incoming/outgoing messages, **When** displayed in CRM, **Then** the order matches Facebook's chronological order exactly.
2. **Given** two messages with the same timestamp but different DOM positions, **When** sorted, **Then** DOM order is preserved as a tiebreaker.

---

### User Story 5 — Reload CRM or Facebook does not lose old messages (Priority: P2)

An operator reloads the CRM tab or the Facebook tab. Previously synced messages must remain visible.

**Why this priority**: Data loss on reload destroys user confidence.

**Independent Test**: Sync messages, reload both tabs, verify all previously visible messages are still present.

**Acceptance Scenarios**:

1. **Given** a thread with 20 synced messages, **When** the operator reloads the CRM, **Then** all 20 messages are loaded from the database and displayed.
2. **Given** the Facebook extension reconnects after a page refresh, **When** a new sync runs, **Then** existing messages in the database are preserved and new messages are appended.

---

### Edge Cases

- What happens when a Facebook label has an ambiguous time (e.g. "10:09" without AM/PM in a 12h-locale)?
- How does the system handle messages from a different timezone than the operator?
- What if the DOM mutation observer fires a bubble whose parent row has already been removed from the DOM?
- What happens when two messages from different senders have identical content and timestamp?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST assign a single `timestamp_ms` (milliseconds since epoch) to every message, derived from the best available source (Facebook payload > Facebook label > DOM order fallback).
- **FR-002**: The UI MUST use `timestamp_ms` for all three purposes: sorting messages, grouping into date dividers, and displaying time labels — never `created_at`.
- **FR-003**: The content parser MUST strip Facebook accessibility label prefixes ("Tin nhắn do … gửi lúc …") before storing content. If no real user text remains after stripping, the message MUST be discarded.
- **FR-004**: Deterministic message IDs MUST be generated for history messages that lack Facebook native IDs. The ID generation function MUST produce the same output for the same input across repeated syncs.
- **FR-005**: The `INSERT OR IGNORE` / `ON CONFLICT` deduplication MUST prevent duplicate rows when the same message arrives from multiple sources (DOM observer, network interceptor, history sync).
- **FR-006**: When `timestamp_ms` is updated for an existing message (e.g. better source arrives), the system MUST also update `created_at` to `new Date(timestamp_ms).toISOString()` to maintain consistency.
- **FR-007**: Backend query results MUST be ordered by `timestamp_ms ASC, id ASC` to preserve Facebook's chronological order.
- **FR-008**: The history sync parser MUST correctly parse Vietnamese time labels including day-of-week ("Thứ Sáu"), "Hôm qua", date formats ("31 tháng 7"), and AM/PM equivalents ("sáng"/"chiều").

### Key Entities

- **Message**: A single chat message with fields: `fb_message_id` (unique), `thread_id`, `content`, `timestamp_ms` (epoch ms), `timestamp_source` (enum: facebook_payload, facebook_label, facebook_dom, realtime_fallback, fallback), `is_outgoing`, `sender_id`, `created_at` (ISO string derived from timestamp_ms).
- **Thread**: A conversation thread owning zero or more messages, with `last_activity` updated when new messages arrive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A message labeled "Thứ Sáu 10:09 sáng" in Facebook appears under the Friday date divider in the CRM, not under "Hôm nay".
- **SC-002**: Zero messages in the database contain the pattern "Tin nhắn do .+ gửi lúc" in their `content` field.
- **SC-003**: The CRM message order matches Messenger message order for any given thread (verified by visual comparison or automated test).
- **SC-004**: Running "Đồng bộ lại hội thoại" 5 consecutive times on the same thread does not increase the message count.
- **SC-005**: Reloading the CRM tab and the Facebook tab (separately and together) does not reduce the visible message count in the CRM.

## Assumptions

- The Facebook DOM structure for message rows (`div[role="row"]`) and accessibility labels (`aria-label` containing "Tin nhắn do … gửi lúc …") is stable and will not change during this feature's lifetime.
- The operator's browser timezone is Vietnam (ICT, UTC+7). The system uses the browser's local timezone for label parsing; no explicit timezone conversion is required at this stage.
- The existing database schema (`messages` table with `fb_message_id UNIQUE`, `timestamp_ms`, `timestamp_source`, `created_at`) is sufficient. No new columns need to be added — `timestamp_ms` will serve as the canonical timestamp.
- Network-intercepted messages (WebSocket, XHR, Fetch) already carry reliable `timestamp_ms` from Facebook payloads. The primary fix targets DOM-parsed history messages and the UI's inconsistent use of `created_at` vs `timestamp_ms`.
