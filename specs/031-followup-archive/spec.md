# Feature Specification: CRM Follow-up Reminder and Archive

**Feature Branch**: 031-followup-archive  
**Created**: 2026-08-14  
**Status**: Draft

**Input**: Thêm thao tác Nhắc tạo việc follow-up theo hội thoại và Lưu để lưu trữ hội thoại CRM; không gửi tin hay thay đổi dữ liệu Facebook.

## User Scenarios & Testing

### User Story 1 - Đặt và xử lý nhắc hẹn (Priority: P1)

Nhân viên đang xem một hội thoại bấm Nhắc, chọn một thời điểm trong tương lai và có thể ghi ghi chú ngắn về việc cần làm. Khi đến hạn, CRM làm nổi bật đúng hội thoại để nhân viên quay lại xử lý, rồi họ có thể hoàn thành, đổi giờ hoặc hủy nhắc.

**Why this priority**: Nhân viên không còn phải nhớ thủ công các lần cần gọi lại, báo giá hoặc theo dõi khách.

**Independent Test**: Tạo nhắc cho một hội thoại, tải lại CRM để xác nhận nhắc còn tồn tại; đến thời điểm hẹn, xác nhận hội thoại hiển thị là cần xử lý; hoàn thành/hủy và xác nhận chỉ nhắc đó biến mất.

**Acceptance Scenarios**:

1. **Given** một hội thoại đang mở và chưa có nhắc hoạt động, **When** nhân viên chọn thời gian tương lai rồi xác nhận, **Then** CRM lưu một nhắc gắn với đúng hội thoại và cho biết thời điểm/ghi chú đã hẹn.
2. **Given** nhắc đã đến hạn, **When** nhân viên xem CRM, **Then** hội thoại được nhận biết rõ là cần nhắc lại mà không thay đổi tin nhắn hay trạng thái Lead của khách.
3. **Given** hội thoại đã có nhắc, **When** nhân viên đổi thời điểm hoặc ghi chú, **Then** chỉ nhắc hiện có được cập nhật, không tạo nhắc trùng.
4. **Given** nhắc đã đến hạn, **When** nhân viên bấm Hoàn thành hoặc Hủy, **Then** nhắc không còn xuất hiện là việc đang chờ và lịch sử tin nhắn/hồ sơ khách vẫn giữ nguyên.

---

### User Story 2 - Lưu trữ và khôi phục hội thoại (Priority: P1)

Nhân viên bấm Lưu để dọn Inbox sau khi đã xử lý xong. Hội thoại rời khỏi danh sách mặc định nhưng toàn bộ lịch sử, hồ sơ khách, nhãn và trạng thái vẫn còn. Nhân viên có thể tìm/khôi phục nó; khi khách gửi tin nhắn mới, hội thoại tự trở lại Inbox.

**Why this priority**: Inbox gọn hơn mà không có rủi ro xóa nhầm dữ liệu hoặc bỏ sót khách quay lại.

**Independent Test**: Lưu một hội thoại, kiểm tra nó biến khỏi Inbox mặc định nhưng vẫn tìm và khôi phục được; lưu lại rồi nhận tin mới để xác nhận tự trở lại Inbox với dữ liệu cũ nguyên vẹn.

**Acceptance Scenarios**:

1. **Given** hội thoại đang ở Inbox, **When** nhân viên bấm Lưu và xác nhận, **Then** hội thoại bị ẩn khỏi danh sách Inbox mặc định nhưng không bị xóa.
2. **Given** một hội thoại đã lưu trữ, **When** nhân viên xem danh sách Lưu trữ hoặc tìm kiếm, **Then** họ mở được đúng hội thoại và bấm Khôi phục để đưa lại Inbox.
3. **Given** hội thoại đã lưu trữ, **When** có tin nhắn mới đến từ khách, **Then** hội thoại tự trở lại Inbox và vẫn giữ toàn bộ dữ liệu trước đó.
4. **Given** hội thoại đã lưu trữ có nhắc đang hoạt động, **When** nhắc đến hạn, **Then** CRM vẫn hiển thị/đưa hội thoại vào nơi nhân viên nhìn thấy để không bỏ lỡ follow-up.

---

### User Story 3 - An toàn, rõ trạng thái và dùng bàn phím (Priority: P2)

Nhân viên biết hội thoại nào đang có nhắc hoặc đã lưu trữ, hiểu thao tác nào sẽ xảy ra trước khi xác nhận, và hoàn thành được các thao tác bằng bàn phím.

**Why this priority**: Lưu trữ không được bị hiểu thành xóa, còn nhắc cần có thời gian rõ ràng để tránh bỏ lỡ.

**Independent Test**: Dùng bàn phím mở Nhắc, đặt/hủy nhắc, lưu/khôi phục hội thoại; kiểm tra focus, nhãn truy cập, trạng thái và thông báo lỗi.

**Acceptance Scenarios**:

1. **Given** hộp đặt nhắc mở, **When** nhân viên dùng Tab, Enter/Space và Escape, **Then** họ chọn/xác nhận/hủy được mà không vô tình thay đổi nhắc đang tồn tại.
2. **Given** nhân viên sắp lưu trữ hội thoại, **When** CRM hiển thị xác nhận, **Then** nội dung nói rõ đây không phải thao tác xóa và có đường khôi phục.
3. **Given** một thao tác lưu thất bại, **When** CRM nhận lỗi, **Then** trạng thái hiển thị trở về như trước và nhân viên nhận được thông báo có thể thử lại.

### Edge Cases

- Không cho tạo nhắc ở thời điểm đã qua; mốc thời gian được hiển thị nhất quán theo múi giờ của người dùng.
- Mỗi hội thoại có tối đa một nhắc đang hoạt động; đặt lại nhắc là cập nhật nhắc cũ, không nhân đôi.
- Hội thoại lưu trữ vẫn phải tìm được khi nhân viên chủ động xem/tìm lưu trữ, không xuất hiện trong Inbox mặc định trừ khi có tin mới hoặc nhắc đến hạn.
- Tin nhắn mới của khách khôi phục hội thoại; tin nhắn do CRM/nhân viên gửi đi không tự khôi phục hội thoại lưu trữ.
- Nếu nhân viên mở cùng hội thoại ở hai cửa sổ, kết quả cuối cùng được hiển thị nhất quán sau khi tải lại; không được mất lịch sử/tin nhắn.
- Nhắc đến hạn trong lúc CRM đang tắt được đánh dấu ngay khi CRM mở lại, không bị bỏ qua.

## Requirements

### Functional Requirements

- **FR-001**: Hệ thống MUST biến nút Nhắc thành thao tác tạo, xem, đổi thời điểm và hủy hoặc hoàn thành một nhắc gắn với hội thoại hiện tại.
- **FR-002**: Hệ thống MUST yêu cầu thời điểm nhắc nằm trong tương lai và cho phép nhân viên thêm ghi chú ngắn tùy chọn.
- **FR-003**: Hệ thống MUST cho phép các lựa chọn thời gian nhanh và một thời điểm do nhân viên chọn.
- **FR-004**: Hệ thống MUST chỉ giữ một nhắc đang hoạt động trên mỗi hội thoại; thay đổi nhắc MUST cập nhật nhắc đó thay vì tạo trùng.
- **FR-005**: Khi nhắc đến hạn, hệ thống MUST làm nổi bật hội thoại là cần follow-up và cho phép hoàn thành, dời giờ hoặc hủy; việc này MUST không gửi tin, không thay đổi tin nhắn, nhãn, Lead Status hay dữ liệu Facebook.
- **FR-006**: Hệ thống MUST lưu nhắc qua việc tải lại CRM và MUST nhận biết các nhắc đã đến hạn khi CRM mở lại.
- **FR-007**: Hệ thống MUST biến nút Lưu thành thao tác lưu trữ hội thoại CRM cục bộ, không phải xóa hội thoại hay xóa dữ liệu Facebook.
- **FR-008**: Sau khi lưu trữ thành công, hệ thống MUST ẩn hội thoại khỏi Inbox mặc định, đồng thời giữ nguyên lịch sử tin nhắn, thông tin khách, nhãn, Lead Status và nhắc.
- **FR-009**: Hệ thống MUST cung cấp cách xem, tìm và khôi phục hội thoại đã lưu trữ. Khôi phục MUST đưa hội thoại trở lại Inbox mặc định.
- **FR-010**: Hệ thống MUST tự khôi phục hội thoại đã lưu trữ khi nhận tin nhắn mới từ khách; tin nhắn gửi đi không được kích hoạt việc này.
- **FR-011**: Nhắc đến hạn trên hội thoại đang lưu trữ MUST vẫn được nhân viên thấy rõ và không được mất chỉ vì hội thoại bị ẩn khỏi Inbox thường.
- **FR-012**: Giao diện MUST có xác nhận trước khi lưu trữ, nêu rõ không xóa dữ liệu; mọi thao tác MUST có loading, rollback khi lỗi, thông báo rõ ràng, keyboard support, focus visible và tín hiệu trạng thái không chỉ dựa vào màu.
- **FR-013**: Feature này MUST giữ nguyên hành vi của Gọi, VIP, custom tags, Lead Status, bộ lọc hội thoại, rich message, campaign và đồng bộ Messenger ngoài các điều kiện tự khôi phục được nêu ở FR-010.

### Key Entities

- **Nhắc hội thoại**: Một follow-up đang hoạt động hoặc đã hoàn thành/hủy, gắn với một hội thoại, gồm thời điểm hẹn, ghi chú tùy chọn và trạng thái.
- **Trạng thái lưu trữ hội thoại**: Việc hội thoại đang ở Inbox thường hay Lưu trữ CRM; không phản ánh trạng thái/xóa trên Facebook.
- **Follow-up đến hạn**: Nhắc chưa hoàn thành có thời điểm bằng hoặc trước thời điểm hiện tại, cần được nhân viên nhận biết và xử lý.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Nhân viên tạo nhắc cho một hội thoại bằng không quá 3 thao tác chính sau khi bấm Nhắc.
- **SC-002**: 100% nhắc hợp lệ còn tồn tại sau khi tải lại CRM và 100% nhắc quá hạn được hiển thị là cần follow-up khi CRM mở lại.
- **SC-003**: Trong toàn bộ kịch bản lưu trữ/khôi phục, 100% lịch sử tin nhắn, thông tin khách, nhãn và trạng thái của hội thoại được bảo toàn.
- **SC-004**: Trong toàn bộ kịch bản tin nhắn mới từ khách, 100% hội thoại đang lưu trữ tự trở lại Inbox; 100% tin gửi đi không gây khôi phục sai.
- **SC-005**: 100% hủy hoặc lỗi lưu nhắc/lưu trữ giữ trạng thái hiển thị trước thao tác và nêu lý do có thể hành động.
- **SC-006**: Người dùng bàn phím hoàn thành đặt nhắc, hủy nhắc, lưu trữ và khôi phục mà vẫn thấy focus và hiểu trạng thái không chỉ qua màu.

## Assumptions

- Nhắc ban đầu chỉ là follow-up trong CRM; không cần gửi email, push notification hệ điều hành hay tin nhắn Facebook.
- Một nhắc hoạt động cho mỗi hội thoại là đủ cho đợt đầu; lịch sử nhắc có thể mở rộng sau.
- Lưu nghĩa là lưu trữ cục bộ CRM, không phải đánh dấu Đã chốt, không xóa và không gọi thao tác archive của Facebook.
- Nhắc đến hạn sẽ có hiển thị nổi bật trong CRM và không được phép bị che hoàn toàn bởi trạng thái lưu trữ.
- Quyền truy cập sử dụng quy tắc CRM hiện có; feature không thêm vai trò mới.
