# Quickstart Validation: CRM Conversation Filter Drawer

## Prerequisites

- CRM chạy, có ít nhất hai source hoặc hai Lead Status để test multi-select.
- Có threads khác source/status; nếu không, test riêng zero/one option.

## Run

```bash
npm start
```

Mở CRM và reload nếu server đã chạy sẵn.

## Validation

1. Hai select cũ biến mất, chỉ còn phễu.
2. Chọn hai nguồn, Apply: mỗi kết quả thuộc một trong hai.
3. Thêm status, Apply: mỗi kết quả đạt cả nguồn và status.
4. Đổi draft rồi Hủy/Escape/click ngoài: list/badge không đổi.
5. Xóa tất cả + Apply: list trở lại không lọc, badge biến mất.
6. Test keyboard, light/dark, drawer hẹp, zoom 200%, search/tab/hotkey/campaign selection.

## Automated Checks

```bash
npm run test:persistence
npm run build:ui
```
