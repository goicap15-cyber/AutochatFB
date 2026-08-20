require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const licenseService = require('./services/licenseService');

const app = express();
const PORT = process.env.PORT || 5055;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trang chủ health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'FB Personal Messenger CRM - Central License Server',
    time: new Date().toISOString()
  });
});

/**
 * Bảng giá công khai cho màn hình thanh toán
 */
app.get('/api/pricing', (req, res) => {
  try {
    res.json({ success: true, data: licenseService.getPricingSettings() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải bảng giá', error: error.message });
  }
});

/**
 * 1. API Tạo đơn hàng thanh toán
 * Body: { months: 1, machines: 2 }
 */
app.post('/api/orders/create', (req, res) => {
  try {
    const { months, machines } = req.body;
    const orderInfo = licenseService.createOrder({ months, machines });
    res.json({ success: true, data: orderInfo });
  } catch (error) {
    console.error('[API Create Order Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2. API Kiểm tra trạng thái đơn hàng (Polling từ App Client)
 * GET /api/orders/status/:orderCode
 */
app.get('/api/orders/status/:orderCode', (req, res) => {
  try {
    const { orderCode } = req.params;
    const order = licenseService.getOrder(orderCode);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    res.json({
      success: true,
      data: {
        orderCode: order.order_code,
        status: order.status,
        totalAmount: order.total_amount,
        keyValue: order.key_value || null,
        expiresAt: order.expires_at || null,
        paidAt: order.paid_at || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. Webhook nhận thông báo tiền vào từ SePay 24/7
 * POST /api/sepay/webhook
 */
app.post('/api/sepay/webhook', (req, res) => {
  try {
    const payload = req.body;
    console.log('[SePay Webhook Received]:', JSON.stringify(payload));

    // SePay gửi payload dạng: { transferAmount: 198000, content: "FB889234 CHUYEN TIEN", ... }
    const content = payload.content || payload.description || '';
    const transferAmount = parseFloat(payload.transferAmount || payload.amount || 0);

    // Tìm mã đơn hàng FBXXXXXX trong nội dung chuyển khoản
    const match = content.match(/FB\d{6}/i);

    if (!match) {
      console.log('[SePay Webhook] Không tìm thấy mã đơn FBxxxxxx trong nội dung:', content);
      return res.json({ success: true, message: 'Bỏ qua - Không có mã đơn hàng hợp lệ' });
    }

    const orderCode = match[0].toUpperCase();
    const result = licenseService.fulfillPayment(orderCode, transferAmount);

    if (result.success) {
      return res.json({ success: true, message: 'Xử lý thanh toán và sinh Key thành công', data: result });
    } else {
      return res.status(400).json({ success: false, message: result.reason || 'Xử lý thất bại' });
    }
  } catch (error) {
    console.error('[SePay Webhook Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4. API Kích hoạt License Key cho 1 máy tính
 * Body: { key: "KEY-XXXX", machineId: "CPU-1234", deviceName: "PC-Sales" }
 */
app.post('/api/license/activate', (req, res) => {
  try {
    const { key, machineId, deviceName } = req.body;
    const result = licenseService.activateLicense({ key, machineId, deviceName });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4b. Lưu tên công ty gắn với License Key sau thanh toán
 * Body: { key: "KEY-XXXX", companyName: "Tên công ty" }
 */
app.post('/api/license/company', (req, res) => {
  try {
    const result = licenseService.setCompanyName(req.body || {});
    if (!result.success) return res.status(result.status || 400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể lưu tên công ty', error: error.message });
  }
});

/**
 * 5. API Hủy kích hoạt / Đăng xuất Key khỏi 1 máy
 * Body: { key: "KEY-XXXX", machineId: "CPU-1234" }
 */
app.post('/api/license/deactivate', (req, res) => {
  try {
    const { key, machineId } = req.body;
    const result = licenseService.deactivateDevice({ key, machineId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6. API Verify bản quyền khi App Client khởi động
 * Body: { key: "KEY-XXXX", machineId: "CPU-1234" }
 */
app.post('/api/license/verify', (req, res) => {
  try {
    const { key, machineId } = req.body;
    const result = licenseService.verifyLicense({ key, machineId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

/**
 * 7. Admin API: Lấy danh sách Keys & Devices
 */
app.get('/api/admin/licenses', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    if (authHeader !== `Bearer ${pass}`) {
      return res.status(401).json({ success: false, message: 'Mật khẩu Admin không đúng' });
    }
    const licenses = licenseService.getAllLicenses();
    res.json({ success: true, data: licenses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/pricing', (req, res) => {
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  if (req.headers.authorization !== `Bearer ${pass}`) {
    return res.status(401).json({ success: false, message: 'Mật khẩu Admin không đúng' });
  }
  res.json({ success: true, data: licenseService.getPricingSettings() });
});

app.put('/api/admin/pricing', (req, res) => {
  try {
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    if (req.headers.authorization !== `Bearer ${pass}`) {
      return res.status(401).json({ success: false, message: 'Mật khẩu Admin không đúng' });
    }
    const result = licenseService.updatePricingSettings(req.body);
    if (!result.success) return res.status(result.status || 400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể cập nhật bảng giá', error: error.message });
  }
});

/**
 * 8. Admin API: Xóa / Gỡ thiết bị thủ công
 */
app.post('/api/admin/remove-device', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    if (authHeader !== `Bearer ${pass}`) {
      return res.status(401).json({ success: false, message: 'Mật khẩu Admin không đúng' });
    }
    const { deviceId } = req.body;
    const result = licenseService.removeDeviceAdmin(deviceId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 9. Admin API: Xóa vĩnh viễn License Key
 */
app.delete('/api/admin/licenses/:licenseId', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    if (authHeader !== `Bearer ${pass}`) {
      return res.status(401).json({ success: false, message: 'Mật khẩu Admin không đúng' });
    }

    const licenseId = Number(req.params.licenseId);
    if (!Number.isInteger(licenseId) || licenseId <= 0) {
      return res.status(400).json({ success: false, message: 'License ID không hợp lệ' });
    }

    const result = licenseService.deleteLicenseAdmin(licenseId);
    if (!result.success) return res.status(result.status || 400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve Admin UI Dashboard HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Central License Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🌐 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`=======================================================`);
});
