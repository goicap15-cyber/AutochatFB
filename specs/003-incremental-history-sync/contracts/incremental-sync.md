# Incremental Sync Contract

## SYNC_THREAD_MESSAGES request

Payload gồm account_id, thread_id, mode và cursor boundary nếu có.

## THREAD_MESSAGES_SYNCED result

Payload gồm mode, messages, checkpoint, fetched_count, inserted_count, skipped_count và reason nếu lỗi.

Messages rỗng không được xóa local state.
