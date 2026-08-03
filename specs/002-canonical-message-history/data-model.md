# Data Model: Canonical Message History

## Entities

### `Message`

Represents a single chat bubble in a conversation thread. The schema itself remains unchanged, but the constraints and meaning of the fields are tightened.

**Fields**:
- `fb_message_id` (Primary Key / Unique): Must be completely deterministic. If Facebook provides a native `mid.` or `data-id`, use it. If not, fallback to `history_ + sha256(thread_id + sender + content + ts_bucket)`.
- `thread_id` (Foreign Key): ID of the parent thread.
- `content` (Text): The actual text content. **Constraint**: MUST NOT contain Facebook accessibility labels.
- `timestamp_ms` (Integer): The canonical time of the message in milliseconds since epoch. This is the **primary sorting field**.
- `timestamp_source` (Enum String): Indicator of timestamp reliability.
  - `facebook_payload`: From GraphQL/WebSocket (most reliable).
  - `facebook_label`: Parsed from DOM aria-label (Thứ Sáu 10:09) (reliable).
  - `dom_history_sync`: Guessed via DOM iteration (least reliable).
- `created_at` (ISO String): MUST be synchronized with `timestamp_ms`. If `timestamp_ms` is updated, `created_at` MUST be updated to `new Date(timestamp_ms).toISOString()`.

### `Thread`

Represents a conversation. 

**Fields**:
- `last_activity` (Timestamp): Updated whenever a message is added or its `timestamp_ms` is upgraded. Used for sorting the sidebar.
