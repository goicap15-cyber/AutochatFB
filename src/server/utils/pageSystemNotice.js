const AUTOMATIC_LEAD_ACTIVITY = 'Đã tự động tạo hoạt động về khách hàng tiềm năng cho bạn dựa trên cuộc trò chuyện này';

function normalizeNotice(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!…]+$/u, '')
    .toLocaleLowerCase('vi-VN');
}

function isKnownPageSystemNotice(value) {
  return normalizeNotice(value) === normalizeNotice(AUTOMATIC_LEAD_ACTIVITY);
}

module.exports = { AUTOMATIC_LEAD_ACTIVITY, isKnownPageSystemNotice, normalizeNotice };
