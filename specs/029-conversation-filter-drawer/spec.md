# Feature Specification: CRM Conversation Filter Drawer

**Feature Branch**: `029-conversation-filter-drawer`  
**Created**: 2026-08-13  
**Status**: Draft

**Input**: Gom bộ lọc nguồn và trạng thái của danh sách hội thoại CRM vào hộp Bộ lọc mở từ biểu tượng phễu.

## User Scenarios & Testing

### User Story 1 - Mở và áp dụng bộ lọc (Priority: P1)

Nhân viên bấm biểu tượng phễu ở đầu danh sách hội thoại để mở hộp Bộ lọc. Họ chọn một hoặc nhiều nguồn và một hoặc nhiều trạng thái khách hàng, rồi bấm Áp dụng để thu hẹp danh sách.

**Why this priority**: Giảm chiều cao phần đầu danh sách, vẫn giữ đủ khả năng lọc hiện có và hỗ trợ lọc nhiều điều kiện như mẫu.

**Independent Test**: Chọn một hay nhiều nguồn, một trạng thái, áp dụng và xác nhận mọi hội thoại còn lại thỏa các điều kiện.

**Acceptance Scenarios**:

1. **Given** danh sách hội thoại đang hiển thị, **When** nhân viên bấm biểu tượng phễu, **Then** hộp Bộ lọc mở ra và hai dropdown cũ Tất cả nguồn/Tất cả trạng thái không còn chiếm chỗ trên thanh bên.
2. **Given** hộp Bộ lọc đang mở, **When** nhân viên chọn nhiều nguồn rồi Áp dụng, **Then** danh sách hiển thị hội thoại thuộc bất kỳ nguồn nào đã chọn.
3. **Given** đã chọn cả nguồn lẫn trạng thái, **When** bấm Áp dụng, **Then** chỉ hội thoại thỏa điều kiện nguồn **và** điều kiện trạng thái được hiển thị.

---

### User Story 2 - Nhận biết và xóa điều kiện đang áp dụng (Priority: P1)

Nhân viên biết danh sách đang bị lọc, xem lại lựa chọn đã áp dụng và xóa toàn bộ trong một thao tác.

**Why this priority**: Khi bộ lọc nằm trong biểu tượng, phải có tín hiệu rõ ràng để không gây hiểu lầm.

**Independent Test**: Áp dụng điều kiện, đóng/mở lại hộp, xóa tất cả rồi áp dụng; danh sách lần lượt giữ lựa chọn và trở về đầy đủ.

**Acceptance Scenarios**:

1. **Given** có ít nhất một điều kiện đã áp dụng, **When** hộp đóng, **Then** nút phễu có badge số lượng và nhãn trợ năng nêu rõ bộ lọc đang bật.
2. **Given** đã có điều kiện áp dụng, **When** mở lại hộp, **Then** đúng các điều kiện đó vẫn được chọn.
3. **Given** hộp đang mở, **When** bấm Xóa tất cả rồi Áp dụng, **Then** mọi điều kiện nguồn/trạng thái bị xóa.

---

### User Story 3 - Đóng an toàn và dùng bàn phím (Priority: P2)

Nhân viên có thể thay đổi lựa chọn nháp rồi Hủy/Escape/đóng hộp mà không làm danh sách đổi ngoài ý muốn, và thao tác được bằng bàn phím.

**Independent Test**: Mở hộp, đổi lựa chọn, hủy bằng Escape; danh sách và filter áp dụng trước đó phải không đổi.

**Acceptance Scenarios**:

1. **Given** hộp đang mở, **When** nhân viên thay đổi lựa chọn rồi Hủy, Escape, click nút đóng hoặc click ngoài, **Then** chỉ bản nháp bị bỏ, filter đang áp dụng không đổi.
2. **Given** hộp đang mở, **When** nhân viên dùng Tab, Space/Enter và Escape, **Then** có thể chọn/bỏ chọn, áp dụng/hủy và luôn thấy focus.

### Edge Cases

- Khi chỉ có 0 hoặc 1 nguồn, hoặc không có Lead Status, nhóm tương ứng không hiện hoặc có empty state rõ ràng.
- Nguồn/status bị xóa trong lúc hộp mở được bỏ qua khi áp dụng, không làm crash UI.
- Tổ hợp không có kết quả dùng empty state hiện có và hướng dẫn đổi bộ lọc.
- Search, workflow tab, hotkey Alt+Up/Down và campaign selection tiếp tục lọc chồng lên bộ lọc mới.

## Requirements

### Functional Requirements

- **FR-001**: Hệ thống MUST thay hai dropdown nguồn/trạng thái thường trực bằng một nút Bộ lọc có biểu tượng phễu.
- **FR-002**: Hệ thống MUST mở một hộp có tiêu đề, nút đóng, nhóm Nguồn, nhóm Trạng thái, Xóa tất cả, Hủy và Áp dụng.
- **FR-003**: Người dùng MUST chọn nhiều điều kiện trong mỗi nhóm. Cùng nhóm là OR; giữa nhóm Nguồn và Trạng thái là AND.
- **FR-004**: Nhóm Nguồn MUST hỗ trợ Messenger cá nhân, Page và từng nguồn cụ thể đang có.
- **FR-005**: Nhóm Trạng thái MUST hiển thị Lead Status hiện có và không nhầm với workflow tab.
- **FR-006**: Lựa chọn trong hộp MUST là draft; chỉ Áp dụng thay đổi danh sách. Hủy/Escape/close/click ngoài MUST bỏ draft.
- **FR-007**: Xóa tất cả MUST xóa draft; sau Áp dụng, danh sách không còn lọc nguồn/trạng thái.
- **FR-008**: Nút phễu MUST có số điều kiện và aria-label động khi filter bật; chỉ báo không chỉ dùng màu.
- **FR-009**: Mở lại MUST khởi tạo từ filter đã áp dụng; option không còn hợp lệ được sanitize an toàn.
- **FR-010**: Search, workflow tabs, hotkey, campaign selection và unread MUST giữ nguyên hành vi.
- **FR-011**: Điều khiển MUST có label, selected state qua aria/biểu tượng, focus visible, Escape, theme sáng/tối, drawer hẹp và zoom 200%.
- **FR-012**: Không tạo/sửa dữ liệu thread, contact, source hoặc status; filter chỉ là state UI trong phiên hiện tại.

### Key Entities

- **Applied filter**: Tập nguồn và Lead Status đã xác nhận, quyết định danh sách hiển thị.
- **Filter draft**: Bản chọn tạm trong hộp Bộ lọc.
- **Filter option**: Loại nguồn, nguồn cụ thể hoặc Lead Status còn hợp lệ.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Người dùng hoàn tất mở, chọn và áp dụng bộ lọc bằng không quá 4 thao tác chính.
- **SC-002**: 100% hội thoại hiển thị đạt quy tắc OR trong nhóm và AND giữa nhóm trong các kịch bản test.
- **SC-003**: 100% Hủy/Escape/đóng hộp sau khi sửa draft giữ nguyên danh sách/filter trước đó.
- **SC-004**: Có thể nhận ra và xóa toàn bộ filter trong không quá 2 thao tác sau khi mở hộp.
- **SC-005**: Keyboard, sáng/tối, drawer hẹp và zoom 200% không che control hoặc làm mất focus.

## Assumptions

- Phạm vi đầu tiên chỉ là Nguồn và Lead Status; tags, quảng cáo, quản trị viên, thư mục và lưu filter là phần sau.
- Filter chỉ tồn tại trong phiên giao diện; không lưu database, URL hay cấu hình tài khoản.
- Hộp nhỏ neo theo nút phễu phù hợp CRM hơn modal toàn trang như Facebook.
