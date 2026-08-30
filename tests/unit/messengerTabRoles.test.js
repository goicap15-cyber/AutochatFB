const test = require('node:test');
const assert = require('node:assert/strict');
const Roles = require('../../src/extension/messengerTabRoles');

test('maps registered tabs to three independent personal roles', () => {
  const entries = [
    [Roles.roleKey('a1', 'interaction'), 11],
    [Roles.roleKey('a1', 'discovery'), 12],
    [Roles.roleKey('a1', 'history'), 13]
  ];
  assert.equal(Roles.roleForTab(entries, 'a1', 11), 'interaction');
  assert.equal(Roles.roleForTab(entries, 'a1', 12), 'discovery');
  assert.equal(Roles.roleForTab(entries, 'a1', 13), 'history');
});

test('legacy personal key remains the interaction role', () => {
  assert.equal(Roles.roleForTab([['personal:a1', 7]], 'a1', 7), 'interaction');
});

test('only interaction can forward realtime and call events', () => {
  assert.equal(Roles.canForwardRealtime('interaction'), true);
  assert.equal(Roles.canForwardRealtime('discovery'), false);
  assert.equal(Roles.canForwardRealtime('history'), false);
  assert.equal(Roles.canForwardRealtime(null), false);
});
