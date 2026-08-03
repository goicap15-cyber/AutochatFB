# Quickstart: Validation Guide

## 1. Verify Message Deduplication
1. Open a thread in Facebook Messenger.
2. Scroll up several times to load history.
3. In the AutoChatbot extension, click "Đồng bộ lại hội thoại".
4. Check the backend logs: `[WS] THREAD_MESSAGES_SYNCED`. Note the number of messages.
5. Click "Đồng bộ lại hội thoại" again.
6. Verify the SQLite database `messages` table count for that `thread_id` did NOT increase.

## 2. Verify Date Grouping & Sorting
1. Open a conversation in the CRM that has messages from yesterday and today.
2. Verify that yesterday's messages appear under a date divider (e.g. "Hôm qua" or "2 Tháng 8").
3. Verify that today's messages appear under the "Hôm nay" date divider.
4. Verify that no historical messages fallback incorrectly to "Hôm nay".

## 3. Verify Accessibility Label Stripping
1. Open a conversation in Facebook Messenger.
2. Ensure you see time dividers like "Tin nhắn do Bạn gửi lúc Thứ Sáu 10:09 sáng".
3. Wait for the sync to complete.
4. Query the SQLite database:
   ```sql
   sqlite3 data/database.db "SELECT content FROM messages WHERE content LIKE '%Tin nhắn do%';"
   ```
5. Expected result: Zero rows returned.

## 4. Verify P0 Bug Fixes
1. Restart the backend server (`npm start`). It should start successfully without `SyntaxError`.
2. Inspect `data/` to ensure a migration backup `database.db.backup-*` is created correctly for legacy files.
3. Check `tests/integration/` — run `node --test tests/integration/` and verify that the tests complete successfully using in-memory SQLite operations, rather than placeholder assertions.
