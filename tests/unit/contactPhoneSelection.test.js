const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const ContactService = require('../../src/server/services/ContactService');
const PhoneCaptureService = require('../../src/server/services/PhoneCaptureService');

function withDatabase(run) {
  const db = getTestDatabase(':memory:');
  try {
    return run(db);
  } finally {
    db.close();
  }
}

function seedThread(db, id, accountId = 'acct-1') {
  db.prepare('INSERT OR IGNORE INTO accounts (id, name, profile_dir, status) VALUES (?, ?, ?, ?)')
    .run(accountId, 'Test account', '/tmp/autochatbot-phone-selection-test', 'ACTIVE');
  db.prepare('INSERT INTO threads (id, external_thread_id, account_id, contact_name) VALUES (?, ?, ?, ?)')
    .run(id, id, accountId, 'Test contact');
}

test('accepting a candidate adopts its normalized value and provenance', () => withDatabase((db) => {
  seedThread(db, 't-1');
  db.prepare("INSERT INTO contacts (thread_id, phone, phone_source) VALUES (?, ?, 'manual')").run('t-1', '0900000000');
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-1', accountId: 'acct-1', messageId: 'mid.1', content: '0912345678', messageTimestampMs: 1000
  }, { database: db });
  assert.equal(captures[0].selection_state, 'candidate'); // manual phone protected it

  const updated = ContactService.update('t-1', { phone_capture_id: captures[0].id }, db);
  assert.equal(updated.phone, '0912345678');
  assert.equal(updated.phone_source, 'message_capture');
  assert.equal(updated.phone_capture_id, captures[0].id);

  const captureRow = db.prepare('SELECT selection_state FROM contact_phone_captures WHERE id = ?').get(captures[0].id);
  assert.equal(captureRow.selection_state, 'selected');
}));

test('accepting a candidate throws PhoneCaptureNotFoundError for an unknown/mismatched id', () => withDatabase((db) => {
  seedThread(db, 't-2');
  assert.throws(
    () => ContactService.update('t-2', { phone_capture_id: 999999 }, db),
    ContactService.PhoneCaptureNotFoundError
  );
}));

test('a manual phone edit that changes the value marks phone_source manual and clears capture provenance', () => withDatabase((db) => {
  seedThread(db, 't-3');
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-3', accountId: 'acct-1', messageId: 'mid.3', content: '0912345678', messageTimestampMs: 1000
  }, { database: db });
  assert.equal(captures[0].selection_state, 'selected');

  const updated = ContactService.update('t-3', { phone: '0999999999' }, db);
  assert.equal(updated.phone, '0999999999');
  assert.equal(updated.phone_source, 'manual');
  assert.equal(updated.phone_capture_id, null);
  assert.equal(updated.phone_captured_at, null);
}));

test('resending the same phone value does not reset provenance to manual', () => withDatabase((db) => {
  seedThread(db, 't-4');
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-4', accountId: 'acct-1', messageId: 'mid.4', content: '0912345678', messageTimestampMs: 1000
  }, { database: db });

  // Saving other fields (e.g. notes) while echoing back the same phone value
  // must not look like a fresh manual edit.
  const updated = ContactService.update('t-4', { phone: '0912345678', notes: 'ghi chú' }, db);
  assert.equal(updated.phone_source, 'message_capture');
  assert.equal(updated.phone_capture_id, captures[0].id);
  assert.equal(updated.notes, 'ghi chú');
}));

test('omitting phone entirely preserves existing provenance untouched', () => withDatabase((db) => {
  seedThread(db, 't-5');
  PhoneCaptureService.processIncomingMessage({
    threadId: 't-5', accountId: 'acct-1', messageId: 'mid.5', content: '0912345678', messageTimestampMs: 1000
  }, { database: db });

  const updated = ContactService.update('t-5', { notes: 'chỉ đổi ghi chú' }, db);
  assert.equal(updated.phone, '0912345678');
  assert.equal(updated.phone_source, 'message_capture');
}));

test('accepting a second candidate demotes the previously selected capture', () => withDatabase((db) => {
  seedThread(db, 't-6');
  const first = PhoneCaptureService.processIncomingMessage({
    threadId: 't-6', accountId: 'acct-1', messageId: 'mid.6a', content: '0912345678', messageTimestampMs: 1000
  }, { database: db }).captures[0];
  const second = PhoneCaptureService.processIncomingMessage({
    threadId: 't-6', accountId: 'acct-1', messageId: 'mid.6b', content: '0987654321', messageTimestampMs: 2000
  }, { database: db }).captures[0];

  assert.equal(first.selection_state, 'selected');
  assert.equal(second.selection_state, 'candidate');

  ContactService.update('t-6', { phone_capture_id: second.id }, db);

  const firstAfter = db.prepare('SELECT selection_state FROM contact_phone_captures WHERE id = ?').get(first.id);
  const secondAfter = db.prepare('SELECT selection_state FROM contact_phone_captures WHERE id = ?').get(second.id);
  assert.equal(firstAfter.selection_state, 'candidate');
  assert.equal(secondAfter.selection_state, 'selected');

  const contact = db.prepare('SELECT phone FROM contacts WHERE thread_id = ?').get('t-6');
  assert.equal(contact.phone, '0987654321');
}));

test('a duplicate incoming candidate (same message, same number) never creates a second capture row', () => withDatabase((db) => {
  seedThread(db, 't-7');
  const runOnce = () => PhoneCaptureService.processIncomingMessage({
    threadId: 't-7', accountId: 'acct-1', messageId: 'mid.7', content: '0912345678', messageTimestampMs: 1000
  }, { database: db });
  runOnce();
  runOnce();
  const count = db.prepare('SELECT COUNT(*) AS c FROM contact_phone_captures WHERE thread_id = ?').get('t-7');
  assert.equal(count.c, 1);
}));
