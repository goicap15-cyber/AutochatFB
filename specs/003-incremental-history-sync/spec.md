# Feature Specification: Incremental History Sync

**Feature Branch**: 003-incremental-history-sync
**Status**: Draft

## Overview

CRM phải chỉ đồng bộ phần lịch sử còn thiếu thay vì quét và ghi lại toàn bộ hội thoại sau mỗi lần reload/restart.

## User Stories

### User Story 1 — Append only missing messages (P1)

Khi thread đã có dữ liệu, lần sync sau chỉ thêm message chưa tồn tại và dừng tại boundary đã biết.

### User Story 2 — Resume after restart (P1)

Backend/extension restart phải đọc checkpoint từ SQLite và tiếp tục mà không mất dữ liệu đã commit.

### User Story 3 — Backfill older history (P2)

Khi operator cần tin cũ hơn, hệ thống backfill theo batch, không full crawl mỗi lần.

### User Story 4 — Reconcile multiple sources (P1)

Realtime, DOM và history sync của cùng message phải được gộp thành một row.

## Functional Requirements

- FR-001: Thread lưu mode, newest/oldest timestamp và boundary message IDs trong sync_cursor hiện có.
- FR-002: Native Facebook message ID là khóa dedup chính; timestamp không được dùng một mình làm khóa.
- FR-003: Incremental sync chỉ append/upsert message thiếu và không xóa khi snapshot rỗng/partial.
- FR-004: Crawler dừng khi gặp boundary đã biết liên tiếp theo cấu hình.
- FR-005: Thread mới chạy initial backfill; thread đã có checkpoint chạy incremental.
- FR-006: Checkpoint chỉ cập nhật sau transaction batch thành công; batch đã commit được giữ khi crash.
- FR-007: Fingerprint fallback phải ổn định và không gộp hai message giống nội dung nhưng khác thời điểm.
- FR-008: UI đọc local trước, kể cả khi extension offline.
- FR-009: Diagnostics phải ghi mode, boundary, fetched/inserted/skipped và failure reason.

## Edge Cases

- Nhiều message cùng phút hoặc cùng nội dung.
- DOM trả thứ tự ngược hoặc chỉ trả một viewport.
- Timestamp ban đầu fallback rồi được nâng cấp.
- Snapshot rỗng hoặc mất kết nối giữa batch.

## Success Criteria

- SC-001: Năm lần sync thread không đổi tạo zero row mới.
- SC-002: Sync có checkpoint dừng tại boundary và chỉ append phần thiếu.
- SC-003: Restart không giảm message count và resume được batch dang dở.
- SC-004: Cùng message từ hai nguồn chỉ có một row.
- SC-005: Hai thread test vẫn đọc được trong tối đa 2 giây khi Facebook offline.

## Assumptions

- Timestamp thường ổn định nhưng chỉ là boundary/sort hint, không thay thế message ID.
- Không thêm cột schema; sync_cursor là JSON versioned trong schema hiện có.
- Full history là phần Facebook cung cấp qua viewport/pagination của phiên đăng nhập.
