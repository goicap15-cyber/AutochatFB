# Contract: Background Sync Events

## Backend → Extension

### `SYNC_THREADS`

```json
{
  "type": "SYNC_THREADS",
  "data": {
    "account_id": "100022290034259",
    "reason": "scheduler"
  }
}
```

### `SYNC_THREAD_MESSAGES`

```json
{
  "type": "SYNC_THREAD_MESSAGES",
  "data": {
    "account_id": "100022290034259",
    "thread_id": "969878666067566",
    "thread_url": "https://www.facebook.com/messages/t/969878666067566",
    "mode": "incremental",
    "cursor": null,
    "reason": "preview_changed"
  }
}
```

## Extension → Backend

Existing `SYNC_THREADS_RESULT`, `THREAD_MESSAGES_SYNCED`, and `NEW_MESSAGE_RECEIVED` remain valid. Implementations should include `account_id` and avoid logging secrets.

## Backend → CRM

`THREADS_SYNCED` and `THREAD_MESSAGES_UPDATED` include existing fields plus optional `thread_key`:

```json
{
  "account_id": "100022290034259",
  "thread_key": "100022290034259:969878666067566",
  "thread_id": "969878666067566"
}
```
