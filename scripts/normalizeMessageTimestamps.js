const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'database.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('Không tìm thấy database tại', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const threadIdOpt = args.find(a => a.startsWith('--thread='));
const beforeDateOpt = args.find(a => a.startsWith('--before='));
const sourceOpt = args.find(a => a.startsWith('--source='));

let threadId = threadIdOpt ? threadIdOpt.split('=')[1] : null;
let beforeDate = beforeDateOpt ? beforeDateOpt.split('=')[1] : null;
// Default targets the original 'no real signal at all' category. Pass
// --source=dom_order to instead clean up messages mis-stamped by the
// feature 010 DOM-position interpolation before feature 014's backend
// seeding existed (a content-script restart with an empty anchor map
// stamped a message from days ago as "now" - see specs/014).
let sources = sourceOpt ? sourceOpt.split('=')[1].split(',').map(s => s.trim()).filter(Boolean) : ['unknown', 'fallback'];

console.log('=== KỊCH BẢN CHUẨN HÓA TIMESTAMP TIN NHẮN ===');
if (!isApply) {
  console.log('CHẾ ĐỘ: DRY-RUN (Chỉ đọc, không xóa)');
} else {
  console.log('CHẾ ĐỘ: APPLY (Sẽ xóa dữ liệu nếu thỏa điều kiện)');
  if (!threadId && !beforeDate) {
    console.error('❌ Cảnh báo: Phải cung cấp --thread=<id> hoặc --before=<YYYY-MM-DD> khi dùng --apply để tránh xóa nhầm toàn bộ DB.');
    process.exit(1);
  }
}

try {
  // Check if timestamp_source exists, just in case
  db.prepare("SELECT timestamp_source FROM messages LIMIT 1").get();
} catch (e) {
  console.error('❌ Cột timestamp_source chưa tồn tại trong CSDL. Hãy chạy server trước để nó tự động tạo migration.');
  process.exit(1);
}

// dom_order rows are far more common than the original unknown/fallback
// category (it's the normal tsSource for most Page messages since feature
// 010), so deleting them without pinning to one thread is much riskier -
// require --thread explicitly in that case rather than accepting --before alone.
if (isApply && sources.includes('dom_order') && !threadId) {
  console.error('❌ --source=dom_order yêu cầu phải chỉ định --thread=<id> khi dùng --apply (phạm vi ảnh hưởng rộng hơn unknown/fallback).');
  process.exit(1);
}

const sourcePlaceholders = sources.map(() => '?').join(', ');
let query = `
  SELECT COUNT(*) as count
  FROM messages
  WHERE timestamp_source IN (${sourcePlaceholders})
`;

let deleteQuery = `
  DELETE FROM messages
  WHERE timestamp_source IN (${sourcePlaceholders})
`;

const params = [...sources];

if (threadId) {
  query += ' AND thread_id = ?';
  deleteQuery += ' AND thread_id = ?';
  params.push(threadId);
}

if (beforeDate) {
  query += ' AND created_at < ?';
  deleteQuery += ' AND created_at < ?';
  params.push(beforeDate);
}

const result = db.prepare(query).get(...params);
console.log(`Tìm thấy ${result.count} tin nhắn cũ (${sources.join('/')})${threadId ? ` trong thread ${threadId}` : ''}${beforeDate ? ` trước ngày ${beforeDate}` : ''}.`);

if (isApply) {
  if (result.count > 0) {
    const delRes = db.prepare(deleteQuery).run(...params);
    console.log(`✅ Đã xóa thành công ${delRes.changes} tin nhắn cũ. Bạn có thể mở ứng dụng để sync lại lịch sử chính xác.`);
  } else {
    console.log('Không có tin nhắn nào cần xóa.');
  }
} else {
  console.log('Chạy lại với --apply --thread=<id> để thực thi xóa các tin nhắn này và lấy lại lịch sử.');
}

db.close();
