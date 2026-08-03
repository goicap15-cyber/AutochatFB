QUY TẮC CĂN CHỈNH VÀ BỐ CỤC BẮT BUỘC

Giao diện hiện tại đang bị dồn nội dung lên góc trên bên trái, chữ quá nhỏ, các thành phần thiếu khoảng cách và chưa tận dụng đúng chiều rộng màn hình. Hãy xây dựng lại theo hệ thống layout rõ ràng, không căn chỉnh thủ công bằng margin tùy ý.

1. Khung ứng dụng tổng thể

- Toàn bộ ứng dụng phải có:
  width: 100vw;
  height: 100vh;
  overflow: hidden;
- Không để xuất hiện thanh cuộn ở body.
- Sử dụng CSS Grid cho bố cục chính.
- Cấu trúc desktop:

  56px | 320px | minmax(520px, 1fr) | 340px

- Chiều cao toàn bộ các cột phải bằng đúng chiều cao viewport.
- Mỗi panel có border-right hoặc border-left 1 pixel.
- Không sử dụng position: absolute để dựng bố cục chính.
- Chỉ sử dụng position: absolute cho tooltip, dropdown, popover và menu nổi.

Ví dụ:

grid-template-columns:
  56px
  320px
  minmax(520px, 1fr)
  340px;

- Khi bảng Lead được thu gọn:

grid-template-columns:
  56px
  320px
  minmax(520px, 1fr);

2. Quy tắc chiều cao

Mỗi panel phải chia thành ba vùng rõ ràng:

- Header cố định.
- Nội dung có thể cuộn.
- Footer cố định nếu có.

Áp dụng cấu trúc:

display: flex;
flex-direction: column;
height: 100%;

Trong đó:

- Header: flex-shrink: 0.
- Content: flex: 1; min-height: 0; overflow-y: auto.
- Footer: flex-shrink: 0.

Bắt buộc có min-height: 0 cho vùng nội dung trong flex hoặc grid để tránh tràn màn hình.

3. Thanh điều hướng bên trái

- Chiều rộng cố định 56 pixel.
- Icon căn giữa theo cả chiều ngang và chiều dọc.
- Mỗi nút có kích thước 36 x 36 pixel.
- Khoảng cách giữa các nút là 8 pixel.
- Padding trên và dưới là 8 pixel.
- Logo có kích thước 32 x 32 pixel.
- Các nút cuối thanh điều hướng phải được đẩy xuống đáy bằng margin-top: auto.
- Không để icon dính sát mép trái hoặc mép trên.

4. Panel danh sách hội thoại

- Chiều rộng mặc định 320 pixel.
- Chiều rộng tối thiểu 280 pixel.
- Chiều rộng tối đa 380 pixel.
- Header panel cao từ 48 đến 52 pixel.
- Padding ngang toàn panel là 12 pixel.
- Khoảng cách giữa các nhóm nội dung là 8 pixel.
- Không để tiêu đề, ô tìm kiếm và bộ lọc dính sát nhau.

Cấu trúc từ trên xuống:

- Workspace header.
- Search box.
- Tab trạng thái.
- Bộ lọc nâng cao nếu đang mở.
- Danh sách hội thoại hoặc empty state.
- Pagination nếu sử dụng phân trang truyền thống.

Khoảng cách đề xuất:

- Workspace header đến search: 8 pixel.
- Search đến tabs: 8 pixel.
- Tabs đến bộ lọc nâng cao: 8 pixel.
- Bộ lọc đến danh sách: 8 pixel.

5. Header workspace

- Chiều cao tối thiểu 44 pixel.
- Tên workspace căn trái.
- Trạng thái kết nối nằm ngay sau tên, không nằm rời rạc.
- Nút tìm kiếm hoặc menu nằm bên phải.
- Sử dụng:

display: flex;
align-items: center;
justify-content: space-between;

- Không để chữ sát viền trên.
- Không để tiêu đề chỉ cao bằng đúng chiều cao dòng chữ.

6. Ô tìm kiếm

- Chiều cao 34 đến 36 pixel.
- Chiếm 100% chiều rộng khả dụng.
- Icon tìm kiếm nằm bên trái, cách viền 10 pixel.
- Text bắt đầu sau icon tối thiểu 8 pixel.
- Nút xóa tìm kiếm nằm bên phải.
- Không để placeholder bị cắt.
- Padding ngang tối thiểu 10 pixel.
- Border radius 7 đến 8 pixel.

7. Tab và bộ lọc

- Tab phải nằm trên một hàng riêng.
- Không đặt quá nhiều tab vào chiều rộng nhỏ khiến chữ bị co hoặc xuống dòng.
- Dùng CSS Grid chia đều chiều rộng:

grid-template-columns: repeat(4, minmax(0, 1fr));

- Chiều cao tab 30 đến 32 pixel.
- Text căn giữa.
- Font-size tối thiểu 12 pixel.
- Mỗi tab chỉ hiển thị một dòng.
- Sử dụng text-overflow: ellipsis khi cần.
- Trạng thái đang chọn phải có nền rõ hơn, không chỉ đổi màu chữ.

Bộ lọc nâng cao:

- Phải nằm trong một container riêng.
- Padding 10 đến 12 pixel.
- Các trường lọc xếp dọc, mỗi trường cách nhau 8 pixel.
- Label nằm trên input hoặc select.
- Không đặt label và input chen chúc trên cùng một hàng khi panel hẹp.
- Nút “Đóng” nằm bên phải header bộ lọc.
- Không để chữ “Bộ lọc nâng cao” và “Đóng” dính vào viền panel.

8. Danh sách hội thoại

Mỗi ConversationItem:

- Chiều cao tối thiểu 68 pixel.
- Padding 10 đến 12 pixel.
- Avatar 36 đến 40 pixel.
- Khoảng cách avatar với nội dung là 10 pixel.
- Tên khách hàng và thời gian nằm cùng hàng.
- Tin nhắn gần nhất nằm dưới tên.
- Badge trạng thái hoặc người phụ trách nằm ở hàng cuối nếu cần.
- Không để nội dung co nhỏ xuống dưới 12 pixel.
- Không để thời gian đẩy tên khách hàng ra ngoài.

Cấu trúc căn chỉnh:

- Cột avatar: flex-shrink: 0.
- Cột nội dung: flex: 1; min-width: 0.
- Cột trạng thái: flex-shrink: 0.

Các đoạn text dài phải dùng:

overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;

- Không để chiều cao item thay đổi quá lớn do nội dung dài.
- Item được chọn phải có indicator rõ ràng ở cạnh trái hoặc nền khác biệt.
- Toàn bộ item phải có vùng click, không chỉ riêng tên.

9. Empty state danh sách hội thoại

- Empty state phải nằm trong vùng content, không đẩy toàn bộ panel.
- Căn giữa theo chiều ngang.
- Căn theo chiều dọc ở khoảng 35 đến 40% chiều cao content, không nhất thiết chính giữa tuyệt đối.
- Chiều rộng nội dung tối đa 240 pixel.
- Icon nằm trên tiêu đề.
- Khoảng cách icon đến tiêu đề 12 pixel.
- Khoảng cách tiêu đề đến mô tả 6 pixel.
- Text mô tả căn giữa.
- Không để empty state dính ngay dưới bộ lọc.

10. Khu vực chat trung tâm

Khi chưa chọn hội thoại:

- Empty state phải căn giữa trong đúng phần content còn lại.
- Không tính header và message composer vào vùng căn giữa nếu hai thành phần này đang hiển thị.
- Nội dung empty state tối đa 420 pixel.
- Icon kích thước 40 đến 48 pixel.
- Tiêu đề không nhỏ hơn 14 pixel.
- Mô tả không nhỏ hơn 12 pixel.
- Không để empty state bị lệch do panel bên phải.

Khi đã chọn hội thoại:

- Chat header cao từ 56 đến 64 pixel.
- Message list chiếm toàn bộ không gian còn lại.
- Composer cố định ở đáy khu vực chat.
- Message list có padding ngang linh hoạt:

  clamp(16px, 3vw, 48px)

- Nội dung chat có max-width từ 900 đến 1100 pixel và căn giữa.
- Tin nhắn không kéo dài toàn bộ chiều ngang.
- Bubble tin nhắn có max-width 65 đến 72% vùng chat.
- Tin nhắn của khách căn trái.
- Tin nhắn của nhân viên căn phải.
- Không căn tin nhắn bằng position absolute.

11. Message composer

- Composer nằm cố định ở đáy panel chat bằng cấu trúc flex, không dùng fixed theo viewport.
- Chiều cao tối thiểu 64 pixel.
- Padding từ 12 đến 16 pixel.
- Ô nhập chiếm toàn bộ chiều rộng còn lại.
- Nút gửi có kích thước tối thiểu 36 x 36 pixel.
- Icon đính kèm nằm cùng hàng với ô nhập.
- Khi nội dung nhiều dòng, ô nhập được mở rộng tối đa khoảng 140 pixel.
- Sau mức này, phần nhập có scroll riêng.
- Composer không được che tin nhắn cuối cùng.
- Message list cần padding-bottom phù hợp.

12. Panel thông tin Lead

- Chiều rộng mặc định 340 pixel.
- Header cao bằng header chat.
- Tiêu đề căn trái và nằm giữa theo chiều dọc.
- Nội dung Lead có overflow-y: auto.
- Footer xuất dữ liệu phải nằm cố định ở đáy panel.
- Không dùng position: fixed cho footer.
- Footer có nền riêng và border-top.
- Padding footer từ 12 đến 16 pixel.

Cấu trúc:

LeadDetailsPanel
- LeadHeader
- LeadScrollableContent
- LeadFooter

Không để nút “Xuất Excel” nằm sát mép dưới màn hình hoặc bị cắt.

13. Empty state panel Lead

- Căn giữa cả ngang và dọc trong vùng content.
- Không tính header và footer.
- Chiều rộng tối đa 260 pixel.
- Icon nằm trên tiêu đề.
- Tiêu đề và mô tả căn giữa.
- Không để nội dung bị lệch xuống dưới do footer xuất dữ liệu.

14. Hệ thống khoảng cách

Chỉ sử dụng các giá trị spacing sau:

- 4 pixel
- 6 pixel
- 8 pixel
- 10 pixel
- 12 pixel
- 16 pixel
- 20 pixel
- 24 pixel
- 32 pixel

Không sử dụng các giá trị ngẫu nhiên như 13, 17, 19 hoặc 23 pixel nếu không có lý do đặc biệt.

Quy tắc:

- Khoảng cách giữa icon và text: 6 đến 8 pixel.
- Khoảng cách giữa các control cùng nhóm: 8 pixel.
- Khoảng cách giữa các nhóm: 12 đến 16 pixel.
- Padding panel: 12 đến 16 pixel.
- Padding trong button: 8 đến 12 pixel.
- Padding trong form field: 8 đến 10 pixel.

15. Quy tắc typography

- Không sử dụng font nhỏ hơn 12 pixel cho nội dung chức năng.
- Chỉ dùng font 11 pixel cho metadata phụ như thời gian hoặc trạng thái.
- Workspace title: 13 đến 14 pixel, font-weight 600.
- Panel title: 14 pixel, font-weight 600.
- Tên khách hàng: 13 pixel, font-weight 500 hoặc 600.
- Nội dung tin nhắn: 12 đến 13 pixel.
- Empty state title: 14 pixel, font-weight 600.
- Empty state description: 12 pixel, line-height từ 1.4 đến 1.5.
- Line-height không được quá thấp.
- Không scale toàn bộ giao diện xuống để chứa thêm nội dung.

16. Quy tắc responsive

Từ 1440 pixel trở lên:

- Hiển thị đủ bốn cột.
- Sidebar 56 pixel.
- Conversation panel 320 pixel.
- Lead panel 340 pixel.

Từ 1200 đến 1439 pixel:

- Conversation panel khoảng 300 pixel.
- Lead panel khoảng 300 đến 320 pixel.
- Cho phép thu gọn panel Lead.

Từ 900 đến 1199 pixel:

- Ẩn panel Lead mặc định.
- Mở Lead bằng drawer bên phải.
- Conversation panel rộng 300 pixel.
- Chat chiếm phần còn lại.

Dưới 900 pixel:

- Chỉ hiển thị một màn hình chính tại một thời điểm.
- Danh sách hội thoại và chat chuyển qua lại.
- Lead hiển thị bằng drawer toàn màn hình hoặc bottom sheet.
- Không ép bốn cột co lại trên màn hình nhỏ.

17. Quy tắc cuộn

- Mỗi panel có vùng scroll độc lập.
- Sidebar không cuộn.
- Danh sách hội thoại cuộn riêng.
- Message list cuộn riêng.
- Nội dung Lead cuộn riêng.
- Body không được cuộn.
- Header và footer không di chuyển theo nội dung.
- Scrollbar mảnh, tương phản thấp.
- Không ẩn scrollbar hoàn toàn trên desktop.
- Khi có tin nhắn mới, chỉ tự động cuộn xuống nếu người dùng đang gần cuối danh sách.
- Không tự động kéo người dùng xuống khi họ đang đọc tin nhắn cũ.

QUY TẮC PHÂN TRANG VÀ TẢI DỮ LIỆU

18. Phân trang danh sách hội thoại

Ưu tiên sử dụng cursor-based pagination hoặc infinite scroll, không dùng phân trang theo số trang nếu API hỗ trợ cursor.

Dữ liệu trả về đề xuất:

{
  "items": [],
  "nextCursor": "string hoặc null",
  "hasMore": true,
  "total": 1250
}

Quy tắc:

- Lần tải đầu lấy từ 20 đến 30 hội thoại.
- Khi cuộn còn cách cuối danh sách khoảng 200 pixel, tải trang tiếp theo.
- Không tải trùng dữ liệu.
- Không thay thế danh sách cũ khi tải thêm.
- Hiển thị skeleton ở cuối danh sách trong lúc tải.
- Khi hết dữ liệu, hiển thị dòng:
  “Đã hiển thị toàn bộ hội thoại”.
- Khi lỗi tải thêm, hiển thị nút:
  “Thử lại”.
- Giữ nguyên vị trí cuộn sau khi dữ liệu mới được nối vào.
- Khi đổi bộ lọc hoặc từ khóa tìm kiếm:
  - Xóa danh sách cũ.
  - Đặt cursor về null.
  - Tải lại từ đầu.
  - Đưa scroll về đầu danh sách.

19. Tìm kiếm và debounce

- Search hội thoại phải debounce từ 300 đến 500 mili giây.
- Không gọi API sau mỗi ký tự ngay lập tức.
- Khi từ khóa thay đổi:
  - Hủy request cũ bằng AbortController.
  - Reset pagination.
  - Hiển thị trạng thái loading.
- Không hiển thị kết quả của request cũ nếu request mới đã hoàn thành.
- Khi xóa từ khóa, tải lại danh sách mặc định.

20. Phân trang tin nhắn

Tin nhắn phải tải theo hướng ngược lên trên.

Dữ liệu trả về đề xuất:

{
  "items": [],
  "previousCursor": "string hoặc null",
  "hasMore": true
}

Quy tắc:

- Lần đầu tải từ 30 đến 50 tin nhắn mới nhất.
- Khi người dùng cuộn gần đầu danh sách, tải các tin nhắn cũ hơn.
- Tin nhắn cũ được chèn vào đầu danh sách.
- Sau khi chèn, phải giữ nguyên vị trí nội dung người dùng đang xem.
- Không được làm danh sách nhảy xuống dưới.
- Hiển thị loader nhỏ ở đầu message list.
- Khi hết lịch sử, hiển thị:
  “Đã đến tin nhắn đầu tiên”.
- Dùng message ID để loại bỏ bản ghi trùng.
- Tin nhắn mới từ WebSocket được nối vào cuối.
- Sắp xếp theo createdAt và message ID để ổn định thứ tự.

Cách giữ vị trí cuộn khi prepend dữ liệu:

- Ghi lại scrollHeight trước khi thêm dữ liệu.
- Thêm tin nhắn cũ.
- Tính scrollHeight mới.
- Cập nhật scrollTop bằng phần chênh lệch scrollHeight.

21. Phân trang lịch sử chăm sóc Lead

- Lịch sử hoạt động tải từ 15 đến 20 mục mỗi lần.
- Có thể dùng nút “Xem thêm” thay vì infinite scroll để tránh xung đột với scroll của panel Lead.
- Nút “Xem thêm” đặt cuối danh sách.
- Khi đang tải, nút chuyển thành trạng thái loading.
- Khi hết dữ liệu, ẩn nút.
- Không tải toàn bộ lịch sử ngay khi mở Lead.

22. Phân trang dạng số trang

Chỉ sử dụng phân trang số trang cho:

- Bảng báo cáo.
- Danh sách xuất dữ liệu.
- Danh sách nhân viên.
- Danh sách chiến dịch.
- Các màn hình quản trị dạng bảng.

Không sử dụng số trang cho hội thoại và tin nhắn.

Cấu trúc phân trang bảng:

- Bên trái hiển thị:
  “Hiển thị 1–20 trên 245 kết quả”.
- Bên phải gồm:
  - Nút trang trước.
  - Danh sách trang.
  - Nút trang sau.
  - Select số dòng mỗi trang.

Các mức số dòng:

- 20
- 50
- 100

Quy tắc hiển thị số trang:

- Luôn hiển thị trang đầu.
- Luôn hiển thị trang cuối.
- Hiển thị tối đa năm nút trang chính.
- Dùng dấu ba chấm khi khoảng cách lớn.
- Nút trang trước bị vô hiệu hóa ở trang đầu.
- Nút trang sau bị vô hiệu hóa ở trang cuối.
- Khi đổi page size, quay về trang đầu.
- Khi đổi filter hoặc search, quay về trang đầu.

23. Trạng thái tải dữ liệu

Mỗi khu vực phải có trạng thái riêng:

- initial loading
- loading more
- refreshing
- empty
- error
- success

Không sử dụng một biến loading chung cho toàn bộ ứng dụng.

Ví dụ:

{
  "isInitialLoading": false,
  "isFetchingMore": false,
  "isRefreshing": false,
  "hasMore": true,
  "error": null
}

- Initial loading dùng skeleton toàn vùng.
- Loading more chỉ dùng loader ở cuối hoặc đầu danh sách.
- Refresh không được xóa dữ liệu đang hiển thị.
- Error tải trang đầu dùng error state toàn vùng.
- Error tải thêm chỉ hiển thị lỗi nhỏ tại vị trí pagination.

24. Skeleton loading

- Skeleton phải có kích thước gần giống nội dung thật.
- Danh sách hội thoại hiển thị từ 6 đến 8 skeleton item.
- Message list hiển thị các bubble skeleton xen kẽ trái và phải.
- Lead panel hiển thị skeleton theo từng field.
- Không sử dụng spinner lớn ở chính giữa toàn màn hình.
- Không làm toàn bộ giao diện biến mất khi chỉ một panel đang tải.

25. Đồng bộ bộ lọc với URL

Các trạng thái sau nên được lưu trên URL query:

- status
- assignee
- unread
- search
- page đối với bảng dữ liệu
- pageSize đối với bảng dữ liệu

Ví dụ:

/conversations?status=pending&assignee=me&unread=true

- Khi tải lại trang phải giữ nguyên bộ lọc.
- Khi thay đổi filter, cập nhật URL nhưng không reload toàn bộ ứng dụng.
- Không lưu cursor của infinite scroll vào URL.

26. Giữ trạng thái giao diện

- Khi mở một hội thoại rồi quay lại danh sách, giữ nguyên vị trí cuộn.
- Khi đóng rồi mở lại panel Lead, giữ nguyên tab đang chọn.
- Khi chuyển hội thoại, hủy request tin nhắn của hội thoại trước.
- Không để dữ liệu hội thoại trước xuất hiện trong hội thoại mới.
- Có thể cache dữ liệu bằng TanStack Query.
- Sử dụng query key rõ ràng theo filter và conversation ID.

Ví dụ:

["conversations", filters]
["messages", conversationId]
["lead", conversationId]
["leadActivities", leadId]

27. Quy tắc chống tràn giao diện

- Mọi flex child chứa text phải có min-width: 0.
- Mọi vùng cuộn trong flex phải có min-height: 0.
- Text dài phải ellipsis hoặc wrap có kiểm soát.
- Email, số điện thoại và URL dài không được làm rộng panel.
- Dùng overflow-wrap: anywhere cho dữ liệu dài.
- Dropdown phải nằm trong viewport.
- Popover gần cạnh phải phải tự đổi hướng.
- Không để footer xuất dữ liệu đè lên nội dung Lead.
- Không để composer che tin nhắn cuối.
- Không để bộ lọc làm giảm danh sách hội thoại xuống chiều cao bằng 0.

28. Yêu cầu kiểm tra cuối cùng

Trước khi hoàn thành, kiểm tra giao diện tại các kích thước:

- 1920 x 1080
- 1600 x 900
- 1440 x 900
- 1366 x 768
- 1280 x 720
- 1024 x 768
- 768 x 1024
- 390 x 844

Đảm bảo:

- Không có nội dung bị cắt.
- Không có chữ quá nhỏ.
- Không có khoảng trống vô lý.
- Không có thành phần dính sát mép.
- Empty state được căn đúng vùng.
- Footer không bị tràn khỏi màn hình.
- Mỗi panel cuộn độc lập.
- Pagination không làm thay đổi chiều rộng layout.
- Layout không bị co toàn bộ khi độ phân giải thấp.