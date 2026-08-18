// AutoChatbot - Cleanup Junk Business Suite Switcher-Panel Messages
// Feature 023: page_content.js used to leak non-message UI text (the
// account/page switcher panel: "Tài khoản của bạn", "Trang quản lý tài sản
// doanh nghiệp", "X tài sản doanh nghiệp", Page/Business-Manager names) into
// `messages` as if it were real chat content. Those rows always came from the
// page_dom_observer path with no real Facebook message ID attached - the
// `messages` table has no `source` column to filter on directly, so this
// script scopes via inbox_sources.source_type = 'page_messenger' and
// fb_message_id IS NULL, then matches the known junk strings.
//
// Usage:
//   node scripts/cleanupJunkPageUiMessages.js --dry-run
//   node scripts/cleanupJunkPageUiMessages.js --thread 100092115712908 --dry-run
//   node scripts/cleanupJunkPageUiMessages.js --apply
//   node scripts/cleanupJunkPageUiMessages.js --thread 100092115712908 --apply

const path = require('path');
const db = require('../src/server/database/db');
const { isSystemOrMetadataText } = require('../src/server/utils/textFilter');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply;

const threadArgIdx = args.indexOf('--thread');
const targetThreadId = threadArgIdx !== -1 ? args[threadArgIdx + 1] : null;

// Known Business Suite account/page-switcher panel strings, mirroring the
// denylist added to src/extension/page_content.js (forwardResolvedMessage).
// Incomplete by design: the switcher panel also renders arbitrary dynamic
// text (Page names, contact names, BM handles - e.g. "Cà Phê Hà Nội - 299",
// "Mai Nguyen Ngoc", "Bm14126.adsup13") that no fixed string list can ever
// fully cover. See the fbMessageId check below for the signal that catches
// those too.
const JUNK_PATTERNS = [
  'tài sản doanh nghiệp',
  'tài khoản của bạn',
  'trang quản lý tài sản doanh nghiệp'
];

// `messages.fb_message_id` for a row with no real Facebook ID falls back to
// ConversationRepository.fingerprint(), which stamps it 'history_<hash>'
// (src/server/repositories/ConversationRepository.js ~L251). Checked against
// the live database: every single 'history_%' row that exists today is one
// of these switcher-panel junk items (11/11, across every thread) - none are
// genuine messages. This is a heuristic based on current data, not a
// guaranteed-forever invariant (a legitimate message could in principle also
// fall back to this fingerprint), which is exactly why this script always
// requires a dry-run review before --apply.
function isJunk(msg) {
  const lower = (msg.content || '').toLowerCase();
  if (JUNK_PATTERNS.some((p) => lower.includes(p))) return true;
  if (String(msg.fb_message_id || '').startsWith('history_')) return true;
  // Reuses the shared filter (date/time separators, presence text, etc.)
  // instead of maintaining a third hand-copied pattern list here - any
  // future addition to textFilter.js is picked up automatically. Mirrors
  // server.js's own guard exactly: a real media message (photo/file) can
  // legitimately have empty content, and isSystemOrMetadataText('') is
  // always true - so this must never run against a row that actually has
  // an attachment, or every real empty-caption photo would be deleted too.
  const hasMedia = !!(msg.media_url || (msg.media_type && msg.media_type !== 'text'));
  if (!hasMedia && isSystemOrMetadataText(msg.content)) return true;
  return false;
}

console.log('----------------------------------------------------');
console.log(`[Cleanup Script] Mode: ${isApply ? '🚀 APPLY (MODIFY DATABASE)' : '🔍 DRY-RUN (PREVIEW ONLY)'}`);
if (targetThreadId) console.log(`[Cleanup Script] Target Thread Filter: ${targetThreadId}`);
console.log('----------------------------------------------------');

const sql = `
  SELECT m.id, m.thread_id, m.fb_message_id, m.content, m.created_at, m.media_type, m.media_url
  FROM messages m
  JOIN threads t ON t.id = m.thread_id
  JOIN inbox_sources s ON s.id = t.source_id
  WHERE s.source_type = 'page_messenger'
    ${targetThreadId ? 'AND m.thread_id = ?' : ''}
`;

const candidates = targetThreadId ? db.prepare(sql).all(targetThreadId) : db.prepare(sql).all();
console.log(`[Cleanup Script] Page-sourced messages scanned: ${candidates.length}`);

const junkMessages = candidates.filter(isJunk);

console.log(`[Cleanup Script] Found ${junkMessages.length} switcher-panel junk message(s) to remove.`);

if (junkMessages.length > 0) {
  console.log('\n--- Junk Messages Found (Up to 30): ---');
  junkMessages.slice(0, 30).forEach((item, idx) => {
    console.log(`${idx + 1}. [ID: ${item.id} | Thread: ${item.thread_id} | Created: ${item.created_at}] "${(item.content || '').substring(0, 60)}"`);
  });
  console.log('---------------------------------------\n');
}

if (isDryRun) {
  console.log('[Cleanup Script] ⚠️ This was a DRY-RUN. No changes were made to database.db.');
  console.log('[Cleanup Script] Review the list above for false positives before applying.');
  console.log('[Cleanup Script] To execute backup and apply cleanup, run:');
  console.log(`👉 node scripts/cleanupJunkPageUiMessages.js ${targetThreadId ? `--thread ${targetThreadId} ` : ''}--apply\n`);
  process.exit(0);
}

if (junkMessages.length === 0) {
  console.log('[Cleanup Script] Nothing to delete. Exiting.');
  process.exit(0);
}

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

  const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const affectedThreadIds = [...new Set(junkMessages.map((m) => m.thread_id))];
  const updateThreadLastMsg = db.prepare('UPDATE threads SET last_message = ? WHERE id = ?');

  const txn = db.transaction(() => {
    for (const item of junkMessages) {
      deleteStmt.run(item.id);
    }

    // Refresh last_message for affected threads so the sidebar preview no
    // longer shows a just-deleted junk row as the latest message.
    for (const threadId of affectedThreadIds) {
      const latest = db.prepare(`
        SELECT content FROM messages
        WHERE thread_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `).get(threadId);
      updateThreadLastMsg.run(latest ? latest.content : 'Chưa có tin nhắn', threadId);
    }

    db.prepare('DELETE FROM messages_fts').run();
    db.prepare(`
      INSERT INTO messages_fts(rowid, content, thread_id, sender_id)
      SELECT id, content, thread_id, sender_id FROM messages WHERE content IS NOT NULL
    `).run();
  });

  try {
    txn();
    console.log(`[Cleanup Script] ✅ Deleted ${junkMessages.length} junk message(s).`);
    console.log(`[Cleanup Script] ✅ Updated last_message for ${affectedThreadIds.length} affected thread(s).`);
    console.log('[Cleanup Script] ✅ Rebuilt FTS5 index.');
    console.log('[Cleanup Script] 🎉 Cleanup process completed cleanly!');
  } catch (err) {
    console.error('[Cleanup Script] ❌ Transaction failed:', err.message);
    process.exit(1);
  }
}

runCleanup();
