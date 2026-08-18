# Implementation Plan: CRM Conversation Filter Drawer

**Branch**: `029-conversation-filter-drawer` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

## Summary

Thay các select nguồn/trạng thái cố định ở ConversationSidebar bằng Filter Popover mở từ biểu tượng phễu. Thành phần mới có draft tách khỏi applied, vì vậy danh sách chỉ thay đổi sau khi người dùng xác nhận. Không thay API/database: dữ liệu threads hiện có đã có `source_id`, `source_type` và `status_id`.

## Technical Context

- **Language/Version**: React 19, JavaScript/JSX, Node.js
- **Primary Dependencies**: React hooks, lucide-react, CSS token/Tailwind utilities hiện có
- **Storage**: Không có dữ liệu mới; state chỉ tồn tại trong phiên UI
- **Testing**: Node test runner, Vite build, kiểm thử browser thủ công
- **Target Platform**: CRM desktop và drawer hẹp
- **Project Type**: React frontend + Node/Express backend
- **Performance Goals**: Lọc mảng threads đã tải, không thêm network request; mở/đóng tức thì
- **Constraints**: Giữ nguyên search, workflow tab, hotkey, campaign selection, unread; không đụng Spec 027/022/028

## Constitution Check

Constitution hiện là template chưa điền nên không có gate riêng. Kế hoạch dùng state cục bộ sidebar và pure utility test được; không thêm persistence hay endpoint.

## Architecture and State Flow

```text
ConversationSidebar
  appliedFilters { sourceKeys: [], statusIds: [] }
        │ mở phễu
        ▼
ConversationFilterPopover
  draftFilters ← clone(appliedFilters)
        │ Apply                         │ Cancel / Escape / close
        ▼                               ▼
setAppliedFilters(draft)          discard draft
        │
        ▼
filteredThreads = threads ∩ workflow tab ∩ search ∩ source ∩ status
```

- `sourceKeys` dùng namespace `type:<source_type>` và `source:<source_id>`.
- `statusIds` là array id Lead Status theo string nhất quán.
- Multi-select trong nhóm dùng OR; nhóm đã chọn kết hợp AND.
- Trước Apply sanitize draft bằng options mới nhất; key không hợp lệ bị loại an toàn.
- Badge đếm tổng điều kiện áp dụng và aria-label diễn đạt số đó.

## Implementation Phases

### Phase 1 — Pure filter model

- Thêm `src/client/utils/conversationFilters.js`: source keys, normalize/sanitize, clone/equality, count và `matchesConversationFilters`.
- Test source type/source id, OR/AND, no-op, thread thiếu dữ liệu và option bị xóa.

### Phase 2 — Accessible filter popover

- Thêm `src/client/components/ConversationFilterPopover.jsx`.
- Dialog/popover có tiêu đề, focus visible, Escape/click-outside/close, trả focus về nút phễu.
- Toggle semantic có selected cue không chỉ màu; phần Nguồn/Trạng thái ẩn an toàn khi không có option.
- Footer Xóa tất cả, Hủy và Áp dụng; chỉ Apply gọi callback.

### Phase 3 — Sidebar integration

- ConversationSidebar sở hữu applied filters, bỏ hai select cũ và render popover.
- Dùng predicate mới trong `filteredThreads`, kết hợp source/status với workflow tab và search hiện tại.
- Nút Filter có badge/title/aria dynamic; giữ campaign/search/header gọn.
- Điều chỉnh empty-state copy nếu cần, không đổi data flow.

### Phase 4 — Regression and validation

- Unit test helper + draft/applied logic.
- Test filter kết hợp search/tab, reopen, cancel/Escape, clear, badge và sanitize.
- Chạy Vite build và persistence suite.
- Browser: light/dark, narrow drawer, zoom 200%, keyboard only, click outside, 0/1/nhiều options, campaign selection và Alt+Up/Down.

## Project Structure

```text
src/client/
├── components/
│   ├── ConversationSidebar.jsx
│   └── ConversationFilterPopover.jsx       # new
└── utils/
    └── conversationFilters.js              # new

tests/unit/
├── conversationFilters.test.js
└── conversationFilterPopoverLogic.test.js

specs/029-conversation-filter-drawer/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/conversation-filter-ui.md
└── quickstart.md
```

**Structure Decision**: Chỉ thêm component/utility client. Server đã đưa đủ dữ liệu filter qua `/api/threads`.

## Safety Gates

- Không network request/ghi database khi Apply/Xóa/Hủy.
- Draft không thay danh sách trước Apply.
- Workflow status không được nhầm với Lead Status.
- Không hồi quy campaign selection/hotkey/navigation.
- Popover không che/mất focus trong sidebar hẹp.
