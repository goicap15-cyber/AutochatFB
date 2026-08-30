// Capture the CRM ownership token before Facebook's client-side navigation
// removes it from the address bar. Keep this script tiny and at document_start.
(() => {
  try {
    const pendingKey = new URL(window.location.href).searchParams.get('crm_pending_key');
    if (pendingKey && /^pending_[a-zA-Z0-9_]+$/.test(pendingKey)) {
      chrome.storage.local.set({ crm_pending_key: pendingKey });
    }
  } catch (_) {}
})();
