const test = require('node:test');
const assert = require('node:assert/strict');
const { createTabCreationCoordinator } = require('../../src/extension/tabCreationCoordinator');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('concurrent callers for one role share exactly one creation promise', async () => {
  const coordinator = createTabCreationCoordinator();
  const gate = deferred();
  let registered = null;
  let createCount = 0;

  const findExisting = async () => registered;
  const create = async () => {
    createCount += 1;
    await gate.promise;
    registered = { id: 101, role: 'personal:acct-1' };
    return registered;
  };

  const calls = Array.from({ length: 20 }, () => (
    coordinator.run('personal:acct-1', findExisting, create)
  ));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(createCount, 1);
  assert.equal(coordinator.pendingCount(), 1);

  gate.resolve();
  const results = await Promise.all(calls);
  assert.equal(results.every((tab) => tab.id === 101), true);
  assert.equal(createCount, 1);
  assert.equal(coordinator.pendingCount(), 0);
});

test('inside-lock recheck reuses a tab registered before creation starts', async () => {
  const coordinator = createTabCreationCoordinator();
  let lookupCount = 0;
  let createCount = 0;
  const existing = { id: 202 };

  const result = await coordinator.run(
    'page:page-1',
    async () => {
      lookupCount += 1;
      return lookupCount === 1 ? null : existing;
    },
    async () => {
      createCount += 1;
      return { id: 999 };
    }
  );

  assert.equal(result, existing);
  assert.equal(lookupCount, 2);
  assert.equal(createCount, 0);
});

test('different roles can create independently', async () => {
  const coordinator = createTabCreationCoordinator();
  let createCount = 0;
  const createFor = (id) => async () => {
    createCount += 1;
    return { id };
  };
  const [personal, page] = await Promise.all([
    coordinator.run('personal:acct-1', async () => null, createFor(1)),
    coordinator.run('page:page-1', async () => null, createFor(2))
  ]);
  assert.deepEqual([personal.id, page.id], [1, 2]);
  assert.equal(createCount, 2);
});

test('failed creation clears the role lock so a later call can retry', async () => {
  const coordinator = createTabCreationCoordinator();
  let attempts = 0;
  await assert.rejects(
    coordinator.run('personal:acct-2', async () => null, async () => {
      attempts += 1;
      throw new Error('forced creation failure');
    }),
    /forced creation failure/
  );
  assert.equal(coordinator.pendingCount(), 0);

  const recovered = await coordinator.run(
    'personal:acct-2',
    async () => null,
    async () => {
      attempts += 1;
      return { id: 303 };
    }
  );
  assert.equal(recovered.id, 303);
  assert.equal(attempts, 2);
});
