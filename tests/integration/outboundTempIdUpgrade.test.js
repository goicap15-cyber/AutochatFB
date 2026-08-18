const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');

function withDatabase(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-test-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try { return run(db); } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// Mirrors server.js's existing pending->DOM correlation UPDATE exactly (see
// NEW_MESSAGE_RECEIVED handler) - not a shared helper, since that logic lives
// inline in server.js and isn't exposed as a function. Kept in lockstep with
// server.js on purpose: if server.js's SQL changes, this test should be
// updated to match, so it keeps testing the real behavior.
function correlatePendingWithTempId(db, threadId, content, tempFbMessageId) {
  const pending = db.prepare(`
    SELECT id, client_message_id FROM messages
    WHERE thread_id = ? AND content = ? AND is_outgoing = 1 AND delivery_status = 'pending'
    ORDER BY id DESC LIMIT 1
  `).get(threadId, content);
  if (!pending) return null;
  db.prepare(`
    UPDATE messages SET fb_message_id = ?, delivery_status = 'sent', delivery_error = NULL
    WHERE id = ?
  `).run(tempFbMessageId, pending.id);
  return pending.id;
}

// Mirrors server.js's feature-020 temp-id-upgrade check exactly.
function upgradeTempId(db, threadId, content, newFbMessageId) {
  const recentSent = db.prepare(`
    SELECT id, client_message_id, fb_message_id FROM messages
    WHERE thread_id = ? AND content = ? AND is_outgoing = 1 AND delivery_status = 'sent'
      AND fb_message_id IS NOT NULL AND fb_message_id != ?
      AND datetime(created_at) >= datetime('now', '-8 seconds')
    ORDER BY id DESC LIMIT 1
  `).get(threadId, content, newFbMessageId);
  if (!recentSent) return null;
  db.prepare('UPDATE messages SET fb_message_id = ? WHERE id = ?').run(newFbMessageId, recentSent.id);
  return recentSent.id;
}

function insertPending(db, threadId, clientMessageId, content) {
  db.prepare(`
    INSERT INTO messages (thread_id, client_message_id, sender_id, content, is_outgoing, delivery_status, created_at)
    VALUES (?, ?, 'SYSTEM', ?, 1, 'pending', datetime('now'))
  `).run(threadId, clientMessageId, content);
}

function insertSent(db, threadId, fbMessageId, content) {
  db.prepare(`
    INSERT INTO messages (thread_id, fb_message_id, sender_id, content, is_outgoing, delivery_status, created_at)
    VALUES (?, ?, 'SYSTEM', ?, 1, 'sent', datetime('now'))
  `).run(threadId, fbMessageId, content);
}

// Regression for feature 020 (US1/FR-001): the exact sequence observed live -
// pending row created by a CRM send, correlated to Facebook's temporary
// (non-mid.$) id, then a later scan reports the permanent mid.$... id for
// the same real message. Must upgrade in place, not create a second row.
test('outgoing message id-upgrade (temp -> permanent) updates in place, no duplicate row', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  db.prepare('INSERT INTO threads (id, account_id, contact_name) VALUES (?, ?, ?)').run('thread-out-1', 'acct-1', 'Khach hang');

  insertPending(db, 'thread-out-1', 'queue_abc', 'lo a');

  const correlatedId = correlatePendingWithTempId(db, 'thread-out-1', 'lo a', '7491704639551390961');
  assert.ok(correlatedId, 'pending row must be found and correlated with the temp id');
  assert.equal(db.prepare('SELECT fb_message_id, delivery_status FROM messages WHERE id = ?').get(correlatedId).fb_message_id, '7491704639551390961');

  const upgradedId = upgradeTempId(db, 'thread-out-1', 'lo a', 'mid.$cAAQXQILUZ2SmEMwBymf34a1Km0Tx');
  assert.equal(upgradedId, correlatedId, 'the upgrade must target the SAME row the temp id was correlated to');

  const rows = db.prepare('SELECT fb_message_id FROM messages WHERE thread_id = ?').all('thread-out-1');
  assert.equal(rows.length, 1, 'exactly one row must exist for this send, not two');
  assert.equal(rows[0].fb_message_id, 'mid.$cAAQXQILUZ2SmEMwBymf34a1Km0Tx');
}));

// KNOWN LIMITATION (US2, spec.md Assumptions): the upgrade match is scoped to
// thread+content+direction+recency, not to a specific pending send - so a
// message that never had a pending row at all (e.g. typed directly in
// Business Suite by the operator, not via the CRM queue) with content
// identical to an already-sent CRM message within the 8s window gets merged
// into that unrelated row instead of getting its own. Pinned here so this
// trade-off is visible and deliberate, not silently regressed further.
test('KNOWN LIMITATION: an unrelated identical-content send within the window merges into the wrong row', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  db.prepare('INSERT INTO threads (id, account_id, contact_name) VALUES (?, ?, ?)').run('thread-out-2', 'acct-1', 'Khach hang');

  // CRM-initiated send, already correlated and sent under a temp id.
  insertSent(db, 'thread-out-2', 'tempA', 'alo');

  // A second, genuinely independent "alo" (e.g. typed by hand in Business
  // Suite) with no pending row of its own arrives moments later.
  const mergedId = upgradeTempId(db, 'thread-out-2', 'alo', 'manualB');
  assert.ok(mergedId, 'the check fires even though this content never had a pending row');

  const rows = db.prepare('SELECT fb_message_id FROM messages WHERE thread_id = ?').all('thread-out-2');
  assert.equal(rows.length, 1, 'accepted trade-off: the two sends collapse into one row instead of two');
  assert.equal(rows[0].fb_message_id, 'manualB', 'the original send\'s identity (tempA) is silently overwritten');
}));
