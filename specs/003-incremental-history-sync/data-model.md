# Data Model: Incremental History Sync

## Sync Cursor in threads.sync_cursor

- version
- mode: initial, incremental, backfill
- newest_timestamp_ms
- oldest_timestamp_ms
- newest_message_id
- oldest_message_id
- last_batch_id

## Sync State

sync_status: LOCAL, SYNCING, PARTIAL, SYNCED hoặc FAILED. sync_error giữ lỗi retryable.

## Identity

Native fb_message_id ưu tiên. Fallback fingerprint dùng thread, direction, sender, normalized content, timestamp và media reference.
