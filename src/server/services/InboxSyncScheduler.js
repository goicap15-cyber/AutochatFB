class InboxSyncScheduler {
  constructor({
    sidebarIntervalMs = 15000,
    sidebarCooldownMs = 9000,
    sidebarTimeoutMs = 20000,
    threadCooldownMs = 8000,
    threadTimeoutMs = 30000
  } = {}) {
    this.sidebarIntervalMs = sidebarIntervalMs;
    this.sidebarCooldownMs = sidebarCooldownMs;
    this.sidebarTimeoutMs = sidebarTimeoutMs;
    this.threadCooldownMs = threadCooldownMs;
    this.threadTimeoutMs = threadTimeoutMs;

    this.accounts = new Map();
    this.threadInFlight = new Set();
    this.threadCooldownUntil = new Map();
    this.threadQueues = new Map();
    this.accountThreadBusy = new Set();
    this.getConnection = null;
    this.dispatchThreadMessagesSync = null;
  }

  configure({ getConnection, dispatchThreadMessagesSync }) {
    this.getConnection = getConnection;
    this.dispatchThreadMessagesSync = dispatchThreadMessagesSync;
  }

  registerAccount(accountId) {
    const accId = String(accountId || '');
    if (!accId) return;

    let state = this.accounts.get(accId);
    if (!state) {
      state = {
        account_id: accId,
        inFlight: false,
        lastSidebarSyncAt: 0,
        lastResultAt: 0,
        timeout: null,
        interval: null
      };
      this.accounts.set(accId, state);
    }

    if (!state.interval) {
      state.interval = setInterval(() => {
        console.log(`[INBOX_SYNC_TICK] account=${accId}`);
        this.requestSidebarSync(accId, 'scheduler');
      }, this.sidebarIntervalMs);
      if (typeof state.interval.unref === 'function') state.interval.unref();
    }

    console.log(`[INBOX_SYNC_REGISTER] account=${accId} interval_ms=${this.sidebarIntervalMs}`);
    const timer = setTimeout(() => this.requestSidebarSync(accId, 'register', { force: true }), 1500);
    if (typeof timer.unref === 'function') timer.unref();
  }

  unregisterAccount(accountId) {
    const accId = String(accountId || '');
    const state = this.accounts.get(accId);
    if (!state) return;
    if (state.interval) clearInterval(state.interval);
    if (state.timeout) clearTimeout(state.timeout);
    this.accounts.delete(accId);
    this.threadQueues.delete(accId);
    this.accountThreadBusy.delete(accId);

    for (const key of [...this.threadInFlight]) {
      if (key.startsWith(`${accId}:`)) this.threadInFlight.delete(key);
    }
    for (const key of [...this.threadCooldownUntil.keys()]) {
      if (key.startsWith(`${accId}:`)) this.threadCooldownUntil.delete(key);
    }
    console.log(`[INBOX_SYNC_UNREGISTER] account=${accId}`);
  }

  requestSidebarSync(accountId, reason = 'manual', { force = false } = {}) {
    const accId = String(accountId || '');
    if (!accId || !this.getConnection) return false;

    const state = this.accounts.get(accId) || {
      account_id: accId,
      inFlight: false,
      lastSidebarSyncAt: 0,
      lastResultAt: 0,
      timeout: null,
      interval: null
    };
    this.accounts.set(accId, state);

    const now = Date.now();
    if (state.inFlight && !force) {
      console.log(`[INBOX_SYNC_SKIP] account=${accId} reason=${reason} skip=in_flight`);
      return false;
    }
    if (!force && now - state.lastSidebarSyncAt < this.sidebarCooldownMs) {
      console.log(`[INBOX_SYNC_SKIP] account=${accId} reason=${reason} skip=cooldown age_ms=${now - state.lastSidebarSyncAt}`);
      return false;
    }

    const extWs = this.getConnection(accId);
    if (!extWs || extWs.readyState !== 1) {
      console.warn(`[INBOX_SYNC_SKIP] account=${accId} reason=${reason} skip=extension_not_ready`);
      return false;
    }

    state.inFlight = true;
    state.lastSidebarSyncAt = now;
    if (state.timeout) clearTimeout(state.timeout);
    state.timeout = setTimeout(() => {
      const current = this.accounts.get(accId);
      if (current?.inFlight) {
        current.inFlight = false;
        console.warn(`[INBOX_SYNC_TIMEOUT] account=${accId} timeout_ms=${this.sidebarTimeoutMs}`);
      }
    }, this.sidebarTimeoutMs);
    if (typeof state.timeout.unref === 'function') state.timeout.unref();

    extWs.send(JSON.stringify({ type: 'SYNC_THREADS', data: { account_id: accId, reason } }));
    console.log(`[INBOX_SYNC_THREADS_DISPATCHED] account=${accId} reason=${reason}`);
    return true;
  }

  markSidebarResult(accountId, count = 0) {
    const accId = String(accountId || '');
    const state = this.accounts.get(accId);
    if (!state) return;
    state.inFlight = false;
    state.lastResultAt = Date.now();
    if (state.timeout) {
      clearTimeout(state.timeout);
      state.timeout = null;
    }
    console.log(`[INBOX_SYNC_THREADS_RESULT] account=${accId} count=${count}`);
  }

  enqueueThreadSync({ account_id, thread_id, thread_url = null, reason = 'changed' }) {
    const accId = String(account_id || '');
    const threadId = String(thread_id || '');
    if (!accId || !threadId || !this.dispatchThreadMessagesSync) return false;

    const key = `${accId}:${threadId}`;
    const now = Date.now();
    const cooldownUntil = this.threadCooldownUntil.get(key) || 0;
    if (this.threadInFlight.has(key)) {
      console.log(`[INBOX_SYNC_MESSAGES_SKIP] account=${accId} thread=${threadId} reason=${reason} skip=in_flight`);
      return false;
    }
    if (now < cooldownUntil) {
      console.log(`[INBOX_SYNC_MESSAGES_SKIP] account=${accId} thread=${threadId} reason=${reason} skip=cooldown remaining_ms=${cooldownUntil - now}`);
      return false;
    }

    const queue = this.threadQueues.get(accId) || [];
    if (queue.some(job => job.key === key)) {
      console.log(`[INBOX_SYNC_MESSAGES_SKIP] account=${accId} thread=${threadId} reason=${reason} skip=already_queued`);
      return false;
    }

    queue.push({ key, account_id: accId, thread_id: threadId, thread_url, reason });
    this.threadQueues.set(accId, queue);
    this.threadCooldownUntil.set(key, now + this.threadCooldownMs);
    console.log(`[INBOX_SYNC_MESSAGES_QUEUED] account=${accId} thread=${threadId} reason=${reason} queue_depth=${queue.length}`);
    this.drainThreadQueue(accId);
    return true;
  }

  drainThreadQueue(accountId) {
    const accId = String(accountId || '');
    if (!accId || this.accountThreadBusy.has(accId)) return;

    const queue = this.threadQueues.get(accId) || [];
    const job = queue.shift();
    if (!job) return;
    this.threadQueues.set(accId, queue);

    this.accountThreadBusy.add(accId);
    this.threadInFlight.add(job.key);
    console.log(`[INBOX_SYNC_MESSAGES_DISPATCHED] account=${accId} thread=${job.thread_id} reason=${job.reason} remaining_queue=${queue.length}`);

    const dispatched = this.dispatchThreadMessagesSync({
      account_id: job.account_id,
      thread_id: job.thread_id,
      thread_url: job.thread_url,
      reason: job.reason,
      force: false
    });

    if (!dispatched) {
      this.threadInFlight.delete(job.key);
      this.accountThreadBusy.delete(accId);
      setTimeout(() => this.drainThreadQueue(accId), 250);
      return;
    }

    const timeout = setTimeout(() => {
      if (this.threadInFlight.delete(job.key)) {
        this.accountThreadBusy.delete(accId);
        console.warn(`[INBOX_SYNC_MESSAGES_TIMEOUT] account=${accId} thread=${job.thread_id} timeout_ms=${this.threadTimeoutMs}`);
        this.drainThreadQueue(accId);
      }
    }, this.threadTimeoutMs);
    if (typeof timeout.unref === 'function') timeout.unref();
  }

  markThreadSyncResult(accountId, threadId, reason = null) {
    const accId = String(accountId || '');
    const key = `${accId}:${String(threadId || '')}`;
    if (this.threadInFlight.delete(key)) {
      this.accountThreadBusy.delete(accId);
      console.log(`[INBOX_SYNC_MESSAGES_RESULT] account=${accountId} thread=${threadId}${reason ? ` reason=${reason}` : ''}`);
      const timer = setTimeout(() => this.drainThreadQueue(accId), 250);
      if (typeof timer.unref === 'function') timer.unref();
    }
  }
}

module.exports = new InboxSyncScheduler();
