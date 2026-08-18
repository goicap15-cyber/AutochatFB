# Tasks: Multi-Account Reliability Hardening

## Phase 0 — Research (done, see spec.md Input)

- [x] T001 Re-verified all 5 remaining findings against current source (exact file/line) before scoping this plan; documented in spec.md's Input section. The 2 already-fixed findings (registered-tab reuse, "any tab" fallback) are out of scope here.

## Phase 1 — Serialize tab creation per role (US1 / FR-001)

- [x] T002 Implemented as a reusable module instead of an inline Map: `src/extension/tabCreationCoordinator.js` (`createTabCreationCoordinator()`), loaded into `background.js` via `importScripts('tabCreationCoordinator.js')` and instantiated once as `tabCreationCoordinator`. Covered by `tests/unit/tabCreationCoordinator.test.js` (concurrent-dedup, inside-lock recheck, independent roles, failure clears the lock).
- [x] T003 `ensureFacebookMessagesTab()`'s "no tab found" branch now calls `tabCreationCoordinator.run(role, () => getFacebookTab(accountId), create)`; concurrent callers for the same role share one `chrome.tabs.create`, and the coordinator rechecks `getFacebookTab` once more before creating.
- [x] T004 Same pattern applied to `handleSendPageMessage()`'s "no tab found" branch (role `page:${page_id}`), rechecking `getBusinessSuiteTab(page_id)`.
- [ ] T005 Manual test: fire two calls that both need a tab for the same never-yet-registered role within milliseconds of each other; confirm only one `chrome.tabs.create` happens (one new tab, not two). Automated concurrency coverage exists (T002); this line is still unchecked because it requires an actual live two-call race in the running extension, not just the unit test.

## Phase 2 — Tighten Business Suite iframe detection (US2 / FR-002)

- [ ] T006 In `src/extension/page_content.js`, remove the `(window.top !== window.self && window.location.hostname.includes('facebook.com'))` clause from the `isBusiness` check, keeping only the three URL-based conditions (hostname === business.facebook.com, asset_id=, /biz/).
- [ ] T007 Manual test: open a personal `www.facebook.com` page containing an embedded Facebook iframe unrelated to Business Suite (e.g. a share/like plugin) and confirm `[PageContent] Business Suite Inbox DOM observer started` does not log for that iframe.
- [ ] T008 Manual test: confirm a genuine Business Suite thread (business.facebook.com or an iframe whose own URL carries asset_id=) still activates normally - no regression to feature 010/023 capture.

## Phase 3 — WebSocket close identity check (US3 / FR-003)

- [ ] T009 In `src/server/server.js`, change the `ws.on('close', ...)` handler's condition from `if (ws.accountId)` to `if (ws.accountId && extensionConnections.get(ws.accountId) === ws)`.
- [ ] T010 Manual/scripted test: register socket A for account X, register socket B for account X (simulating a reconnect), close socket A, and confirm `extensionConnections.get('X') === B` and no `DISCONNECTED` event fires for X.

## Phase 4 — Restart-survivable process tracking (US4 / FR-004)

- [ ] T011 In `src/server/services/ProcessManager.js`, add a small JSON-backed registry (`data/process-registry.json`) mapping `accountId -> { pid, profileDir }`, written on successful spawn (`startAccountProcess`/`startNewAccountProcess`) and cleared on `stopAccountProcess`.
- [ ] T012 In `startAccountProcess()`, before spawning, check the persisted registry for an existing PID for this account and probe liveness via `process.kill(pid, 0)` (catch ESRCH as "not alive"); if alive, adopt it into `this.processes` and return without spawning.
- [ ] T013 Manual test: start an account's Chrome process, create a fresh `ProcessManager` instance (simulating a backend restart) without killing the OS process, and confirm calling `startAccountProcess` for that account does not spawn a second Chrome.

## Phase 5 — Handle EADDRINUSE gracefully (US5 / FR-005)

- [ ] T014 In `src/server/server.js`'s `startServer()`, add `server.on('error', (err) => {...})` distinguishing `EADDRINUSE` (clear message, `process.exit(1)`) from other listen errors (log + exit non-zero).
- [ ] T015 Manual test: with the server already running on port 5050, run `npm start` a second time and confirm a clean, readable error message and non-zero exit instead of an unhandled-exception stack trace.

## Phase 6 — Validation

- [ ] T016 `node --check` on `background.js`, `page_content.js`, `server.js`, `ProcessManager.js`.
- [ ] T017 `npm run test:persistence` - confirm no regression.
- [ ] T018 Run `graphify update .`.

## Dependencies

- Phase 0 informs all others but does not block them - each phase is independently scoped.
- Phases 1-5 are independent of each other and can be implemented/tested in any order.
- Phase 6 runs last, after all prior phases.
