# Data Model: Multi-Account Background Messenger Sync

## AccountSyncState

Runtime-only state in backend scheduler.

| Field | Meaning |
| --- | --- |
| `account_id` | Connected Facebook account |
| `last_sidebar_sync_at` | Last time backend sent `SYNC_THREADS` |
| `in_flight` | Whether a sidebar sync is currently outstanding |
| `last_result_at` | Last time backend received `SYNC_THREADS_RESULT` |

## ThreadSyncJob

Runtime-only state for targeted message sync.

| Field | Meaning |
| --- | --- |
| `account_id` | Owning Facebook account |
| `thread_id` | External Messenger thread id |
| `thread_url` | URL from sidebar snapshot or DB |
| `reason` | `preview_changed`, `activity_changed`, `manual`, `startup` |
| `queued_at` | Job creation time |
| `cooldown_until` | Next allowed sync time for the same account/thread |

## Thread Key

Backward-compatible identity helper:

```text
thread_key = `${account_id}:${thread_id}`
```

`thread_key` is exposed to CRM payloads and can be used by the UI as a stable key. Existing DB rows remain keyed by `threads.id` during this implementation to avoid destructive migration.

## External Thread ID

`threads.external_thread_id` stores the Messenger id observed by the extension. `threads.id` remains the internal CRM id. Existing rows can keep `id == external_thread_id`; when the same Messenger id appears under another account, the internal id can be `account_id:external_thread_id` while outbound/sync commands still send `external_thread_id` to the extension.
