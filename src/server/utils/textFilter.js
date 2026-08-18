// AutoChatbot - Text Filter Utility for Backend & Script Cleanup
const { isKnownPageSystemNotice } = require('./pageSystemNotice');

const SYSTEM_PATTERNS = [
  // E2EE & Security Notices
  /Tin nhắn và cuộc gọi (?:đang )?được bảo mật/i,
  /bảo mật bằng tính năng mã hóa/i,
  /bảo mật đầu cuối/i,

  // Footer, Privacy & Links
  /^Tìm hiểu thêm$/i,
  /^Xem thêm$/i,
  /^Quyền riêng tư/i,
  /^Cookie$/i,
  /^Facebook$/i,
  /^Messenger$/i,
  /^Meta$/i,
  /^Trang chủ$/i,
  /^Khôi phục ngay$/i,
  /^Thiếu lịch sử chat/i,
  /^Bạn đã tạo nhóm này/i,
  /^Chỉ những người tham gia/i,
  /^Bản quyền Meta/i,

  // Status & Presence (exact standalone matches only)
  /^(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen)$/i,
  /^(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen)\s+\d+\s+(?:giây|phút|giờ|ngày|tuần|tháng|năm)\s+(?:trước|ago)$/i,
  /^(?:Đang hoạt động.*|Hoạt động(?:\s+\d+.*)?|Đã hoạt động.*|Active now|Active recently|Active \d+.*|Online|Offline)$/i,
  /^(?:Typing[.…]*|Đang nhập[.…]*|Đang gửi[.…]*|Sending[.…]*)$/i,
  /^(?:Đang tải|Loading)[.…]*$/i,

  // Accessibility / System standalone
  /^Nhấn Enter để gửi$/i,

  // Standalone Timestamps (e.g. 09:09, 16:36 T5, 18:00 T5, 12:30 AM, T5, CN)
  /^\d{1,2}:\d{2}(?:\s*(?:T[2-7]|CN|AM|PM))?$/i,
  /^(?:T[2-7]|CN)$/i,

  // Full date/time separator header Business Suite renders between message
  // groups (e.g. "13:52 6 Tháng 8, 2026") - not covered by the short
  // standalone-clock-time pattern above. Without this, page_content.js's
  // 1s-interval full-page rescan re-detects this separator as a "new"
  // message every tick forever (its direction never resolves, so the
  // dedup Set never remembers it) - one missing pattern here becomes an
  // unbounded stream of duplicate rows, not just one.
  /^\d{1,2}:\d{2}\s+\d{1,2}\s+Tháng\s+\d{1,2},?\s+\d{4}$/i
];

function isSystemOrMetadataText(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isKnownPageSystemNotice(trimmed)) return true;

  for (const pat of SYSTEM_PATTERNS) {
    if (pat.test(trimmed)) return true;
  }
  return false;
}

function cleanMessageText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();
  if (!text) return '';

  // 1. Strip accessibility prefix (handling 'Tin nhắn do X gửi lúc Thứ Năm 18:00ch:', 'Tin nhắn do X gửi lúc 18:00:', etc.)
  text = text.replace(/^(?:Nhập,\s*)?Tin nhắn do [\s\S]+? gửi lúc [^\n]*?(?:ch:|\b\d{1,2}:\d{2}(?:ch)?:|\b\d{1,2}:\d{2}(?:ch)?\s+)\s*/i, '').trim();
  text = text.replace(/^Nhập,\s*/i, '').trim();
  text = text.replace(/^[:\s]+/, '').trim();

  const sentEmojiMatch = text.match(/^[^,\n]{1,80}\s+(?:đã gửi|sent),\s*(.+)$/i);
  if (sentEmojiMatch) {
    const payload = sentEmojiMatch[1].trim();
    if (payload && !/[A-Za-zÀ-ỹ0-9]/.test(payload)) {
      text = payload;
    }
  }

  // 2. Strip delivery status ONLY if appended on a separate line or after multi-space metadata (never strip inside normal text like 'Đã gửi hàng rồi')
  text = text.replace(/(?:\n|\r|\s{2,})(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen|Nhấn Enter để gửi)\s*$/i, '').trim();

  // 3. Strip leading/trailing timestamps ONLY if isolated/standalone on line
  text = text.replace(/^\d{1,2}:\d{2}\s*(?:T[2-7]|CN|AM|PM)?\s*$/i, '').replace(/(?:\n|\r)\s*\d{1,2}:\d{2}\s*(?:T[2-7]|CN|AM|PM)?$/i, '').trim();
  text = text.replace(/^[:\s]+/, '').trim();

  if (!text) return '';

  if (isSystemOrMetadataText(text)) return '';

  return text;
}

module.exports = {
  isSystemOrMetadataText,
  cleanMessageText
};
