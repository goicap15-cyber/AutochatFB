# Data Model: CRM Conversation Filter Drawer

Không có bảng hoặc migration mới. Đây là state UI không lưu trữ.

## AppliedConversationFilters

| Field | Type | Rules |
|---|---|---|
| `sourceKeys` | `string[]` | `type:<source_type>` hoặc `source:<source_id>`; unique và chỉ giữ option hợp lệ khi Apply. |
| `statusIds` | `string[]` | Id Lead Status dạng string; unique và chỉ giữ status còn tồn tại. |

## DraftConversationFilters

Cùng shape với AppliedConversationFilters. Clone từ Applied khi mở; bị discard khi Hủy/Escape/close.

## Matching Rules

1. Không có source key: mọi thread qua nhóm Nguồn.
2. Có source key: source type hoặc source id thread phải khớp ít nhất một key.
3. Không có status: mọi thread qua nhóm Trạng thái.
4. Có status: `String(thread.status_id)` phải khớp ít nhất một id.
5. Thread chỉ hiện khi đạt Nguồn **và** Trạng thái, rồi tiếp tục đạt workflow tab/search hiện có.
