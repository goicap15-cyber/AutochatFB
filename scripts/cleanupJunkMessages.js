// AutoChatbot - Cleanup Junk & System Messages Script
// Usage:
//   node scripts/cleanupJunkMessages.js --dry-run
//   node scripts/cleanupJunkMessages.js --thread 1024663197038881 --dry-run
//   node scripts/cleanupJunkMessages.js --thread 1024663197038881 --apply
//   node scripts/cleanupJunkMessages.js --apply
//   node scripts/cleanupJunkMessages.js --delete-exact "some text" --thread 123 --apply
//   node scripts/cleanupJunkMessages.js --delete-ids "498,500,501" --apply

const path = require('path');
const fs = require('fs');
const db = require('../src/server/database/db');
const { isSystemOrMetadataText, cleanMessageText } = require('../src/server/utils/textFilter');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply;

// Command line arguments parsing
const threadArgIdx = args.indexOf('--thread');
const targetThreadId = threadArgIdx !== -1 ? args[threadArgIdx + 1] : null;

const deleteExactIdx = args.indexOf('--delete-exact');
const deleteExactText = deleteExactIdx !== -1 ? args[deleteExactIdx + 1] : null;

const deleteIdsIdx = args.indexOf('--delete-ids');
const deleteIdsList = deleteIdsIdx !== -1 ? args[deleteIdsIdx + 1].split(',').map(s => Number(s.trim())).filter(n => n > 0) : [];

console.log('----------------------------------------------------');
console.log(`[Cleanup Script] Mode: ${isApply ? '🚀 APPLY (MODIFY DATABASE)' : '🔍 DRY-RUN (PREVIEW ONLY)'}`);
if (targetThreadId) console.log(`[Cleanup Script] Target Thread Filter: ${targetThreadId}`);
if (deleteExactText) console.log(`[Cleanup Script] Target Exact Text: "${deleteExactText}"`);
if (deleteIdsList.length) console.log(`[Cleanup Script] Target Delete IDs: [${deleteIdsList.join(', ')}]`);
console.log('----------------------------------------------------');

const sql = targetThreadId 
  ? 'SELECT id, thread_id, fb_message_id, content, created_at FROM messages WHERE thread_id = ?'
  : 'SELECT id, thread_id, fb_message_id, content, created_at FROM messages';

const allMessages = targetThreadId ? db.prepare(sql).all(targetThreadId) : db.prepare(sql).all();
console.log(`[Cleanup Script] Total messages scanned: ${allMessages.length}`);

const junkMessages = [];
const dirtyMessages = [];

// ── Sidebar contact-name scrape junk IDs (xác minh thủ công) ──
// Những dòng này là tên contact bị scrape nhầm vào thread Bảo Khánh (1024663197038881)
// từ lượt sync cũ bị lỗi. Content là tên người, không phải tin nhắn thật.
const VERIFIED_JUNK_IDS_BK = new Set([
  392, 397, 411,    // "Mang Bảo Khánh" (dom_* IDs - sidebar scrape)
  498,              // "Mang Bảo Khánh" (fb_sync_* ID)
  500,              // "Người dùng Facebook"
  501,              // "Nguyễn Hoàng Phúc"
  502,              // "Lê Tuyết"
  503,              // "Loan Tramphuong"
  504,              // "Duy Hoàng"
  505,              // "Quy Luong"
  506,              // "Tầm Xuân"
  507,              // "Thanhpho Xuanhai"
  508,              // "Chu Thanh Hổ"
  509,              // "Hải Hạnh"
  510,              // "Thanh Giu Se"
  511,              // "Son Ki"
  512,              // "Quốc Thông"
  513,              // "Phùng Bá Thuận"
  514,              // "Toản Trần"
  515,              // "Quang Liêm Chef"
  516,              // "Cát Bụi"
  517,              // "Mari Hoai Nguyen"
  518,              // "Nguyễn Ngọc Nữ"
  519,              // "Mang Bảo Khánh" (_r_62_)
  521,              // "Mang Bảo Khánh" (fb_sync_)
  566,              // "Mang Bảo Khánh" (fb_sync_ lần sync mới)
]);

for (const msg of allMessages) {
  const content = msg.content || '';
  const cleaned = cleanMessageText(content);

  let isCustomJunk = false;
  let reason = '';

  // 1. Manual exact-ID delete từ command line
  if (deleteIdsList.length && deleteIdsList.includes(msg.id)) {
    isCustomJunk = true;
    reason = 'Matched --delete-ids';
  }

  // 2. Manual exact-text delete từ command line (scoped theo thread nếu có)
  if (!isCustomJunk && deleteExactText && content === deleteExactText) {
    if (!targetThreadId || String(msg.thread_id) === String(targetThreadId)) {
      isCustomJunk = true;
      reason = `Matched --delete-exact "${deleteExactText}"`;
    }
  }

  // 3. Verified junk IDs cho thread Bảo Khánh
  if (!isCustomJunk && VERIFIED_JUNK_IDS_BK.has(msg.id) && String(msg.thread_id) === '1024663197038881') {
    isCustomJunk = true;
    reason = 'Verified sidebar/contact-name scrape junk (exact ID)';
  }

  // 4. Thread-specific known junk patterns
  if (!isCustomJunk && targetThreadId && String(msg.thread_id) === String(targetThreadId)) {
    if (content === 'Đang tải...') { isCustomJunk = true; reason = 'Loading placeholder'; }
    if (/^Hoạt động \d+.*trước$/i.test(content) || /^\d+\s*phút trước$/i.test(content)) { isCustomJunk = true; reason = 'Presence/activity status'; }
    if (/^[A-ZÀ-Ỹ][a-zA-ZÀ-ỹ]+\s+đã gửi,/i.test(content)) { isCustomJunk = true; reason = 'Accessibility "X đã gửi," prefix'; }
  }

  // 5. Generic system text filter
  if (!isCustomJunk && (!cleaned || isSystemOrMetadataText(cleaned))) {
    junkMessages.push({
      ...msg,
      reason: !cleaned ? 'Empty after clean' : 'Cleaned text is system text'
    });
    continue;
  }

  if (isCustomJunk) {
    junkMessages.push({ ...msg, reason });
  } else if (cleaned !== content.trim()) {
    dirtyMessages.push({ ...msg, cleaned });
  }
}

console.log(`[Cleanup Script] Found ${junkMessages.length} junk/system message(s) to remove.`);
console.log(`[Cleanup Script] Found ${dirtyMessages.length} message(s) with accessibility prefix to normalize to clean content.`);

if (junkMessages.length > 0) {
  console.log('\n--- Junk Messages Found (Up to 30): ---');
  junkMessages.slice(0, 30).forEach((item, idx) => {
    console.log(`${idx + 1}. [ID: ${item.id} | Thread: ${item.thread_id}] "${item.content.substring(0, 60)}" (${item.reason})`);
  });
  console.log('---------------------------------------\n');
}

if (dirtyMessages.length > 0) {
  console.log('\n--- Sample Dirty Messages to Normalize (Up to 20): ---');
  dirtyMessages.slice(0, 20).forEach((item, idx) => {
    console.log(`${idx + 1}. [ID: ${item.id}] RAW: "${item.content.substring(0, 50)}" ➔ CLEAN: "${item.cleaned}"`);
  });
  console.log('-----------------------------------------------------\n');
}

if (isDryRun) {
  console.log('[Cleanup Script] ⚠️ This was a DRY-RUN. No changes were made to database.db.');
  console.log('[Cleanup Script] To execute backup and apply cleanup, run:');
  console.log(`👉 node scripts/cleanupJunkMessages.js ${targetThreadId ? `--thread ${targetThreadId} ` : ''}--apply\n`);
  process.exit(0);
}

// ── EXECUTING APPLY MODE ──────────────────────────────────────────────────
async function runCleanup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `../data/database.db.bak_${timestamp}`);

  console.log(`[Cleanup Script] 📦 Creating SQLite WAL backup to: ${backupPath} ...`);
  
  try {
    await db.backup(backupPath);
    console.log('[Cleanup Script] ✅ Backup created successfully.');
  } catch (err) {
    console.error('[Cleanup Script] ❌ Failed to create database backup:', err.message);
    process.exit(1);
  }

  console.log('[Cleanup Script] 🧹 Deleting junk messages, normalizing dirty messages, updating threads, and rebuilding FTS5 index...');

  const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const updateContentStmt = db.prepare('UPDATE messages SET content = ? WHERE id = ?');
  
  const threadsToUpdate = targetThreadId 
    ? [{ id: targetThreadId }]
    : db.prepare('SELECT id FROM threads').all();

  const updateThreadLastMsg = db.prepare('UPDATE threads SET last_message = ? WHERE id = ?');

  const txn = db.transaction(() => {
    // 1. Delete junk messages
    for (const item of junkMessages) {
      deleteStmt.run(item.id);
    }

    // 2. Normalize accessibility text messages
    for (const item of dirtyMessages) {
      updateContentStmt.run(item.cleaned, item.id);
    }

    // 3. Refresh last_message for threads with latest valid message in DB
    for (const thread of threadsToUpdate) {
      const validMsgs = db.prepare(`
        SELECT content FROM messages 
        WHERE thread_id = ? 
        ORDER BY created_at DESC, id DESC 
        LIMIT 20
      `).all(thread.id);

      let cleanLast = '';
      for (const m of validMsgs) {
        const c = cleanMessageText(m.content);
        if (c && !isSystemOrMetadataText(c) && c !== 'Đang tải...') {
          cleanLast = c;
          break;
        }
      }

      updateThreadLastMsg.run(cleanLast || 'Chưa có tin nhắn', thread.id);
    }

    // 4. Rebuild FTS5 Index
    db.prepare('DELETE FROM messages_fts').run();
    db.prepare(`
      INSERT INTO messages_fts(rowid, content, thread_id, sender_id)
      SELECT id, content, thread_id, sender_id FROM messages WHERE content IS NOT NULL
    `).run();
  });

  try {
    txn();
    console.log(`[Cleanup Script] ✅ Cleaned ${junkMessages.length} junk message(s).`);
    console.log(`[Cleanup Script] ✅ Normalized ${dirtyMessages.length} dirty message(s).`);
    console.log(`[Cleanup Script] ✅ Updated threads last_message for ${threadsToUpdate.length} thread(s).`);
    console.log('[Cleanup Script] ✅ Rebuilt FTS5 Index successfully.');
    console.log('[Cleanup Script] 🎉 Cleanup process completed cleanly!');
  } catch (err) {
    console.error('[Cleanup Script] ❌ Transaction failed:', err.message);
    process.exit(1);
  }
}

runCleanup();
