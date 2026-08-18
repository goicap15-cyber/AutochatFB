# Feature Specification: Sidebar điều hướng mở rộng khi hover

**Feature Branch**: 034-hover-navigation-sidebar  
**Created**: 2026-08-14  
**Status**: Ready for implementation

## User Scenarios & Testing

### User Story 1 - Xem đầy đủ menu khi cần (Priority: P1)

Nhân viên đang làm việc trong CRM nhìn thấy sidebar gọn chỉ gồm icon. Khi đưa chuột vào sidebar, thanh này mở rộng và hiện tên CRM, nhãn rõ ràng cho từng mục, cùng trạng thái đang chọn; khi rời chuột, nó thu lại mượt mà về dạng icon.

**Why this priority**: Giữ tối đa không gian cho hội thoại nhưng vẫn giúp nhân viên nhận biết chức năng nhanh hơn, đặc biệt với người mới.

**Independent Test**: Mở CRM ở màn hình desktop, hover vào sidebar, xác nhận menu mở rộng; đưa chuột ra ngoài, xác nhận nó thu lại mà không đổi trang hoặc làm dịch chuyển khu vực chat.

**Acceptance Scenarios**:

1. **Given** sidebar đang thu gọn, **When** người dùng hover vào bất kỳ phần nào của sidebar, **Then** sidebar mở rộng để hiện logo/tên CRM và nhãn của toàn bộ mục điều hướng.
2. **Given** sidebar đang mở rộng, **When** người dùng rời chuột khỏi cả sidebar, **Then** sidebar thu gọn sau một khoảng trễ ngắn để tránh nhấp nháy khi di chuyển chuột giữa các mục.
3. **Given** một mục đang hoạt động, **When** sidebar mở rộng, **Then** mục đó có nhãn, nền và chỉ dấu trạng thái rõ ràng.
4. **Given** sidebar mở rộng/thu gọn, **When** trạng thái thay đổi, **Then** danh sách hội thoại và vùng chat không bị đổi kích thước hoặc dịch nội dung.

---

### User Story 2 - Điều hướng bằng bàn phím và màn hình nhỏ (Priority: P2)

Người dùng bàn phím có thể Tab vào sidebar và đọc/tác động các mục với nhãn đầy đủ. Thiết bị không có hover vẫn giữ sidebar compact, thao tác icon hiện có không bị chặn.

**Why this priority**: Hover chỉ là tiện ích; chức năng điều hướng hiện hữu phải tiếp cận được bằng bàn phím và an toàn trên thiết bị cảm ứng.

**Independent Test**: Dùng Tab đi vào sidebar, xác nhận thanh mở trong thời gian focus nằm bên trong; kiểm tra các nút vẫn gọi đúng chức năng. Giả lập màn hình hẹp/touch, xác nhận sidebar không che màn hình và icon vẫn bấm được.

**Acceptance Scenarios**:

1. **Given** focus bàn phím nằm trong sidebar, **When** người dùng tab qua các mục, **Then** sidebar giữ mở và mỗi mục có tên truy cập được.
2. **Given** focus rời sidebar, **When** không còn hover, **Then** sidebar thu lại như trạng thái ban đầu.
3. **Given** môi trường không hỗ trợ hover, **When** người dùng thao tác icon, **Then** các hành động điều hướng/modal hiện có hoạt động không thay đổi.

### Edge Cases

- Rời/đi vào lại sidebar nhanh không làm thanh chớp liên tục hoặc đóng khi đang click một mục.
- Sidebar mở rộng không che các modal, popover hoặc cảnh báo có mức ưu tiên cao hơn.
- Chế độ sáng/tối, phóng to 200%, tên mục dài và checkpoint cảnh báo vẫn dễ đọc, không tràn ngang.
- Người dùng giảm chuyển động hệ thống thấy trạng thái đổi ngay hoặc tối giản chuyển động.

## Requirements

### Functional Requirements

- **FR-001**: Sidebar phải mặc định gọn, chỉ hiển thị icon điều hướng và các điều khiển đáy đang có.
- **FR-002**: Hover trong sidebar desktop phải mở một bề mặt điều hướng rộng hơn, có tên CRM và nhãn cho mọi mục hiện hữu.
- **FR-003**: Sidebar phải giữ mở khi focus bàn phím còn bên trong và chỉ thu sau khi hover/focus đều đã rời khỏi sidebar.
- **FR-004**: Việc mở/thu sidebar không được làm thay đổi kích thước hay vị trí nội dung của danh sách hội thoại, vùng chat và bảng khách hàng.
- **FR-005**: Mọi mục hiện hữu phải giữ nguyên hành động, trạng thái active, cảnh báo checkpoint, giao diện sáng/tối và tooltip khi sidebar thu gọn.
- **FR-006**: Mục active phải thể hiện bằng nhãn, chỉ dấu và màu/nền; màu không phải tín hiệu duy nhất.
- **FR-007**: Sidebar phải tự thu sau một khoảng trễ ngắn khi rời chuột; quay lại trước khi hết trễ phải hủy thao tác thu.
- **FR-008**: Trên môi trường không có hover, sidebar phải mặc định gọn và không che nội dung; icon vẫn điều hướng được.
- **FR-009**: Bề mặt sidebar không được che modal, popover hay thông báo quan trọng đang hiển thị.
- **FR-010**: Tôn trọng thiết lập giảm chuyển động của hệ thống.

## Success Criteria

- **SC-001**: Người dùng desktop thấy đầy đủ nhãn menu trong không quá 250 ms sau khi đưa chuột vào sidebar.
- **SC-002**: Sau 20 lần hover/rời nhanh liên tiếp, không có lần nào làm sidebar nhấp nháy hoặc chặn click mục điều hướng.
- **SC-003**: Trong kiểm tra ở kích thước desktop, danh sách hội thoại và khu vực chat giữ nguyên vị trí trước/sau khi mở sidebar.
- **SC-004**: 100% mục điều hướng và điều khiển đáy hiện có vẫn thực hiện đúng hành động bằng chuột và bàn phím.

## Assumptions

- Đây là thay đổi giao diện client-only; không cần lưu trạng thái hoặc thay đổi backend.
- Chiều rộng sidebar mở rộng theo phong cách Meta Business Suite, khoảng 230–260 px, nhưng có thể điều chỉnh theo token thiết kế hiện hữu khi triển khai.
- Trên touch/hẹp, v1 ưu tiên sidebar compact thay vì thêm menu drawer/click-to-pin mới.
