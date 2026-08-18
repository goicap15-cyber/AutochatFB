const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const PhoneCaptureService = require('../../src/server/services/PhoneCaptureService');
const ContactPhoneCaptureRepository = require('../../src/server/repositories/ContactPhoneCaptureRepository');

function withDatabase(run) {
  const db = getTestDatabase(':memory:');
  try {
    return run(db);
  } finally {
    db.close();
  }
}

function seedThread(db, { id, accountId = 'acct-1', externalThreadId = id } = {}) {
  db.prepare('INSERT OR IGNORE INTO accounts (id, name, profile_dir, status) VALUES (?, ?, ?, ?)')
    .run(accountId, 'Test account', '/tmp/autochatbot-phone-capture-test', 'ACTIVE');
  db.prepare(`
    INSERT INTO threads (id, external_thread_id, account_id, contact_name)
    VALUES (?, ?, ?, ?)
  `).run(id, externalThreadId, accountId, 'Test contact');
  return id;
}

test('captures a valid incoming phone number and fills an empty contact phone', () => withDatabase((db) => {
  seedThread(db, { id: 't-1' });
  const { threadId, captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-1',
    accountId: 'acct-1',
    messageId: 'mid.1',
    content: 'Alo, số của em là 0345 678 901 nhé',
    messageTimestampMs: 1000
  }, { database: db });

  assert.equal(threadId, 't-1');
  assert.equal(captures.length, 1);
  assert.equal(captures[0].normalized_phone, '0345678901');
  assert.equal(captures[0].selection_state, 'selected');

  const contact = db.prepare('SELECT phone, phone_source, phone_capture_id FROM contacts WHERE thread_id = ?').get('t-1');
  assert.equal(contact.phone, '0345678901');
  assert.equal(contact.phone_source, 'message_capture');
  assert.equal(contact.phone_capture_id, captures[0].id);
}));

test('does not capture an invalid-prefix number and does not touch contacts', () => withDatabase((db) => {
  seedThread(db, { id: 't-2' });
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-2',
    accountId: 'acct-1',
    messageId: 'mid.2',
    content: 'Gọi tôi số 0301234567 nhé',
    messageTimestampMs: 1000
  }, { database: db });

  assert.equal(captures.length, 0);
  const contact = db.prepare('SELECT phone FROM contacts WHERE thread_id = ?').get('t-2');
  assert.equal(contact, undefined);
}));

test('replaying the same message is idempotent: no duplicate capture row, no duplicate event data', () => withDatabase((db) => {
  seedThread(db, { id: 't-3' });
  const first = PhoneCaptureService.processIncomingMessage({
    threadId: 't-3', accountId: 'acct-1', messageId: 'mid.3',
    content: '0912345678', messageTimestampMs: 1000
  }, { database: db });
  const second = PhoneCaptureService.processIncomingMessage({
    threadId: 't-3', accountId: 'acct-1', messageId: 'mid.3',
    content: '0912345678', messageTimestampMs: 1000
  }, { database: db });

  assert.equal(first.captures[0].id, second.captures[0].id);
  assert.equal(first.createdCaptures.length, 1);
  assert.deepEqual(second.createdCaptures, []);
  const rows = db.prepare('SELECT COUNT(*) AS c FROM contact_phone_captures WHERE message_id = ?').get('mid.3');
  assert.equal(rows.c, 1);
}));

test('never overwrites a manual/legacy phone - new capture becomes a candidate instead', () => withDatabase((db) => {
  seedThread(db, { id: 't-4' });
  db.prepare("INSERT INTO contacts (thread_id, phone, phone_source) VALUES (?, ?, 'manual')").run('t-4', '0900000000');

  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-4', accountId: 'acct-1', messageId: 'mid.4',
    content: 'Số khác của em: 0912345678', messageTimestampMs: 1000
  }, { database: db });

  assert.equal(captures.length, 1);
  assert.equal(captures[0].selection_state, 'candidate');
  const contact = db.prepare('SELECT phone, phone_source FROM contacts WHERE thread_id = ?').get('t-4');
  assert.equal(contact.phone, '0900000000');
  assert.equal(contact.phone_source, 'manual');
}));

test('legacy non-empty phone (phone_source NULL, matching pre-migration rows) is also protected', () => withDatabase((db) => {
  seedThread(db, { id: 't-5' });
  // Simulates a pre-existing contact row from before this migration ran,
  // where the backfill already stamped phone_source = 'legacy'.
  db.prepare("INSERT INTO contacts (thread_id, phone, phone_source) VALUES (?, ?, 'legacy')").run('t-5', '0988888888');

  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-5', accountId: 'acct-1', messageId: 'mid.5',
    content: '0912345678', messageTimestampMs: 1000
  }, { database: db });

  assert.equal(captures[0].selection_state, 'candidate');
  const contact = db.prepare('SELECT phone FROM contacts WHERE thread_id = ?').get('t-5');
  assert.equal(contact.phone, '0988888888');
}));

test('multiple distinct valid candidates in one message: first fills empty phone, rest become candidates', () => withDatabase((db) => {
  seedThread(db, { id: 't-6' });
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-6', accountId: 'acct-1', messageId: 'mid.6',
    content: 'Gọi 0912345678 hoặc 0987654321 giúp em', messageTimestampMs: 1000
  }, { database: db });

  assert.equal(captures.length, 2);
  assert.equal(captures[0].selection_state, 'selected');
  assert.equal(captures[1].selection_state, 'candidate');
  const contact = db.prepare('SELECT phone FROM contacts WHERE thread_id = ?').get('t-6');
  assert.equal(contact.phone, '0912345678');
}));

test('resolves a personal-Messenger bare PSID to the CRM compound thread_id before writing', () => withDatabase((db) => {
  seedThread(db, { id: 'acct-1:969878666067566', accountId: 'acct-1', externalThreadId: '969878666067566' });

  const { threadId, captures } = PhoneCaptureService.processIncomingMessage({
    threadId: '969878666067566', // raw bare PSID, as DOM observer reports it
    accountId: 'acct-1',
    messageId: 'mid.7',
    content: '0912345678',
    messageTimestampMs: 1000
  }, { database: db });

  assert.equal(threadId, 'acct-1:969878666067566');
  assert.equal(captures[0].thread_id, 'acct-1:969878666067566');
  const contact = db.prepare('SELECT phone FROM contacts WHERE thread_id = ?').get('acct-1:969878666067566');
  assert.equal(contact.phone, '0912345678');
  // Never created a phantom row under the raw bare PSID.
  const phantom = db.prepare('SELECT phone FROM contacts WHERE thread_id = ?').get('969878666067566');
  assert.equal(phantom, undefined);
}));

test('does not persist candidates when no valid phone number is present', () => withDatabase((db) => {
  seedThread(db, { id: 't-8' });
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-8', accountId: 'acct-1', messageId: 'mid.8',
    content: 'Xin chào, mình cần tư vấn thêm', messageTimestampMs: 1000
  }, { database: db });
  assert.deepEqual(captures, []);
}));

test('getContactPhoneView reports selected phone, provenance and candidates', () => withDatabase((db) => {
  seedThread(db, { id: 't-9' });
  PhoneCaptureService.processIncomingMessage({
    threadId: 't-9', accountId: 'acct-1', messageId: 'mid.9a',
    content: '0912345678', messageTimestampMs: 1000
  }, { database: db });
  PhoneCaptureService.processIncomingMessage({
    threadId: 't-9', accountId: 'acct-1', messageId: 'mid.9b',
    content: '0987654321', messageTimestampMs: 2000
  }, { database: db });

  const view = PhoneCaptureService.getContactPhoneView('t-9', db);
  assert.equal(view.phone, '0912345678');
  assert.equal(view.phone_source, 'message_capture');
  assert.equal(view.phone_capture.message_id, 'mid.9a');
  assert.equal(view.phone_candidates.length, 1);
  assert.equal(view.phone_candidates[0].normalized_phone, '0987654321');
}));

test('ContactPhoneCaptureRepository.setSelectionState rejects an invalid state', () => withDatabase((db) => {
  seedThread(db, { id: 't-10' });
  const { captures } = PhoneCaptureService.processIncomingMessage({
    threadId: 't-10', accountId: 'acct-1', messageId: 'mid.10',
    content: '0912345678', messageTimestampMs: 1000
  }, { database: db });
  assert.throws(() => ContactPhoneCaptureRepository.setSelectionState(captures[0].id, 'bogus', db));
}));
