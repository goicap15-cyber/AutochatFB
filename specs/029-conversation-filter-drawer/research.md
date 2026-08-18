# Research: CRM Conversation Filter Drawer

## Decision 1 — Multi-select

**Decision**: Cùng nhóm OR; giữa Nguồn và Trạng thái AND. Search và workflow tabs vẫn là AND bên ngoài.

**Rationale**: Chọn Page A + Page B phải trả về A hoặc B; thêm status chỉ giữ A/B có status đó.

**Alternatives considered**: AND mọi lựa chọn là không thực tế vì một thread không thuộc hai nguồn. Single-select không đáp ứng mẫu user yêu cầu.

## Decision 2 — Draft tách applied

**Decision**: Mở popover clone applied; chỉ Apply cập nhật danh sách. Hủy/Escape/close/click-outside discard draft.

**Rationale**: Người dùng có thể thử điều kiện mà inbox không nhảy ngoài ý muốn, đúng với footer Áp dụng trong mẫu.

**Alternatives considered**: Filter ngay từng click khiến Hủy/Escape không có ý nghĩa; đặt state ở App.jsx là không cần vì state không chia sẻ/persist.

## Decision 3 — Popover neo phễu

**Decision**: Dùng popover/dialog giới hạn trong viewport/sidebar, không sao chép full-screen modal Facebook.

**Rationale**: Chỉ có hai nhóm lựa chọn nên modal toàn trang quá nặng, nhưng vẫn cần semantics dialog/focus/Escape.

## Decision 4 — Không thay backend

**Decision**: Lọc local trên mảng threads.

**Rationale**: `/api/threads` đã trả `source_id`, `source_type`, `status_id`; App đã tải inboxSources và leadStatuses.

## Decision 5 — Source key namespaced

**Decision**: `type:<source_type>` và `source:<source_id>`.

**Rationale**: Type và id cùng là string; namespace tránh va chạm và làm predicate rõ ràng.
