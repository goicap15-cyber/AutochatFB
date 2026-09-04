(function initMessengerTabRoles(root) {
  const PERSONAL_ROLES = ['interaction', 'discovery', 'history', 'requests'];

  function roleKey(accountId, role) {
    if (!PERSONAL_ROLES.includes(role)) throw new Error(`Unknown Messenger tab role: ${role}`);
    return `personal:${String(accountId)}:${role}`;
  }

  function legacyInteractionKey(accountId) {
    return `personal:${String(accountId)}`;
  }

  function roleForTab(registryEntries, accountId, tabId) {
    const targetId = String(tabId);
    const entries = Array.isArray(registryEntries) ? registryEntries : [];
    for (const [key, value] of entries) {
      if (String(value) !== targetId) continue;
      if (key === legacyInteractionKey(accountId) || key === roleKey(accountId, 'interaction')) return 'interaction';
      if (key === roleKey(accountId, 'discovery')) return 'discovery';
      if (key === roleKey(accountId, 'history')) return 'history';
      if (key === roleKey(accountId, 'requests')) return 'requests';
    }
    return null;
  }

  function canForwardRealtime(role) {
    return role === 'interaction';
  }

  function canForwardCallRealtime(role) {
    // Incoming-call UI is mirrored by Facebook to the background discovery
    // tab as well. Allow that tab to report calls; the backend deduplicates
    // simultaneous reports from interaction and discovery by caller/thread.
    return role === 'interaction' || role === 'discovery';
  }

  const api = { PERSONAL_ROLES, roleKey, legacyInteractionKey, roleForTab, canForwardRealtime, canForwardCallRealtime };
  root.FbCrmMessengerTabRoles = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
