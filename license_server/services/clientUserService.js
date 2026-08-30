const bcrypt = require('bcryptjs');
const db = require('../db');

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

function credentials(input = {}) {
  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!USERNAME_PATTERN.test(username)) return { error: 'INVALID_USERNAME', message: 'Tên đăng nhập không hợp lệ.' };
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return { error: 'INVALID_PASSWORD', message: 'Mật khẩu phải có 8-72 ký tự.' };
  return { username, password };
}

function publicUser(row) {
  return row && { id: row.id, username: row.username, status: row.status, created_at: row.created_at, last_login_at: row.last_login_at, last_machine_id: row.last_machine_id, company_role: row.company_role || 'ADMIN', company_admin_id: row.company_admin_id || row.id };
}

function createCompanyEmployee({ adminUsername, username, password }) {
  const admin = db.prepare("SELECT id,license_id FROM client_users WHERE username=? COLLATE NOCASE AND company_role='ADMIN'").get(String(adminUsername || '').trim());
  if (!admin?.license_id) return { success: false, status: 403, code: 'ADMIN_PACKAGE_REQUIRED', message: 'Admin doanh nghiệp chưa có gói License.' };
  const value = credentials({ username, password });
  if (value.error) return { success: false, status: 400, code: value.error, message: value.message };
  try {
    const result = db.prepare("INSERT INTO client_users(username,password_hash,status,license_id,company_admin_id,company_role) VALUES (?,?,'ACTIVE',?,?,'EMPLOYEE')")
      .run(value.username, bcrypt.hashSync(value.password, 12), admin.license_id, admin.id);
    return { success: true, data: publicUser(db.prepare('SELECT * FROM client_users WHERE id=?').get(result.lastInsertRowid)) };
  } catch (error) {
    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) return { success: false, status: 409, code: 'USERNAME_TAKEN', message: 'Tên đăng nhập đã được sử dụng.' };
    throw error;
  }
}

function removeCompanyEmployee({ adminUsername, username }) {
  const admin = db.prepare("SELECT id FROM client_users WHERE username=? COLLATE NOCASE AND company_role='ADMIN'").get(String(adminUsername || '').trim());
  if (!admin) return { success: false, status: 403, message: 'Không có quyền quản lý doanh nghiệp.' };
  const result = db.prepare("DELETE FROM client_users WHERE username=? COLLATE NOCASE AND company_admin_id=? AND company_role='EMPLOYEE'")
    .run(String(username || '').trim(), admin.id);
  return result.changes ? { success: true } : { success: false, status: 404, message: 'Không tìm thấy nhân viên.' };
}

function register(input) {
  const value = credentials(input);
  if (value.error) return { success: false, status: 400, code: value.error, message: value.message };
  try {
    const result = db.prepare("INSERT INTO client_users (username,password_hash,status) VALUES (?,?,'ACTIVE')")
      .run(value.username, bcrypt.hashSync(value.password, 12));
    return { success: true, data: publicUser(db.prepare('SELECT * FROM client_users WHERE id=?').get(result.lastInsertRowid)) };
  } catch (error) {
    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) return { success: false, status: 409, code: 'USERNAME_TAKEN', message: 'Tên đăng nhập đã được sử dụng.' };
    throw error;
  }
}

function login(input) {
  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  const row = db.prepare('SELECT * FROM client_users WHERE username=? COLLATE NOCASE').get(username);
  if (!row) return { success: false, status: 404, code: 'USER_NOT_FOUND', message: 'Tài khoản chưa được đồng bộ.' };
  if (!bcrypt.compareSync(password, row.password_hash)) return { success: false, status: 401, code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  if (row.status === 'BLOCKED') return { success: false, status: 403, code: 'ACCOUNT_BLOCKED', message: 'Tài khoản đã bị quản trị viên khóa.' };
  db.prepare('UPDATE client_users SET last_login_at=CURRENT_TIMESTAMP,last_machine_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(String(input.machineId || '').slice(0, 200) || null, row.id);
  return { success: true, data: publicUser(db.prepare('SELECT * FROM client_users WHERE id=?').get(row.id)) };
}

function list() {
  return db.prepare(`
    SELECT u.id,u.username,u.status,u.created_at,u.last_login_at,u.last_machine_id,u.updated_at,
      l.key_value AS license_key,l.company_name,l.months AS package_months,l.expires_at AS package_expires_at,
      CASE WHEN l.id IS NOT NULL AND l.is_active=1 AND datetime(l.expires_at)>datetime('now') THEN 'ACTIVE' ELSE 'NONE' END AS package_status
    FROM client_users u
    LEFT JOIN licenses l ON l.id=u.license_id
    ORDER BY u.id DESC
  `).all();
}

function bindLicense(username, key) {
  const license = db.prepare('SELECT id FROM licenses WHERE key_value=? AND is_active=1').get(String(key || '').trim());
  if (!license) return false;
  return db.prepare('UPDATE client_users SET license_id=?,updated_at=CURRENT_TIMESTAMP WHERE username=? COLLATE NOCASE')
    .run(license.id, String(username || '').trim()).changes > 0;
}

function licenseStatus({ username, key, machineId }) {
  const row = db.prepare(`SELECT l.id AS license_id, l.key_value, l.expires_at, l.machines, l.is_active
    FROM client_users u LEFT JOIN licenses l ON l.id=u.license_id
    WHERE u.username=? COLLATE NOCASE`).get(String(username || '').trim());
  if (!row?.key_value) return { valid: false, reason: 'NO_PACKAGE', message: 'Tài khoản chưa có gói License.' };
  
  const providedKey = String(key || '').trim();
  if (providedKey && row.key_value !== providedKey) {
    return { valid: false, reason: 'WRONG_ACCOUNT_LICENSE', message: 'License trên máy không thuộc tài khoản này.' };
  }
  
  if (!row.is_active || new Date(row.expires_at) <= new Date()) {
    return { valid: false, reason: 'EXPIRED', message: 'Gói License đã hết hạn.' };
  }

  const mId = String(machineId || '').trim();
  if (mId) {
    const device = db.prepare('SELECT id FROM license_devices WHERE license_id=? AND machine_id=?')
      .get(row.license_id, mId);
    if (!device) {
      const registeredCount = db.prepare('SELECT COUNT(*) AS total FROM license_devices WHERE license_id=?').get(row.license_id)?.total || 0;
      if (registeredCount < (row.machines || 1)) {
        try {
          db.prepare('INSERT INTO license_devices (license_id, machine_id, device_name) VALUES (?, ?, ?)')
            .run(row.license_id, mId, 'Máy CRM (' + String(username || '') + ')');
        } catch (e) {}
      } else {
        return { valid: false, reason: 'MAX_DEVICES_REACHED', message: `Gói đã đạt giới hạn tối đa ${row.machines} thiết bị sử dụng.` };
      }
    }
  }

  return { valid: true, key: row.key_value, expiresAt: row.expires_at, machines: row.machines, daysRemaining: Math.ceil((new Date(row.expires_at)-Date.now())/86400000) };
}

function accountStatus({ username }) {
  const row = db.prepare('SELECT id,username,status FROM client_users WHERE username=? COLLATE NOCASE')
    .get(String(username || '').trim());
  if (!row) return { success: false, status: 404, code: 'USER_NOT_FOUND', message: 'Tài khoản không còn tồn tại.' };
  if (row.status !== 'ACTIVE') return { success: false, status: 403, code: 'ACCOUNT_BLOCKED', message: 'Tài khoản đã bị khóa.' };
  return { success: true, data: publicUser(row) };
}

function setStatus(id, status) {
  const normalized = String(status || '').toUpperCase();
  if (!['ACTIVE', 'BLOCKED'].includes(normalized)) return { success: false, status: 400, message: 'Trạng thái không hợp lệ.' };
  const result = db.prepare('UPDATE client_users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(normalized, Number(id));
  if (!result.changes) return { success: false, status: 404, message: 'Không tìm thấy tài khoản.' };
  return { success: true, data: publicUser(db.prepare('SELECT * FROM client_users WHERE id=?').get(Number(id))) };
}

function resetPassword(id, password) {
  const text = String(password || '');
  if (text.length < 8 || Buffer.byteLength(text, 'utf8') > 72) return { success: false, status: 400, message: 'Mật khẩu phải có 8-72 ký tự.' };
  const result = db.prepare('UPDATE client_users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(bcrypt.hashSync(text, 12), Number(id));
  if (!result.changes) return { success: false, status: 404, message: 'Không tìm thấy tài khoản.' };
  return { success: true };
}

function remove(id) {
  const result = db.prepare('DELETE FROM client_users WHERE id=?').run(Number(id));
  if (!result.changes) return { success: false, status: 404, message: 'Không tìm thấy tài khoản.' };
  return { success: true, deleted: result.changes };
}

function removeAll() {
  const result = db.prepare('DELETE FROM client_users').run();
  return { success: true, deleted: result.changes };
}

module.exports = { register, login, list, accountStatus, createCompanyEmployee, removeCompanyEmployee, setStatus, resetPassword, remove, removeAll, bindLicense, licenseStatus };
