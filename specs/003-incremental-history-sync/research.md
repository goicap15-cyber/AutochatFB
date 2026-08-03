# Research: Incremental History Sync

## Decision 1 — ID first, timestamp second

Timestamp có thể trùng phút, sai timezone hoặc ban đầu là fallback; native ID là khóa chính.

## Decision 2 — Boundary stop

Vì DOM không bảo đảm seek tuyệt đối theo timestamp, crawler dừng sau chuỗi message IDs đã biết.

## Decision 3 — Checkpoint after commit

Chỉ ghi cursor sau khi batch transaction commit thành công.

## Decision 4 — Safe empty snapshot

Snapshot rỗng/partial chỉ ghi diagnostics, không xóa local state.
