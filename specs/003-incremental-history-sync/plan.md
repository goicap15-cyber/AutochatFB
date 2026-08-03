# Implementation Plan: Incremental History Sync

## Summary

Chuyển history sync từ full snapshot sang checkpoint-based incremental sync.

## Architecture

1. CRM đọc SQLite local trước.
2. Backend đọc sync_cursor và chọn initial, incremental hoặc backfill.
3. Extension crawl theo mode và boundary, dừng khi gặp message đã biết.
4. Repository commit batch rồi mới cập nhật checkpoint.
5. UI nhận delta, không replace local history.

## Constraints

- Không thêm database column.
- ID native ưu tiên; fingerprint fallback gồm thread, sender, direction, normalized content, timestamp và media.
- Empty/partial snapshot không xóa dữ liệu.

## Graphify Gates

- Baseline: trace App.jsx → server sync request → background crawler → THREAD_MESSAGES_SYNCED → repository/database.
- Sau backend: chạy graphify update . và kiểm tra checkpoint chỉ ghi sau transaction.
- Sau extension: chạy graphify update . và kiểm tra mode/boundary đi xuyên suốt.
- Sau UI: chạy graphify update . và kiểm tra local snapshot + delta.
- Ghi kết quả Graphify trước khi đóng task cuối.
