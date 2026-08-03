# Sync Event Contracts

All events are account-scoped and idempotent. Empty or failed sync events never instruct the backend to delete stored data.

## Backend → Extension

### `SYNC_CONVERSATION_HISTORY`

Required fields: `account_id`, `conversation_id`, `preferred_external_thread_id`, `mode`.

Optional fields: `thread_url`, `known_message_ids`, `newest_known_timestamp`, `oldest_known_timestamp`.

`mode` is `INITIAL` or `INCREMENTAL`.

## Extension → Backend

### `CONVERSATIONS_DISCOVERED`

Contains `account_id` and a bounded list of conversation metadata plus all external identifiers observed for each item. This is an upsert snapshot, not a replacement set.

### `HISTORY_SYNC_STARTED`

Contains `account_id`, `conversation_id`, `sync_id`, and `mode`.

### `HISTORY_SYNC_BATCH`

Contains `account_id`, `conversation_id`, `sync_id`, `batch_index`, `messages`, and optional oldest/newest markers. Repeating the same batch must produce no duplicates.

### `HISTORY_SYNC_COMPLETED`

Contains `account_id`, `conversation_id`, `sync_id`, final markers, and totals observed/persisted/deduplicated.

### `HISTORY_SYNC_FAILED`

Contains `account_id`, `conversation_id`, `sync_id`, structured `reason`, and `retryable`. Already persisted batches remain valid.

### `NEW_MESSAGE_RECEIVED`

Must include `account_id`, observed conversation identifiers, message identity candidates, direction, content/media, timestamp, and source. The backend resolves identity and persists before notifying the client.

## Backend → Client

### `CONVERSATION_UPSERTED`

Carries the stable CRM conversation record after persistence.

### `MESSAGE_PERSISTED`

Carries the stable CRM message after insert/reconcile. The UI may mark an item durable only after this event or an equivalent REST response.

### `SYNC_STATUS_CHANGED`

Carries `conversation_id`, sync mode/status, last success, progress totals, and retryable error. Stored content remains visible for every status.

## REST read behavior

- `GET /api/threads` returns persisted conversations; it does not depend on the current Facebook sidebar.
- `GET /api/threads/:id/messages` returns persisted messages ordered by best timestamp and local ID.
- Read responses may include sync status, but a failed/offline status must not produce an empty replacement payload.
