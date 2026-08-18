# Feature Specification: Multi-Account Reliability Hardening

**Feature Branch**: `025-multi-account-reliability-hardening`
**Created**: 2026-08-11
**Status**: Draft

**Input**: An independent code review (by another AI agent, "codex") of `src/extension/background.js`, `src/extension/manifest.json`, `src/extension/page_content.js`, `src/server/server.js`, and `src/server/services/ProcessManager.js` flagged 7 findings. Two (registered-tab reuse without re-verifying the Page/account, and the "grab any Facebook tab" fallback in `getFacebookTab`) were independently verified against the live source and fixed directly (see git history — `getBusinessSuiteTab()`/`getFacebookTab()` in `background.js`). The remaining 5 were also independently verified line-by-line against the current source (not assumed correct) and are real:

1. **Tab-creation race condition** — `ensureFacebookMessagesTab()` (`background.js:428`) and `handleSendPageMessage()`'s tab-creation branch (`background.js:815`) both do "check registry → if missing, `chrome.tabs.create` → then register" with no lock between the check and the create. Two near-simultaneous calls (e.g. a sync tick racing a send) can both observe "no tab" and both create one.
2. **Content script runs in unrelated Facebook iframes** — `manifest.json:50-55`'s third `content_scripts` entry matches both `business.facebook.com/*` and `*.facebook.com/*` with `all_frames: true`. `page_content.js`'s `isBusiness` check (`page_content.js:6-9`) additionally treats *any* iframe whose hostname merely contains "facebook.com" as Business Suite (`window.top !== window.self && hostname.includes('facebook.com')`) — this can fire inside ad/plugin/personal-Messenger iframes that have nothing to do with Business Suite, risking personal-message cross-contamination into the Page capture path that features 010/023 deliberately kept separate.
3. **Stale WebSocket close deletes a newer connection** — `server.js:834-841`'s `ws.on('close')` handler unconditionally does `extensionConnections.delete(ws.accountId)`. If an old socket for an account closes *after* a newer socket for the same account has already re-registered (`server.js:153`, `extensionConnections.set(account_id, ws)` — observed to happen often, given how frequently `REGISTER_ACCOUNT` fires in this codebase's logs), the close handler deletes the live connection's entry and broadcasts a false `DISCONNECTED`.
4. **ProcessManager loses track of Chrome across server restarts** — `ProcessManager.js:7`'s `this.processes = new Map()` is in-memory only, with no on-disk record. Restarting the backend forgets which Chrome processes it already started; a subsequent "start account" call can spawn a duplicate Chrome/tab set for an account whose old Chrome process is still running.
5. **Unhandled `EADDRINUSE` crashes the server** — `server.js:1130`'s `server.listen(...)` has no `.on('error', ...)` handler anywhere in the file (confirmed: the only `server.on(...)` in the file is `'upgrade'`). A second `npm start` while the port is already bound throws an unhandled `error` event and crashes the process instead of failing gracefully.

Separately noted (not a new bug, but underscored as more common in practice than "edge case" implies): the existing `KNOWN LIMITATION` test for content-only dedup when `fb_message_id` is absent is realistic — production logs routinely show `FB Message ID: null` for system/date-separator text (already filtered by the Backend Guard) and, less often, for genuine messages. No fix is proposed here; flagged for awareness only.

## User Stories

### US1 — Concurrent sync/send never creates two tabs for the same role (P1)

Given two calls that both need a tab for the same role (`personal:<accountId>` or `page:<pageId>`) arrive close together with no tab yet registered, only one tab is created; the second call reuses it once registered.

**Acceptance**: Firing `ensureFacebookMessagesTab` (or the page-send tab-creation path) twice in quick succession for the same role, with no tab initially registered, results in exactly one `chrome.tabs.create` call and one registered tab.

### US2 — Page capture never runs inside an unrelated Facebook iframe (P1)

Given a personal `www.facebook.com` page (or any page) that happens to contain an embedded Facebook iframe unrelated to Business Suite, `page_content.js`'s scanning logic does not activate inside that iframe.

**Acceptance**: The `isBusiness` gate requires genuine Business Suite context (the `business.facebook.com` hostname itself, or an `asset_id`/`/biz/` URL marker on the frame's own URL) — being *merely* an iframe on a facebook.com-hostname page is no longer sufficient by itself.

### US3 — A stale socket closing never marks a live connection disconnected (P1)

Given account X has an old WebSocket connection that is about to close and a newer WebSocket connection already registered for the same account, the old connection's close handler does not delete or affect the newer connection's registration or status.

**Acceptance**: Simulating register(A, wsOld) → register(A, wsNew) → close(wsOld) leaves `extensionConnections.get('A') === wsNew` and does not emit `DISCONNECTED` for A.

### US4 — Restarting the backend does not spawn duplicate Chrome processes (P2)

Given the backend restarts while a Chrome process for an account is still running, starting that account again detects the existing process (or its absence) correctly instead of always assuming "not running".

**Acceptance**: After a simulated restart (fresh `ProcessManager` instance, same underlying OS process still alive), calling `startAccountProcess` for that account does not spawn a second Chrome process for it.

### US5 — A port conflict fails gracefully instead of crashing (P2)

Given port 5050 is already in use (e.g. a previous `npm start` still running), starting the server again logs a clear error and exits (or fails the specific listen call) instead of throwing an unhandled exception.

**Acceptance**: Starting a second instance on an already-bound port produces a readable "port already in use" message and a clean, non-zero exit — no raw Node stack trace from an unhandled `error` event.

## Functional Requirements

- **FR-001**: Tab-creation for a given role (`personal:<accountId>` or `page:<pageId>`) MUST be serialized — a second concurrent request for the same role while a create is already in flight MUST wait for and reuse its result rather than starting a second `chrome.tabs.create`.
- **FR-002**: `page_content.js`'s Business Suite detection MUST NOT treat "is an iframe on a facebook.com-hostname page" alone as sufficient; the frame's own URL/hostname must show genuine Business Suite context.
- **FR-003**: The WebSocket `close` handler MUST only clear an account's connection/status if the closing socket is still the one currently registered for that account (identity check, e.g. `extensionConnections.get(accountId) === ws`), never by account ID alone.
- **FR-004**: `ProcessManager` MUST be able to determine, after a restart, whether a Chrome process it previously started for an account is still running, and avoid starting a duplicate when it is.
- **FR-005**: The server's `listen()` call MUST have an error handler that distinguishes `EADDRINUSE` (log a clear message, exit non-zero) from other startup errors, instead of relying on Node's default unhandled-`error` crash.
- **FR-006**: None of the above changes MUST alter existing, already-verified behavior: the feature-013 tab-registry eviction-on-close logic, the feature-024 direction-detection fix, or the just-shipped `getBusinessSuiteTab`/`getFacebookTab` correctness fixes.

### Key Entities

- **Tab-creation in-flight lock**: a per-role (`personal:<accountId>` / `page:<pageId>`) marker (e.g. a `Map<role, Promise>`) that lets a second concurrent caller await the same pending tab-creation instead of starting its own.
- **Connection identity**: the specific WebSocket instance currently registered for an account, checked by reference (not just by account ID) before evicting on close.
- **Process liveness record**: a way to check whether a previously-spawned Chrome process (by PID, persisted across restarts) is still alive.

## Success Criteria

- **SC-001**: Two concurrent tab-needing calls for the same never-yet-registered role result in exactly one tab created (US1).
- **SC-002**: A simulated Business Suite personal-page iframe scenario does not trigger `page_content.js`'s scan logic (US2).
- **SC-003**: Old-connection-closes-after-new-connection-registers never flips a live account to `DISCONNECTED` (US3).
- **SC-004**: Restarting the backend with a live Chrome process for an account does not spawn a second one for that account (US4).
- **SC-005**: A second server start on an occupied port exits cleanly with a readable message, no unhandled exception (US5).
- **SC-006**: `npm run test:persistence` and `node --check` on all touched files still pass; no regression to feature 010/013/023/024 behavior or the two already-shipped fixes from this same review.

## Scope and Assumptions

In scope: `src/extension/background.js` (tab-creation locking), `src/extension/manifest.json` + `src/extension/page_content.js` (iframe scope), `src/server/server.js` (WebSocket close identity check, listen error handling), `src/server/services/ProcessManager.js` (restart-survivable process tracking).

Out of scope: the two already-fixed findings (registered-tab reuse, "any tab" fallback), the direction-detection work in feature 024, and the documented `fb_message_id`-absent dedup limitation (noted for awareness only, no fix proposed here).

Assumes each finding can be fixed independently without needing to touch the others' code paths — verified during research by re-reading each referenced file/line in isolation before deciding scope; if any interdependency is found during implementation, plan.md must be updated to say so rather than silently expanding scope.
