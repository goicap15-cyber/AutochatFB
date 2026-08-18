# UI Contract: Conversation Filter Drawer

## Inputs

| Input | Meaning |
|---|---|
| `appliedFilters` | Filter đã xác nhận của sidebar. |
| `inboxSources` | Nguồn cụ thể để render options. |
| `leadStatuses` | Lead Status để render options. |
| `onApply(filters)` | Chỉ gọi khi người dùng xác nhận. |
| `onClose()` | Đóng và discard draft; không gọi onApply. |

## Interaction Contract

- Mở: draft clone từ applied.
- Toggle: chỉ thay draft.
- Xóa tất cả: draft là `{ sourceKeys: [], statusIds: [] }`.
- Apply: sanitize theo options hiện hành, gọi onApply rồi đóng.
- Hủy, Escape, close, click outside: close không thay applied.
- Sau close: focus trở lại nút mở Bộ lọc.

## Accessibility Contract

- Nút mở có `aria-haspopup="dialog"`, `aria-expanded` và aria-label động gồm số điều kiện.
- Hộp có role/name dialog, heading nhận diện được và controls có label.
- Option có selected state semantic/dấu check; focus luôn thấy.

## Data Contract

Không phát sinh request. Match đọc `source_id`, `source_type`, `status_id` của thread theo [data-model.md](../data-model.md).
