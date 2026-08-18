# Feature Specification: CRM VIP Quick Action

**Feature Branch**: \`030-call-vip-actions\`  
**Created**: 2026-08-14  
**Status**: In implementation

**Input**: Triển khai trước thao tác nhanh VIP trong bảng Thông tin khách hàng. Chức năng Gọi, Nhắc và Lưu trữ được hoãn, không thay đổi trong đợt này.

## User Scenarios & Testing

### User Story 1 - Đánh dấu khách VIP (Priority: P1)

Nhân viên bấm VIP để đánh dấu khách quan trọng và bấm lại để bỏ đánh dấu. Thay đổi được lưu vào nhãn của đúng khách hàng, đồng thời trạng thái nút thể hiện ngay khách hiện có là VIP hay không.

**Why this priority**: Giúp phân loại khách ưu tiên ngay tại vị trí làm việc, không cần mở trình quản lý nhãn.

**Independent Test**: Bấm VIP ở hồ sơ không có nhãn VIP, tải lại hồ sơ và xác nhận nhãn tồn tại; bấm lại, tải lại và xác nhận nhãn đã bị bỏ.

**Acceptance Scenarios**:

1. **Given** khách chưa có nhãn VIP, **When** nhân viên bấm VIP, **Then** khách được gắn đúng một nhãn VIP và nút phản ánh trạng thái đã chọn.
2. **Given** khách đã có nhãn VIP, kể cả khác kiểu chữ hoa/thường, **When** nhân viên bấm VIP, **Then** nhãn VIP bị bỏ và nút trở về trạng thái chưa chọn.
3. **Given** không thể lưu thay đổi nhãn, **When** nhân viên bấm VIP, **Then** giao diện hoàn nguyên trạng thái trước đó và hiển thị lỗi có thể hiểu được.
4. **Given** nhân viên chuyển sang khách khác khi lưu VIP đang chạy, **When** phản hồi cũ trả về, **Then** phản hồi đó không được thay đổi trạng thái hoặc lỗi của khách mới.

---

### User Story 2 - Nhận biết và thao tác an toàn (Priority: P2)

Nhân viên, kể cả khi dùng bàn phím hoặc công cụ hỗ trợ, nhận biết được nút VIP đang làm gì và trạng thái VIP hiện tại.

**Why this priority**: Thao tác nhanh cần rõ nghĩa và không được dựa vào màu sắc đơn thuần.

**Independent Test**: Dùng Tab/Enter hoặc Space để kích hoạt VIP, kiểm tra focus hiển thị, tên truy cập và tín hiệu trạng thái không chỉ bằng màu.

**Acceptance Scenarios**:

1. **Given** khách là VIP, **When** nhân viên hoặc công cụ hỗ trợ đọc nút VIP, **Then** trạng thái đã chọn được công bố rõ ràng.
2. **Given** VIP đang lưu, **When** nhân viên nhìn hoặc dùng bàn phím, **Then** nút không thực hiện thêm lần lưu trùng và nêu rõ đang lưu.

### Edge Cases

- Khách có đúng giới hạn số nhãn vẫn bỏ được VIP nếu đã có; nếu chưa có VIP và không thể thêm nhãn mới, giao diện giữ nguyên và giải thích lỗi.
- Nhãn VIP cũ viết là \`vip\`, \`Vip\` hoặc có khoảng trắng được coi là cùng một nhãn, không tạo bản sao.
- Nhãn khác của khách không thay đổi khi VIP được bật/tắt.
- Chuyển khách khi đang lưu không được làm thay đổi giao diện khách mới.

## Requirements

### Functional Requirements

- **FR-001**: Hệ thống MUST biến nút nhanh VIP trong hồ sơ khách hàng thành thao tác bật/tắt hoạt động được.
- **FR-002**: Hệ thống MUST dùng một nhãn chuẩn VIP để bật/tắt đánh dấu VIP trên khách hiện tại và so sánh nhãn không phân biệt hoa/thường.
- **FR-003**: Khi bật/tắt VIP, hệ thống MUST giữ nguyên mọi nhãn khác và lưu thay đổi cho đúng khách hàng.
- **FR-004**: Hệ thống MUST phản hồi trạng thái VIP ngay sau thao tác; nếu lưu thất bại, MUST hoàn nguyên về tập nhãn trước đó và hiển thị lỗi.
- **FR-005**: Hệ thống MUST bỏ qua phản hồi lưu đã cũ sau khi người dùng chuyển sang khách khác.
- **FR-006**: Nút VIP MUST có trạng thái chọn/bỏ chọn rõ ràng bằng biểu tượng hoặc chữ ngoài màu sắc; MUST hỗ trợ keyboard, tên truy cập và focus nhìn thấy được.
- **FR-007**: Gọi, Nhắc và Lưu trữ MUST giữ nguyên hành vi hiện tại; không tạo lịch sử cuộc gọi, nhắc việc, lưu trữ hội thoại hay thay đổi quyền người dùng trong phạm vi này.
- **FR-008**: Tính năng MUST giữ nguyên luồng lưu thông tin khách hàng, Lead Status, nhãn tùy chỉnh, bộ lọc hội thoại, rich message và campaign.

### Key Entities

- **Đánh dấu VIP**: Sự hiện diện hoặc vắng mặt của nhãn VIP trong tập nhãn của một khách hàng.
- **Trạng thái thao tác VIP**: Thông tin giao diện về việc đã chọn, đang lưu và lỗi lưu của VIP cho khách đang mở.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Trong toàn bộ kịch bản bật/tắt VIP, 100% thao tác thành công chỉ thêm hoặc bỏ một nhãn VIP và giữ nguyên các nhãn khác.
- **SC-002**: Trong toàn bộ kịch bản lỗi lưu VIP, 100% giao diện trở về tập nhãn trước thao tác và hiển thị thông báo lỗi.
- **SC-003**: Trong kịch bản chuyển khách khi đang lưu, 100% phản hồi cũ không thay đổi trạng thái khách mới.
- **SC-004**: Người dùng bàn phím hoàn thành bật/tắt VIP bằng Tab và Enter/Space, đồng thời nhận biết được trạng thái của nút mà không phụ thuộc duy nhất vào màu.

## Assumptions

- Nhãn khách hàng hiện có là nguồn dữ liệu duy nhất cho VIP; không tạo trường VIP, bảng dữ liệu hoặc màn hình quản trị mới.
- Hành vi gọi ra ngoài được hoãn để đặc tả và triển khai trong feature riêng sau này.
- Nhắc và Lưu trữ vẫn là các phần giao diện chưa được kích hoạt trong phạm vi Feature 030.
