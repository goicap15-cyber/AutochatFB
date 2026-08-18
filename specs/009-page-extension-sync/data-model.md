# Data Model: Page Extension Sync

## Entities

### `MessageQueue`
Manages the pending messages to be sent by the extension.
- `id` (PK, String)
- `thread_id` (FK to `threads`, String)
- `account_id` (String)
- `content` (Text)
- `status` (Enum: 'pending', 'processing', 'sent', 'failed')
- `created_at` (Timestamp)
- `processed_at` (Timestamp, nullable)
- `error_reason` (String, nullable)

### `InboxSource` (Extended)
- `extension_tab_id` (Integer, nullable) - Tracks which Chrome tab is currently assigned to this source (if using dynamic tabs).

## State Transitions

### Message Queue Status
- `pending`: Initial state when CRM requests a send.
- `processing`: Extension has picked up the message and is currently executing typing/sending delays.
- `sent`: Successfully delivered (DOM indicates success).
- `failed`: Failed to send (e.g., tab closed, DOM selector failed).
