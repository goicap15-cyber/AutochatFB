# Implementation Plan: Multi-Account Reliability Hardening

## Architecture

Five independent fixes across four files; none share code paths, so each is its own isolated phase with its own gate. No new services, no schema changes. Two related findings from the same review (registered-tab reuse, "any tab" fallback) are already fixed in `background.js`'s `getBusinessSuiteTab`/`getFacebookTab` — this plan does not touch those again.

## Phases

0. **Research (done)**: every finding below was re-verified by reading the exact current source at the cited file/line before writing this plan — not assumed correct from the original review. No live reproduction was needed; these are structural code-reading findings (race conditions, missing checks, missing handlers), not DOM/timing behavior requiring a browser.

1. **US1 / FR-001 — Serialize tab creation per role** (`src/extension/background.js`): add a module-level `Map<role, Promise<tab>>` (e.g. `pendingTabCreation`) alongside the existing `tabRegistry`. In `ensureFacebookMessagesTab()`'s and `handleSendPageMessage()`'s "no tab found → create" branches, before calling `chrome.tabs.create`, check this map for an in-flight promise for the same role; if present, `await` and return it instead of creating a second tab. Store the creation promise in the map immediately (before any `await`) and delete it in a `finally` once settled, so the check-and-set has no gap for a second concurrent call to slip through.

2. **US2 / FR-002 — Tighten `isBusiness` in `page_content.js`**: remove the `(window.top !== window.self && window.location.hostname.includes('facebook.com'))` clause entirely. The other three conditions (`hostname === 'business.facebook.com'`, `href.includes('asset_id=')`, `href.includes('/biz/')`) already correctly identify a genuine Business Suite frame *by its own URL*, regardless of whether it's the top frame or an iframe — the removed clause was the only one that could fire for an iframe that is merely *hosted under* a facebook.com hostname without itself being Business Suite content. No manifest.json change needed: `content_scripts[2].matches` already scopes by each frame's own URL, so keeping the existing match patterns is fine once `isBusiness` itself is correct.

3. **US3 / FR-003 — WebSocket close identity check** (`src/server/server.js`): change the `ws.on('close', ...)` handler's guard from `if (ws.accountId)` to `if (ws.accountId && extensionConnections.get(ws.accountId) === ws)`, so a stale socket's close event can never evict a newer, still-live connection registered for the same account. Same guard should protect the `domReplaySuppressUntil.delete`/DB update/socket emits inside, since they're all inside the same `if` block already.

4. **US4 / FR-004 — Restart-survivable process tracking** (`src/server/services/ProcessManager.js`): persist a small `{accountId: {pid, profileDir}}` JSON registry to `data/process-registry.json`, written on every successful spawn and on `stopAccountProcess`. On `startAccountProcess`, before checking the in-memory `this.processes` map, also check the persisted registry for a PID recorded for that account and probe liveness with `process.kill(pid, 0)` (throws if the process doesn't exist; never actually sends a kill signal) — if alive, adopt it into `this.processes` and skip spawning a duplicate; if dead or absent, proceed with the existing spawn logic and update the registry.

5. **US5 / FR-005 — Handle `EADDRINUSE` gracefully** (`src/server/server.js`): add `server.on('error', (err) => {...})` near `startServer()`'s `server.listen(...)` call, distinguishing `err.code === 'EADDRINUSE'` (log a clear "port already in use" message, `process.exit(1)`) from other errors (log and exit non-zero too, but with the raw error for diagnosis) — replacing Node's default unhandled-exception crash with a controlled, readable exit.

6. **Validation**: `node --check` on every touched file, `npm run test:persistence` (confirm no regression), and a manual pass per finding: (a) trigger two near-simultaneous sync/send calls for an account with no tab yet and confirm only one tab appears; (b) confirm `page_content.js`'s startup log does not fire inside an unrelated facebook.com iframe on a personal Messenger page; (c) manually register two sockets for the same account_id and close the first, confirming the account stays `is_connected: true`; (d) restart the backend with a Chrome process still alive for an account and confirm starting that account again does not spawn a second Chrome; (e) start a second `npm start` on an occupied port and confirm a clean error exit instead of a crash trace. Then `graphify update .`.

## Safety Gates

- No change to already-verified logic: feature 013's tab-registry eviction, feature 024's direction-detection fix, or the two already-shipped `getBusinessSuiteTab`/`getFacebookTab` correctness fixes from this same review.
- The tab-creation lock (Phase 1) must not deadlock — always released in a `finally`, even if `chrome.tabs.create` itself throws.
- The `isBusiness` tightening (Phase 2) must not stop the extension from working on genuine Business Suite iframes (Business Suite itself sometimes renders parts of its UI in iframes whose own URL carries `asset_id=` — those still pass).
- The process-registry (Phase 4) is informational/liveness-only — it must never be used to *kill* a process it didn't expect, only to avoid *starting* a redundant one.
- `EADDRINUSE` handling (Phase 5) must exit the process rather than leaving it in a half-started, silently-broken state.
