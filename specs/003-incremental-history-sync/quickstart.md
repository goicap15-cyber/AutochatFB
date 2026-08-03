# Quickstart: Incremental History Sync

1. Backup data/database.db.
2. Chạy npm run test:persistence.
3. Initial sync hai thread có lịch sử.
4. Sync lại năm lần không thay đổi; message count không tăng.
5. Gửi một tin mới; incremental sync chỉ thêm tin mới.
6. Restart backend/extension; local history phải hiển thị trước Facebook.
7. Ngắt giữa batch rồi reconnect; kiểm tra resume không duplicate.
8. Backfill older history; chỉ phần cũ thiếu được thêm.
9. Chạy graphify update . sau mỗi boundary kiến trúc.
