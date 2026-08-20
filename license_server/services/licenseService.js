const crypto = require('crypto');
const db = require('../db');

class LicenseService {
  getPricingSettings() {
    const row = db.prepare('SELECT * FROM pricing_settings WHERE id = 1').get();
    return {
      unitPrice: row.unit_price,
      extraSlotPrice: row.extra_slot_price,
      discounts: { 1: row.discount_1, 3: row.discount_3, 6: row.discount_6, 12: row.discount_12 },
      updatedAt: row.updated_at
    };
  }

  updatePricingSettings(input = {}) {
    const unitPrice = Number(input.unitPrice);
    const extraSlotPrice = Number(input.extraSlotPrice);
    const discounts = input.discounts || {};
    if (!Number.isInteger(unitPrice) || unitPrice <= 0 || unitPrice > 100000000) {
      return { success: false, status: 400, message: 'Đơn giá phải là số nguyên từ 1 đến 100.000.000đ' };
    }
    if (!Number.isInteger(extraSlotPrice) || extraSlotPrice < 0 || extraSlotPrice > 100000000) {
      return { success: false, status: 400, message: 'Giá thêm slot phải là số nguyên từ 0 đến 100.000.000đ' };
    }
    const values = [1, 3, 6, 12].map((month) => Number(discounts[month]));
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 90)) {
      return { success: false, status: 400, message: 'Mức giảm giá phải là số nguyên từ 0 đến 90%' };
    }
    db.prepare(`UPDATE pricing_settings SET unit_price = ?, extra_slot_price = ?, discount_1 = ?, discount_3 = ?, discount_6 = ?, discount_12 = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(unitPrice, extraSlotPrice, ...values);
    return { success: true, data: this.getPricingSettings() };
  }

  /**
   * Tính tổng tiền theo bảng giá đang được Admin cấu hình.
   */
  calculatePrice(months, machines) {
    const pricing = this.getPricingSettings();
    const UNIT_PRICE = pricing.unitPrice;
    const EXTRA_SLOT_PRICE = pricing.extraSlotPrice;
    let discountPercent = pricing.discounts[1];
    if (months >= 12) discountPercent = pricing.discounts[12];
    else if (months >= 6) discountPercent = pricing.discounts[6];
    else if (months >= 3) discountPercent = pricing.discounts[3];

    const rawTotal = months * (UNIT_PRICE + Math.max(0, machines - 1) * EXTRA_SLOT_PRICE);
    const finalTotal = Math.floor(rawTotal * (1 - discountPercent / 100));

    return {
      unitPrice: UNIT_PRICE,
      extraSlotPrice: EXTRA_SLOT_PRICE,
      months,
      machines,
      discountPercent,
      rawTotal,
      finalTotal
    };
  }

  /**
   * Tạo đơn hàng thanh toán mới
   */
  createOrder({ months, machines }) {
    const monthsNum = Math.max(1, parseInt(months, 10) || 1);
    const machinesNum = Math.max(1, parseInt(machines, 10) || 1);
    const priceInfo = this.calculatePrice(monthsNum, machinesNum);

    const orderId = 'ORD_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const orderCode = 'FB' + Math.floor(100000 + Math.random() * 900000);

    db.prepare(`
      INSERT INTO orders (id, order_code, months, machines, unit_price, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(orderId, orderCode, monthsNum, machinesNum, priceInfo.unitPrice, priceInfo.finalTotal);

    const bankNo = process.env.BANK_ACCOUNT_NUMBER || '0813468094';
    const bankName = process.env.BANK_NAME || 'MBBank';
    const accountName = process.env.BANK_ACCOUNT_NAME || 'LE VAN KHANG';

    const qrCodeUrl = `https://img.vietqr.io/image/${bankName}-${bankNo}-compact.png?amount=${priceInfo.finalTotal}&addInfo=${orderCode}&accountName=${encodeURIComponent(accountName)}`;

    return {
      orderId,
      orderCode,
      months: monthsNum,
      machines: machinesNum,
      totalAmount: priceInfo.finalTotal,
      discountPercent: priceInfo.discountPercent,
      bankNo,
      bankName,
      accountName,
      qrCodeUrl,
      status: 'PENDING'
    };
  }

  /**
   * Lấy thông tin đơn hàng
   */
  getOrder(orderCodeOrId) {
    return db.prepare(`
      SELECT o.*, l.key_value, l.expires_at
      FROM orders o
      LEFT JOIN licenses l ON o.id = l.order_id
      WHERE o.id = ? OR o.order_code = ?
    `).get(orderCodeOrId, orderCodeOrId);
  }

  /**
   * Sinh chuỗi Mã Key: KEY-XXXX-XXXX-XXXX-XXXX
   */
  generateKeyString() {
    const part = () => crypto.randomBytes(3).toString('hex').toUpperCase();
    return `KEY-${part()}-${part()}-${part()}-${part()}`;
  }

  /**
   * Xử lý thanh toán từ SePay Webhook
   */
  fulfillPayment(orderCode, transactionAmount) {
    const order = db.prepare('SELECT * FROM orders WHERE order_code = ?').get(orderCode);
    if (!order) {
      return { success: false, reason: 'ORDER_NOT_FOUND' };
    }

    if (order.status === 'PAID') {
      const existingLicense = db.prepare('SELECT * FROM licenses WHERE order_id = ?').get(order.id);
      return { success: true, alreadyPaid: true, order, license: existingLicense };
    }

    if (transactionAmount < order.total_amount) {
      console.warn(`[Payment] Đơn hàng ${orderCode} thiếu tiền: Nhận ${transactionAmount}, Cần ${order.total_amount}`);
      return { success: false, reason: 'AMOUNT_MISMATCH', required: order.total_amount, received: transactionAmount };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (order.months * 30));

    const keyValue = this.generateKeyString();

    const tx = db.transaction(() => {
      db.prepare(`UPDATE orders SET status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE id = ?`).run(order.id);
      db.prepare(`
        INSERT INTO licenses (order_id, key_value, machines, months, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(order.id, keyValue, order.machines, order.months, expiresAt.toISOString());
    });

    tx();

    const createdLicense = db.prepare('SELECT * FROM licenses WHERE order_id = ?').get(order.id);
    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);

    console.log(`[Payment] ✅ Đã khớp đơn ${orderCode}! Đã cấp Key: ${keyValue}`);

    return {
      success: true,
      order: updatedOrder,
      license: createdLicense
    };
  }

  /**
   * Kích hoạt License Key cho một máy tính (Machine ID)
   */
  activateLicense({ key, machineId, deviceName }) {
    if (!key || !machineId) {
      return { success: false, reason: 'INVALID_PARAMS', message: 'Thiếu Key hoặc Machine ID' };
    }

    const license = db.prepare('SELECT * FROM licenses WHERE key_value = ? AND is_active = 1').get(key.trim());
    if (!license) {
      return { success: false, reason: 'KEY_NOT_FOUND', message: 'Mã License Key không tồn tại hoặc đã bị khóa' };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    if (now > expiresAt) {
      return { success: false, reason: 'KEY_EXPIRED', message: 'License Key đã hết hạn sử dụng', expiresAt: license.expires_at };
    }

    // Kiểm tra xem máy này đã kích hoạt trước đó chưa
    const existingDevice = db.prepare('SELECT * FROM license_devices WHERE license_id = ? AND machine_id = ?').get(license.id, machineId);

    if (existingDevice) {
      // Cập nhật last_seen
      db.prepare('UPDATE license_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(existingDevice.id);
      return {
        success: true,
        message: 'Kích hoạt thành công (Thiết bị cũ)',
        license: {
          key: license.key_value,
          machines: license.machines,
          expiresAt: license.expires_at
        }
      };
    }

    // Đếm số máy đã kích hoạt hiện tại
    const activeCount = db.prepare('SELECT COUNT(*) as count FROM license_devices WHERE license_id = ?').get(license.id).count;

    if (activeCount >= license.machines) {
      return {
        success: false,
        reason: 'SLOTS_FULL',
        message: `Mã Key này đã đạt giới hạn tối đa ${license.machines}/${license.machines} máy. Vui lòng đăng xuất ở máy khác trước.`
      };
    }

    // Đăng ký máy mới vào CSDL
    db.prepare(`
      INSERT INTO license_devices (license_id, machine_id, device_name)
      VALUES (?, ?, ?)
    `).run(license.id, machineId, deviceName || 'Máy CRM');

    return {
      success: true,
      message: 'Kích hoạt License thành công!',
      license: {
        key: license.key_value,
        machines: license.machines,
        expiresAt: license.expires_at,
        usedSlots: activeCount + 1
      }
    };
  }

  /**
   * Đăng xuất / Hủy liên kết một máy khỏi Key (Deactivate)
   */
  deactivateDevice({ key, machineId }) {
    const license = db.prepare('SELECT * FROM licenses WHERE key_value = ?').get(key.trim());
    if (!license) {
      return { success: false, reason: 'KEY_NOT_FOUND' };
    }

    const res = db.prepare('DELETE FROM license_devices WHERE license_id = ? AND machine_id = ?').run(license.id, machineId);
    return {
      success: true,
      removed: res.changes > 0,
      message: res.changes > 0 ? 'Đã hủy liên kết máy này thành công' : 'Máy này chưa từng kích hoạt'
    };
  }

  /**
   * Verify bản quyền realtime khi App khởi động
   */
  verifyLicense({ key, machineId }) {
    if (!key || !machineId) {
      return { valid: false, reason: 'MISSING_PARAMS' };
    }

    const license = db.prepare('SELECT * FROM licenses WHERE key_value = ? AND is_active = 1').get(key.trim());
    if (!license) {
      return { valid: false, reason: 'KEY_NOT_FOUND', message: 'License Key không hợp lệ' };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    if (now > expiresAt) {
      return { valid: false, reason: 'EXPIRED', message: 'License đã hết hạn', expiresAt: license.expires_at };
    }

    const device = db.prepare('SELECT * FROM license_devices WHERE license_id = ? AND machine_id = ?').get(license.id, machineId);
    if (!device) {
      return { valid: false, reason: 'DEVICE_NOT_ACTIVATED', message: 'Máy tính này chưa được đăng ký kích hoạt cho Key này' };
    }

    // Cập nhật last_seen
    db.prepare('UPDATE license_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(device.id);

    return {
      valid: true,
      expiresAt: license.expires_at,
      machines: license.machines,
      daysRemaining: Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Lưu tên công ty theo License Key sau khi khách hàng thanh toán.
   */
  setCompanyName({ key, companyName }) {
    const normalizedKey = String(key || '').trim();
    const normalizedName = String(companyName || '').trim().replace(/\s+/g, ' ');
    if (!normalizedKey) {
      return { success: false, status: 400, reason: 'INVALID_KEY', message: 'Thiếu License Key' };
    }
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      return { success: false, status: 400, reason: 'INVALID_COMPANY_NAME', message: 'Tên công ty phải từ 2 đến 120 ký tự' };
    }

    const license = db.prepare('SELECT id FROM licenses WHERE key_value = ? AND is_active = 1').get(normalizedKey);
    if (!license) {
      return { success: false, status: 404, reason: 'KEY_NOT_FOUND', message: 'License Key không tồn tại hoặc đã bị khóa' };
    }

    db.prepare('UPDATE licenses SET company_name = ? WHERE id = ?').run(normalizedName, license.id);
    return { success: true, companyName: normalizedName };
  }

  /**
   * Admin: Lấy danh sách tất cả các Key & Thiết bị
   */
  getAllLicenses() {
    const licenses = db.prepare(`
      SELECT l.*, o.order_code, o.total_amount,
             o.paid_at, o.created_at AS order_created_at
      FROM licenses l
      JOIN orders o ON l.order_id = o.id
      ORDER BY l.created_at DESC
    `).all();

    for (const lic of licenses) {
      lic.devices = db.prepare('SELECT * FROM license_devices WHERE license_id = ?').all(lic.id);
    }
    return licenses;
  }

  /**
   * Admin: Gỡ thiết bị thủ công
   */
  removeDeviceAdmin(deviceId) {
    db.prepare('DELETE FROM license_devices WHERE id = ?').run(deviceId);
    return { success: true };
  }

  /**
   * Admin: Xóa vĩnh viễn License Key và toàn bộ thiết bị liên quan.
   * Đơn hàng được giữ lại để bảo toàn lịch sử thanh toán.
   */
  deleteLicenseAdmin(licenseId) {
    const license = db.prepare('SELECT id, key_value FROM licenses WHERE id = ?').get(licenseId);
    if (!license) return { success: false, status: 404, message: 'Không tìm thấy License Key' };

    const removeLicense = db.transaction(() => {
      db.prepare('DELETE FROM license_devices WHERE license_id = ?').run(licenseId);
      db.prepare('DELETE FROM licenses WHERE id = ?').run(licenseId);
    });
    removeLicense();

    return { success: true, key: license.key_value };
  }
}

module.exports = new LicenseService();
