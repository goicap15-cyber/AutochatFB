const test = require('node:test');
const assert = require('node:assert/strict');
const { getTestDatabase } = require('../helpers/testDatabase');
const ConversationRepository = require('../../src/server/repositories/ConversationRepository');
const { OUTBOUND_STATUS, OUTBOUND_ERROR_CODE, OutboundMessageService } = require('../../src/server/services/OutboundMessageService');

test('outbound state constants expose the safe lifecycle', () => {
  assert.deepEqual(OUTBOUND_STATUS, { PENDING: 'pending', SENT: 'sent', FAILED: 'failed' });
  assert.equal(OUTBOUND_ERROR_CODE.FACEBOOK_API_ERROR, 'FACEBOOK_API_ERROR');
});

test('safe diagnostics remove credentials without mutating input', () => {
  const input = { status: 200, token: 'secret', cookie: 'session', headers: { cookie: 'x', authorization: 'y' } };
  const safe = OutboundMessageService.safeDiagnostics(input);
  assert.equal(safe.status, 200);
  assert.equal(safe.token, undefined);
  assert.equal(safe.cookie, undefined);
  assert.equal(safe.headers.cookie, undefined);
  assert.equal(input.token, 'secret');
});

test('duplicate history event does not create a second outbound row', () => {
  const db = getTestDatabase();
  db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-1', 'Test', '/tmp/test');
  ConversationRepository.upsertThread({ id: 'thread-1', account_id: 'acct-1', contact_name: 'Alice' }, db);
  ConversationRepository.saveMessagesTransaction('thread-1', [{ fb_message_id: 'dom-1', sender_id: 'acct-1', content: 'hello', is_outgoing: true, timestamp_ms: 1000 }], db);
  ConversationRepository.saveMessagesTransaction('thread-1', [{ fb_message_id: 'dom-1', sender_id: 'acct-1', content: 'hello', is_outgoing: true, timestamp_ms: 1000 }], db);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM messages WHERE fb_message_id = ?').get('dom-1').count, 1);
  db.close();
});
