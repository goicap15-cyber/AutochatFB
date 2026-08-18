# Tasks: Page Composer Detection Hardening

## Phase 1 — Composer-finder poll function

- [x] T001 Added `pollForComposer(tabId, timeoutMs = 7000, intervalMs = 400)` in `src/extension/background.js` — polls via repeated `chrome.scripting.executeScript` calls (checking `[contenteditable="true"], [role="textbox"]` existence) every 400ms up to a bounded timeout, returning as soon as found.

## Phase 2 — Reorder handleSendPageMessage

- [x] T002 For an existing tab, `handleSendPageMessage` now calls `pollForComposer(tab.id)` directly on the tab as-is first — no URL check, no unconditional navigation.
- [x] T003 Only if that poll returns false does it fall back to `chrome.tabs.update(tab.id, { url: targetUrl })` (kept the existing `waitForTabComplete`/`delay` race for the raw page-load signal) followed by one more `pollForComposer(tab.id)` before giving up.
- [x] T004 New-tab case: replaced the fixed `Promise.race([waitForTabComplete(...), delay(...)])` + extra `delay(3000)` + immediate check with a single `pollForComposer(tab.id, 10000)` (longer timeout than the existing-tab case, for cold tab bootstrap).

## Phase 3 — Failure path check (verification, not new code)

- [x] T005 Confirmed unchanged: `if (!composerReady) throw new Error('Không tìm thấy ô soạn tin nhắn Business Suite');` — same message, same downstream `QUEUED_MESSAGE_RESULT` → `failed` flow from feature 015.

## Phase 4 — Validation

- [ ] T006 Manual test: send while already on the correct Business Suite conversation; confirm no tab reload occurs and the send succeeds. **(requires live browser test — not run by this pass)**
- [ ] T007 Manual test: send to a Page thread requiring a freshly-created tab; confirm it succeeds once the SPA settles, without manual intervention. **(requires live browser test — not run by this pass)**
- [ ] T008 Manual test: send to an unreachable Page/thread (e.g. tab closed mid-flight); confirm a visible `failed` status appears within a bounded time, not an indefinite hang. **(requires live browser test — not run by this pass)**
- [x] T009 Ran `npm run test:persistence` (20/20 pass, no regression — `background.js` isn't covered by this suite, ran to confirm no collateral damage) and `graphify update .`.

## Dependencies

- Phase 1 blocks Phase 2.
- Phase 3 depends on Phase 2 existing.
- Phase 4 runs last.
