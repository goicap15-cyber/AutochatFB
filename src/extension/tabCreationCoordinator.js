// Serializes tab discovery/creation per role (e.g. "personal:<accountId>" or
// "page:<pageId>") so concurrent callers never race into creating two tabs
// for the same identity. Concurrent run() calls for the same role share the
// same in-flight promise; a single call also rechecks findExisting once it
// holds the role's slot, so a tab registered by another path just before
// this one committed to creating is reused instead of duplicated. See
// specs/025-multi-account-reliability-hardening (finding #3).
(function (root) {
  'use strict';

  function createTabCreationCoordinator() {
    const pending = new Map(); // role -> in-flight promise

    function run(role, findExisting, create) {
      if (pending.has(role)) {
        return pending.get(role);
      }

      const attempt = (async () => {
        try {
          let existing = await findExisting();
          if (existing) return existing;
          // Inside-lock recheck: another caller may have registered a tab for
          // this role between the check above and acquiring this slot.
          existing = await findExisting();
          if (existing) return existing;
          return await create();
        } finally {
          pending.delete(role);
        }
      })();

      pending.set(role, attempt);
      return attempt;
    }

    function pendingCount() {
      return pending.size;
    }

    return { run, pendingCount };
  }

  const api = { createTabCreationCoordinator };
  if (root) root.FbCrmTabCreationCoordinator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
