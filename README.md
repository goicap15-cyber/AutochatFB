# AutoChatbot

Hệ thống chatbot tự động tích hợp với Facebook Messenger thông qua Chrome Extension và server Node.js.

---

## 🚀 Hướng dẫn chạy project

### Bước 1: Cài Extension vào Chrome

1. Mở Chrome, truy cập `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Nhấn **Load unpacked**
4. Chọn thư mục `src/extension/` trong project này
5. Extension sẽ xuất hiện trong danh sách — đảm bảo nó đang được **bật (enabled)**

### Bước 2: Đăng nhập Facebook

1. Mở tab mới trong Chrome
2. Truy cập [https://www.facebook.com](https://www.facebook.com) và đăng nhập vào tài khoản Facebook của bạn
3. Giữ tab này mở trong suốt quá trình sử dụng

### Bước 3: Khởi động Server

Chạy lệnh sau tại thư mục gốc của project:

```bash
npm run start
```

Server sẽ khởi động và sẵn sàng nhận kết nối từ Extension.

---

## 📋 Yêu cầu hệ thống

- Node.js >= 16
- Google Chrome (phiên bản mới nhất)
- Tài khoản Facebook đang hoạt động

---

## 📁 Cấu trúc thư mục

```
autochatbot/
├── src/
│   ├── extension/     # Chrome Extension (content script, background)
│   └── client/        # Giao diện người dùng
├── package.json
└── README.md
```
