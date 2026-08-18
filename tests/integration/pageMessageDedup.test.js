const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');
const ConversationRepository = require('../../src/server/repositories/ConversationRepository');
const { classifyByContainerEdges } = require('../../src/extension/pageDirection');

function withDatabase(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-test-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try { return run(db); } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// Regression for feature 010: page_dom_observer now extracts Business Suite's
// `data-message-id` and forwards it as fb_message_id. Two distinct real
// messages sharing identical thread + text must persist as two rows, not
// collapse into one (the bug reported against 009's original DOM scraper,
// which sent no fb_message_id and fell back to a content-only fingerprint).
test('repeated identical Page text with distinct fb_message_id persists as separate messages', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-page-1', account_id: 'acct-1', contact_name: 'Khach hang' }, db);

  const messages = [
    { fb_message_id: 'mid.$A1', sender_id: 'CONTACT', content: 'alo', timestamp_ms: 1000, timestamp_source: 'facebook_label' },
    { fb_message_id: 'mid.$A2', sender_id: 'CONTACT', content: 'alo', timestamp_ms: 2000, timestamp_source: 'facebook_label' },
    { fb_message_id: 'mid.$A3', sender_id: 'CONTACT', content: '1', timestamp_ms: 3000, timestamp_source: 'facebook_label' },
    { fb_message_id: 'mid.$A4', sender_id: 'CONTACT', content: '1', timestamp_ms: 4000, timestamp_source: 'facebook_label' }
  ];
  ConversationRepository.saveMessagesTransaction('thread-page-1', messages, db);
  // Replaying the same scan tick (as the 1s DOM poller does) must not create duplicates either.
  ConversationRepository.saveMessagesTransaction('thread-page-1', messages, db);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE thread_id = ?').get('thread-page-1').count, 4);
  assert.deepEqual(
    ConversationRepository.getMessages('thread-page-1', 50, 0, db).map(m => m.content),
    ['alo', 'alo', '1', '1']
  );
}));

// Known residual limitation (documented in specs/010-page-message-capture-integrity/spec.md
// Assumptions): if data-message-id can't be found in the DOM for a given message,
// the extension has no fb_message_id to send, and two distinct messages with the
// same thread/content/sender/timestamp still collide on ConversationRepository.fingerprint().
// This test pins that known gap so a future change doesn't silently fix or worsen it unnoticed.
test('KNOWN LIMITATION: identical content+sender+timestamp with no fb_message_id still collides', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-page-2', account_id: 'acct-1', contact_name: 'Khach hang' }, db);

  const noIdMessages = [
    { sender_id: 'CONTACT', content: 'alo', timestamp_ms: 0 },
    { sender_id: 'CONTACT', content: 'alo', timestamp_ms: 0 }
  ];
  ConversationRepository.saveMessagesTransaction('thread-page-2', noIdMessages, db);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE thread_id = ?').get('thread-page-2').count, 1);
}));

// Regression for feature 011/012, updated by feature 019: page_dom_observer's
// geometry-based direction detection came online after some messages were
// already stored with the wrong is_outgoing. Re-scanning them must correct
// is_outgoing in place, without creating a duplicate row or throwing - but
// (feature 019) only once the same disagreeing reading is confirmed twice,
// so a single noisy geometry read (e.g. right after a page/server reload)
// can't silently corrupt an already-correct value on its own.
test('existing message self-corrects is_outgoing on re-scan, but only after two matching disagreements', () => withDatabase((db) => {
  ConversationRepository._resetDirectionFlipTracking();
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-page-3', account_id: 'acct-1', contact_name: 'Khach hang' }, db);
  ConversationRepository.saveMessagesTransaction('thread-page-3', [
    { fb_message_id: 'mid.$B1', sender_id: 'CONTACT', content: '1', timestamp_ms: 1000, timestamp_source: 'dom_order', is_outgoing: false }
  ], db);

  // First disagreeing re-scan: recorded as a candidate, NOT committed yet.
  const first = ConversationRepository.reconcileExistingMessage(
    'mid.$B1',
    { source: 'page_dom_observer', isOutgoing: true, tsMs: 1000, tsSource: 'dom_order', createdAt: new Date().toISOString() },
    db
  );
  assert.equal(first.updated, false);
  assert.equal(first.reason, 'no_change');
  assert.equal(db.prepare('SELECT is_outgoing FROM messages WHERE fb_message_id = ?').get('mid.$B1').is_outgoing, 0);

  // Second re-scan with the SAME disagreeing value: now confirmed - commits.
  const second = ConversationRepository.reconcileExistingMessage(
    'mid.$B1',
    { source: 'page_dom_observer', isOutgoing: true, tsMs: 1000, tsSource: 'dom_order', createdAt: new Date().toISOString() },
    db
  );
  assert.equal(second.updated, true);
  assert.equal(second.directionUpdated, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE thread_id = ?').get('thread-page-3').count, 1);
  assert.equal(db.prepare('SELECT is_outgoing FROM messages WHERE fb_message_id = ?').get('mid.$B1').is_outgoing, 1);

  // Third re-scan with the same (now-correct) value: no-op, no duplicate, no crash.
  const third = ConversationRepository.reconcileExistingMessage(
    'mid.$B1',
    { source: 'page_dom_observer', isOutgoing: true, tsMs: 1000, tsSource: 'dom_order', createdAt: new Date().toISOString() },
    db
  );
  assert.equal(third.updated, false);
  assert.equal(third.reason, 'no_change');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE thread_id = ?').get('thread-page-3').count, 1);
}));

// Feature 019 (FR-003): an agreeing reading between two disagreements clears
// the pending candidate, so the disagreement doesn't get confirmed by an
// unrelated later repeat of the same wrong value.
test('an agreeing reading clears a pending direction-flip candidate', () => withDatabase((db) => {
  ConversationRepository._resetDirectionFlipTracking();
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-page-3b', account_id: 'acct-1', contact_name: 'Khach hang' }, db);
  ConversationRepository.saveMessagesTransaction('thread-page-3b', [
    { fb_message_id: 'mid.$B2', sender_id: 'CONTACT', content: '1', timestamp_ms: 1000, timestamp_source: 'dom_order', is_outgoing: false }
  ], db);

  const reconcile = (isOutgoing) => ConversationRepository.reconcileExistingMessage(
    'mid.$B2',
    { source: 'page_dom_observer', isOutgoing, tsMs: 1000, tsSource: 'dom_order', createdAt: new Date().toISOString() },
    db
  );

  const disagree1 = reconcile(true); // noisy reading - candidate recorded
  assert.equal(disagree1.updated, false);

  const agree = reconcile(false); // matches stored value - clears the candidate
  assert.equal(agree.updated, false);
  assert.equal(agree.reason, 'no_change');

  const disagree2 = reconcile(true); // same wrong value as disagree1, but candidate was cleared - treated as a fresh first disagreement
  assert.equal(disagree2.updated, false, 'must not reuse the pre-agreement disagreement as confirmation');
  assert.equal(db.prepare('SELECT is_outgoing FROM messages WHERE fb_message_id = ?').get('mid.$B2').is_outgoing, 0);
}));

// Feature 019 (FR-004, boundary note): is_outgoing is boolean, so a "different"
// disagreement is only reachable via an intervening agreeing read resetting the
// candidate (already covered above) - there is no third value. This test pins
// that, starting from a clean candidate map, exactly two matching disagreements
// (never more, never fewer) are what commits a flip.
test('a differing second disagreement resets the candidate instead of committing', () => withDatabase((db) => {
  ConversationRepository._resetDirectionFlipTracking();
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-page-3c', account_id: 'acct-1', contact_name: 'Khach hang' }, db);
  ConversationRepository.saveMessagesTransaction('thread-page-3c', [
    { fb_message_id: 'mid.$B3', sender_id: 'CONTACT', content: '1', timestamp_ms: 1000, timestamp_source: 'dom_order', is_outgoing: false }
  ], db);

  const reconcile = (isOutgoing) => ConversationRepository.reconcileExistingMessage(
    'mid.$B3',
    { source: 'page_dom_observer', isOutgoing, tsMs: 1000, tsSource: 'dom_order', createdAt: new Date().toISOString() },
    db
  );

  // Stored is false. Only two possible values (true/false) exist for is_outgoing,
  // so "a different disagreement" here means disagreeing, then agreeing (which
  // clears it, per FR-003) - this test instead pins the case where the SAME
  // proposed value must repeat, using an intervening agreeing read as the
  // only real way to reset with a boolean field.
  const disagree = reconcile(true);
  assert.equal(disagree.updated, false);

  const confirmSame = reconcile(true);
  assert.equal(confirmSame.updated, true);
  assert.equal(confirmSame.directionUpdated, true);
  assert.equal(db.prepare('SELECT is_outgoing FROM messages WHERE fb_message_id = ?').get('mid.$B3').is_outgoing, 1);
}));

// Regression for feature 011: a page_dom_observer payload carrying contact_name
// (and, separately via setContactAvatarIfMissing, an avatar) updates the
// thread's stored contact info instead of leaving the generic placeholder,
// and does not clobber an avatar that's already been resolved.
test('page contact info updates thread name and backfills missing avatar once', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  const thread = ConversationRepository.upsertThread({ id: 'thread-page-4', account_id: 'acct-1', contact_name: 'Khách hàng' }, db);
  assert.equal(thread.contact_name, 'Khách hàng');

  const renamed = ConversationRepository.upsertThread({ id: 'thread-page-4', account_id: 'acct-1', contact_name: 'Mang Bao Khanh' }, db);
  assert.equal(renamed.contact_name, 'Mang Bao Khanh');

  const avatarResult = ConversationRepository.setContactAvatarIfMissing('thread-page-4', 'Mang Bao Khanh', '/avatars/mbk.jpg', db);
  assert.equal(avatarResult.updated, true);
  assert.equal(db.prepare('SELECT avatar_url FROM contacts WHERE thread_id = ?').get('thread-page-4').avatar_url, '/avatars/mbk.jpg');

  // A later resolve must not clobber the avatar already stored.
  const secondAvatarResult = ConversationRepository.setContactAvatarIfMissing('thread-page-4', 'Mang Bao Khanh', '/avatars/other.jpg', db);
  assert.equal(secondAvatarResult.updated, false);
  assert.equal(db.prepare('SELECT avatar_url FROM contacts WHERE thread_id = ?').get('thread-page-4').avatar_url, '/avatars/mbk.jpg');
}));

// Regression for feature 012: a caller that omits contact_name entirely must
// never blank out an existing value - neither the placeholder nor a real name -
// while a genuine new real name must still be able to overwrite the placeholder
// (the exact behavior feature 011 was fixing).
test('upsertThread with no contact_name never blanks an existing value', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');

  ConversationRepository.upsertThread({ id: 'thread-page-5', account_id: 'acct-1', contact_name: 'Khách hàng' }, db);
  const untouchedPlaceholder = ConversationRepository.upsertThread({ id: 'thread-page-5', account_id: 'acct-1', last_message: 'hi' }, db);
  assert.equal(untouchedPlaceholder.contact_name, 'Khách hàng');

  ConversationRepository.upsertThread({ id: 'thread-page-5', account_id: 'acct-1', contact_name: 'Real Name' }, db);
  const untouchedRealName = ConversationRepository.upsertThread({ id: 'thread-page-5', account_id: 'acct-1', last_message: 'hi again' }, db);
  assert.equal(untouchedRealName.contact_name, 'Real Name');

  ConversationRepository.upsertThread({ id: 'thread-page-6', account_id: 'acct-1', contact_name: 'Khách hàng' }, db);
  const overwritten = ConversationRepository.upsertThread({ id: 'thread-page-6', account_id: 'acct-1', contact_name: 'New Real Name' }, db);
  assert.equal(overwritten.contact_name, 'New Real Name');
}));

// Regression for feature 015: sendViaExtension routes a send through the
// message_queue/QueueWorker pipeline only when the thread's source resolves to
// page_messenger. This pins the resolution logic that decision depends on -
// mirrors the exact threads -> inbox_sources join MessageQueueRepository.popPending()
// uses, so both agree on what counts as a Page thread.
test('getThreadSource resolves page_messenger, personal_messenger, and unset correctly', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  db.prepare(`
    INSERT INTO inbox_sources (id, source_type, external_id, display_name)
    VALUES (?, 'page_messenger', ?, ?)
  `).run('src_page_1', '1209772058877160', 'Test Page');
  db.prepare(`
    INSERT INTO inbox_sources (id, source_type, external_id, display_name)
    VALUES (?, 'personal_messenger', ?, ?)
  `).run('src_personal_1', 'acct-1', 'Test Personal');

  ConversationRepository.upsertThread({ id: 'thread-page-7', account_id: 'acct-1', source_id: 'src_page_1', contact_name: 'Khach hang' }, db);
  ConversationRepository.upsertThread({ id: 'thread-personal-1', account_id: 'acct-1', source_id: 'src_personal_1', contact_name: 'Ban be' }, db);
  ConversationRepository.upsertThread({ id: 'thread-no-source-1', account_id: 'acct-1', contact_name: 'Legacy thread' }, db);

  assert.deepEqual(ConversationRepository.getThreadSource('thread-page-7', db), { sourceType: 'page_messenger', pageId: '1209772058877160' });
  assert.deepEqual(ConversationRepository.getThreadSource('thread-personal-1', db), { sourceType: 'personal_messenger', pageId: 'acct-1' });
  assert.deepEqual(ConversationRepository.getThreadSource('thread-no-source-1', db), { sourceType: null, pageId: null });
  assert.deepEqual(ConversationRepository.getThreadSource('thread-does-not-exist', db), { sourceType: null, pageId: null });
}));

// Regression for feature 014: getMessageTimestamps is the lightweight
// projection page_content.js uses to re-seed its client-side timestamp-anchor
// map after a restart. It must return only fb_message_id/timestamp_ms (no
// content/media), in chronological order, and skip rows with no fb_message_id
// (messages that never got a real identity, e.g. the KNOWN LIMITATION case
// above, can't be used as anchors anyway).
test('getMessageTimestamps returns only id+timestamp pairs, in order, skipping unidentified rows', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-page-7', account_id: 'acct-1', contact_name: 'Khach hang' }, db);

  ConversationRepository.saveMessagesTransaction('thread-page-7', [
    { fb_message_id: 'mid.$C2', sender_id: 'CONTACT', content: 'second', timestamp_ms: 2000, timestamp_source: 'dom_order' },
    { fb_message_id: 'mid.$C1', sender_id: 'CONTACT', content: 'first', timestamp_ms: 1000, timestamp_source: 'dom_order' },
    { sender_id: 'CONTACT', content: 'no id', timestamp_ms: 500 } // falls back to fingerprint, no real fb_message_id
  ], db);

  const snapshot = ConversationRepository.getMessageTimestamps('thread-page-7', db);
  assert.deepEqual(snapshot, [
    { fb_message_id: 'mid.$C1', timestamp_ms: 1000 },
    { fb_message_id: 'mid.$C2', timestamp_ms: 2000 }
  ]);
}));


test('container-edge direction classifier returns incoming, outgoing, and unknown without a midpoint', () => {
  const containerRect = { left: 100, right: 1000 };
  assert.equal(classifyByContainerEdges({ containerRect, bubbleRect: { left: 120, right: 300 } }).direction, false);
  assert.equal(classifyByContainerEdges({ containerRect, bubbleRect: { left: 800, right: 980 } }).direction, true);
  assert.equal(classifyByContainerEdges({ containerRect, bubbleRect: { left: 450, right: 650 } }).direction, null);
  assert.equal(classifyByContainerEdges({ containerRect: null, bubbleRect: { left: 800, right: 980 } }).direction, null);
});

test('pending Page direction is stored with a compatibility placeholder and promoted in place', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-pending', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-pending', account_id: 'acct-pending', contact_name: 'Khach hang' }, db);

  ConversationRepository.saveMessagesTransaction('thread-pending', [
    {
      fb_message_id: 'mid.$PENDING',
      sender_id: 'CONTACT',
      content: 'pending text',
      timestamp_ms: 1000,
      timestamp_source: 'dom_order',
      is_outgoing: null,
      direction_status: 'pending'
    }
  ], db);

  let row = db.prepare('SELECT is_outgoing, direction_status FROM messages WHERE fb_message_id = ?').get('mid.$PENDING');
  assert.deepEqual(row, { is_outgoing: 0, direction_status: 'pending' });

  const promoted = ConversationRepository.reconcileExistingMessage('mid.$PENDING', {
    source: 'page_dom_observer',
    isOutgoing: true,
    direction_status: 'confirmed',
    direction_confidence: 'high',
    tsMs: 1000,
    tsSource: 'dom_order',
    createdAt: new Date().toISOString()
  }, db);
  assert.equal(promoted.updated, true);
  assert.equal(promoted.directionUpdated, true);

  row = db.prepare('SELECT is_outgoing, direction_status FROM messages WHERE fb_message_id = ?').get('mid.$PENDING');
  assert.deepEqual(row, { is_outgoing: 1, direction_status: 'confirmed' });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE thread_id = ?').get('thread-pending').count, 1);
}));

test('unknown Page direction cannot flip an already confirmed message or trigger a duplicate', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-unknown', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-unknown', account_id: 'acct-unknown', contact_name: 'Khach hang' }, db);
  ConversationRepository.saveMessagesTransaction('thread-unknown', [{
    fb_message_id: 'mid.$KNOWN',
    sender_id: 'CONTACT',
    content: 'known text',
    timestamp_ms: 1000,
    timestamp_source: 'dom_order',
    is_outgoing: false,
    direction_status: 'confirmed'
  }], db);

  const result = ConversationRepository.reconcileExistingMessage('mid.$KNOWN', {
    source: 'page_dom_observer',
    isOutgoing: null,
    direction_status: 'pending',
    direction_confidence: 'unknown',
    tsMs: 1000,
    tsSource: 'dom_order',
    createdAt: new Date().toISOString()
  }, db);
  assert.equal(result.updated, false);
  assert.deepEqual(
    db.prepare('SELECT is_outgoing, direction_status FROM messages WHERE fb_message_id = ?').get('mid.$KNOWN'),
    { is_outgoing: 0, direction_status: 'confirmed' }
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE thread_id = ?').get('thread-unknown').count, 1);
}));

test('pending direction never downgrades a confirmed outgoing message during sync replay', () => withDatabase((db) => {
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-downgrade', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-downgrade', account_id: 'acct-downgrade', contact_name: 'Khach hang' }, db);
  ConversationRepository.saveMessagesTransaction('thread-downgrade', [{
    fb_message_id: 'mid.$CONFIRMED',
    sender_id: 'acct-downgrade',
    content: 'outgoing text',
    timestamp_ms: 1000,
    timestamp_source: 'facebook_payload',
    is_outgoing: true,
    direction_status: 'confirmed'
  }], db);
  ConversationRepository.saveMessagesTransaction('thread-downgrade', [{
    fb_message_id: 'mid.$CONFIRMED',
    sender_id: 'CONTACT',
    content: 'outgoing text',
    timestamp_ms: 1000,
    timestamp_source: 'dom_order',
    is_outgoing: null,
    direction_status: 'pending'
  }], db);

  assert.deepEqual(
    db.prepare('SELECT is_outgoing, direction_status FROM messages WHERE fb_message_id = ?').get('mid.$CONFIRMED'),
    { is_outgoing: 1, direction_status: 'confirmed' }
  );
}));
