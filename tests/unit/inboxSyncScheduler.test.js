const test = require('node:test');
const assert = require('node:assert/strict');
const schedulerSingleton = require('../../src/server/services/InboxSyncScheduler');
const { InboxSyncScheduler } = schedulerSingleton;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('in-flight thread change is replayed after the current sync result', async () => {
  const dispatched = [];
  const scheduler = new InboxSyncScheduler({ threadCooldownMs: 5, threadTimeoutMs: 200 });
  scheduler.configure({ getConnection: () => null, dispatchThreadMessagesSync: (job) => { dispatched.push(job); return true; } });
  assert.equal(scheduler.enqueueThreadSync({ account_id: 'acc', thread_id: 'thread', reason: 'first' }), true);
  assert.equal(scheduler.enqueueThreadSync({ account_id: 'acc', thread_id: 'thread', reason: 'changed' }), false);
  assert.equal(dispatched.length, 1);
  await wait(8);
  scheduler.markThreadSyncResult('acc', 'thread');
  await wait(15);
  assert.equal(dispatched.length, 2);
  assert.match(dispatched[1].reason, /replay/);
  scheduler.markThreadSyncResult('acc', 'thread');
  scheduler.unregisterAccount('acc');
});

test('account queue remains single-flight while different threads wait', async () => {
  const dispatched = [];
  const scheduler = new InboxSyncScheduler({ threadCooldownMs: 1, threadTimeoutMs: 200 });
  scheduler.configure({ getConnection: () => null, dispatchThreadMessagesSync: (job) => { dispatched.push(job.thread_id); return true; } });
  scheduler.enqueueThreadSync({ account_id: 'acc', thread_id: 'one' });
  scheduler.enqueueThreadSync({ account_id: 'acc', thread_id: 'two' });
  assert.deepEqual(dispatched, ['one']);
  scheduler.markThreadSyncResult('acc', 'one');
  await wait(40);
  assert.deepEqual(dispatched, ['one', 'two']);
  scheduler.markThreadSyncResult('acc', 'two');
  scheduler.unregisterAccount('acc');
});

test('sidebar polling defers while history crawl owns the account and replays afterwards', async () => {
  const wsMessages = [];
  const dispatchedThreads = [];
  const ws = { readyState: 1, send: (payload) => wsMessages.push(JSON.parse(payload)) };
  const scheduler = new InboxSyncScheduler({ sidebarCooldownMs: 1, threadCooldownMs: 1, threadTimeoutMs: 200 });
  scheduler.configure({
    getConnection: () => ws,
    dispatchThreadMessagesSync: (job) => { dispatchedThreads.push(job.thread_id); return true; }
  });
  scheduler.enqueueThreadSync({ account_id: 'acc', thread_id: 'history' });
  assert.equal(scheduler.requestSidebarSync('acc', 'poll'), false);
  assert.deepEqual(dispatchedThreads, ['history']);
  assert.equal(wsMessages.length, 0);
  scheduler.markThreadSyncResult('acc', 'history');
  await wait(40);
  assert.equal(wsMessages[0]?.type, 'SYNC_THREADS');
  scheduler.markSidebarResult('acc');
  scheduler.unregisterAccount('acc');
});
