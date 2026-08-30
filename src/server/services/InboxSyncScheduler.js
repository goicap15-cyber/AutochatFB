class InboxSyncScheduler {
  constructor({
    sidebarIntervalMs = 60000,
    sidebarCooldownMs = 2500,
    sidebarTimeoutMs = 70000,
    threadCooldownMs = 2000,
    threadTimeoutMs = 20000
  } = {}) {
    this.sidebarIntervalMs = sidebarIntervalMs;
    this.sidebarCooldownMs = sidebarCooldownMs;
    this.sidebarTimeoutMs = sidebarTimeoutMs;
    this.threadCooldownMs = threadCooldownMs;
    this.threadTimeoutMs = threadTimeoutMs;

    this.accounts = new Map();
    this.threadInFlight = new Set();
    this.threadTimeouts = new Map();
    this.threadCooldownUntil = new Map();
    this.pendingThreadSyncs = new Map();
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
        pending: false,
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
    for (const [key, timeout] of [...this.threadTimeouts.entries()]) {
      if (key.startsWith(`${accId}:`)) {
        clearTimeout(timeout);
        this.threadTimeouts.delete(key);
      }
    }
    for (const key of [...this.threadCooldownUntil.keys()]) {
      if (key.startsWith(`${accId}:`)) this.threadCooldownUntil.delete(key);
    }
    for (const key of [...this.pendingThreadSyncs.keys()]) {
      if (key.startsWith(`${accId}:`)) this.pendingThreadSyncs.delete(key);
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
    if (this.accountThreadBusy.has(accId)) {
      state.pending = true;
      console.log(`[INBOX_SYNC_DEFER] account=${accId} reason=${reason} defer=thread_history_busy`);
      return false;
    }
    if (state.inFlight && !force) {
      state.pending = true;
      console.log(`[INBOX_SYNC_DEFER] account=${accId} reason=${reason} defer=in_flight`);
      return false;
    }
    if (!force && now - state.lastSidebarSyncAt < this.sidebarCooldownMs) {
      state.pending = true;
      const delay = Math.max(25, this.sidebarCooldownMs - (now - state.lastSidebarSyncAt));
      console.log(`[INBOX_SYNC_DEFER] account=${accId} reason=${reason} defer=cooldown delay_ms=${delay}`);
      if (!state.pendingTimer) {
        state.pendingTimer = setTimeout(() => {
          state.pendingTimer = null;
          if (state.pending) this.requestSidebarSync(accId, 'pending_replay');
        }, delay);
        if (typeof state.pendingTimer.unref === 'function') state.pendingTimer.unref();
      }
      return false;
    }

    const extWs = this.getConnection(accId);
    if (!extWs || extWs.readyState !== 1) {
      console.warn(`[INBOX_SYNC_SKIP] account=${accId} reason=${reason} skip=extension_not_ready`);
      return false;
    }

    state.inFlight = true;
    state.pending = false;
    state.lastSidebarSyncAt = now;
    if (state.timeout) clearTimeout(state.timeout);
    state.timeout = setTimeout(() => {
      const current = this.accounts.get(accId);
      if (current?.inFlight) {
        current.inFlight = false;
        console.warn(`[INBOX_SYNC_TIMEOUT] account=${accId} timeout_ms=${this.sidebarTimeoutMs}`);
        if (current.pending) this.requestSidebarSync(accId, 'timeout_replay', { force: true });
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
    if (state.pending) {
      const timer = setTimeout(() => this.requestSidebarSync(accId, 'result_replay'), this.sidebarCooldownMs);
      if (typeof timer.unref === 'function') timer.unref();
    }
  }

  enqueueThreadSync({ account_id, thread_id, thread_url = null, page_id = null, contact_name = null, reason = 'changed', allow_navigation = false }) {
    const accId = String(account_id || '');
    const threadId = String(thread_id || '');
    if (!accId || !threadId || !this.dispatchThreadMessagesSync) return false;

    const key = `${accId}:${threadId}`;
    const now = Date.now();
    const jobData = { account_id: accId, thread_id: threadId, thread_url, page_id, contact_name, reason, allow_navigation: allow_navigation === true };
    const cooldownUntil = this.threadCooldownUntil.get(key) || 0;
    if (this.threadInFlight.has(key) || now < cooldownUntil) {
      this.pendingThreadSyncs.set(key, { ...jobData, reason: `${reason}_replay` });
      const deferredBy = this.threadInFlight.has(key) ? 'in_flight' : 'cooldown';
      console.log(`[INBOX_SYNC_MESSAGES_DEFER] account=${accId} thread=${threadId} reason=${reason} defer=${deferredBy}`);
      if (deferredBy === 'cooldown') {
        const timer = setTimeout(() => this.replayPendingThread(key), Math.max(25, cooldownUntil - now));
        if (typeof timer.unref === 'function') timer.unref();
      }
      return false;
    }

    const queue = this.threadQueues.get(accId) || [];
    const existingIndex = queue.findIndex(job => job.key === key);
    if (existingIndex >= 0) {
      queue[existingIndex] = { key, ...jobData };
      console.log(`[INBOX_SYNC_MESSAGES_COALESCED] account=${accId} thread=${threadId} reason=${reason}`);
      return false;
    }

    queue.push({ key, ...jobData });
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
      page_id: job.page_id,
      contact_name: job.contact_name,
      reason: job.reason,
      allow_navigation: job.allow_navigation === true,
      force: false
    });

    if (!dispatched) {
      this.threadInFlight.delete(job.key);
      this.accountThreadBusy.delete(accId);
      setTimeout(() => this.drainThreadQueue(accId), 250);
      return;
    }

    const timeout = setTimeout(() => {
      this.threadTimeouts.delete(job.key);
      if (this.threadInFlight.delete(job.key)) {
        this.accountThreadBusy.delete(accId);
        console.warn(`[INBOX_SYNC_MESSAGES_TIMEOUT] account=${accId} thread=${job.thread_id} timeout_ms=${this.threadTimeoutMs}`);
        this.replayPendingThread(job.key);
        this.drainThreadQueue(accId);
        const sidebarState = this.accounts.get(accId);
        if (sidebarState?.pending) this.requestSidebarSync(accId, 'thread_timeout_replay', { force: true });
      }
    }, this.threadTimeoutMs);
    this.threadTimeouts.set(job.key, timeout);
    if (typeof timeout.unref === 'function') timeout.unref();
  }

  replayPendingThread(key) {
    const pending = this.pendingThreadSyncs.get(key);
    if (!pending || this.threadInFlight.has(key)) return false;
    const cooldownUntil = this.threadCooldownUntil.get(key) || 0;
    if (Date.now() < cooldownUntil) {
      const timer = setTimeout(() => this.replayPendingThread(key), Math.max(25, cooldownUntil - Date.now()));
      if (typeof timer.unref === 'function') timer.unref();
      return false;
    }
    this.pendingThreadSyncs.delete(key);
    return this.enqueueThreadSync(pending);
  }

  markThreadSyncResult(accountId, threadId, reason = null) {
    const accId = String(accountId || '');
    const key = `${accId}:${String(threadId || '')}`;
    if (this.threadInFlight.delete(key)) {
      const timeout = this.threadTimeouts.get(key);
      if (timeout) clearTimeout(timeout);
      this.threadTimeouts.delete(key);
      this.accountThreadBusy.delete(accId);
      console.log(`[INBOX_SYNC_MESSAGES_RESULT] account=${accountId} thread=${threadId}${reason ? ` reason=${reason}` : ''}`);
      this.replayPendingThread(key);
      const timer = setTimeout(() => {
        this.drainThreadQueue(accId);
        const sidebarState = this.accounts.get(accId);
        if (!this.accountThreadBusy.has(accId) && sidebarState?.pending) {
          this.requestSidebarSync(accId, 'thread_result_replay', { force: true });
        }
      }, 25);
      if (typeof timer.unref === 'function') timer.unref();
    }
  }
}

const inboxSyncScheduler = new InboxSyncScheduler();
inboxSyncScheduler.InboxSyncScheduler = InboxSyncScheduler;
module.exports = inboxSyncScheduler;
