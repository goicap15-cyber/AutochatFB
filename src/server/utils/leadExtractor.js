/**
 * leadExtractor.js
 * Trích xuất tự động SĐT & Email từ nội dung tin nhắn bằng Regex chuẩn Việt Nam.
 */

// Regex SĐT Việt Nam: 10 chữ số, bắt đầu 03x, 05x, 07x, 08x, 09x
const VN_PHONE_REGEX = /(?<!\d)(0(?:3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])\d{7})(?!\d)/g;

// Regex Email chuẩn RFC
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/**
 * Trích xuất danh sách SĐT & Email từ chuỗi nội dung tin nhắn
 * @param {string} content - Nội dung tin nhắn cần phân tích
 * @returns {{ phones: string[], emails: string[] }}
 */
function extractLeadInfo(content) {
  if (!content || typeof content !== 'string') {
    return { phones: [], emails: [] };
  }

  const phones = [...content.matchAll(VN_PHONE_REGEX)].map((m) => m[0]);
  const emails = [...content.matchAll(EMAIL_REGEX)].map((m) => m[0]);

  return {
    phones: [...new Set(phones)],
    emails: [...new Set(emails)]
  };
}

module.exports = { extractLeadInfo };
