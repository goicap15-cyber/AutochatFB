# Implementation Plan: Page Composer Detection Hardening

## Architecture

Entirely contained within `handleSendPageMessage()` in `src/extension/background.js`. Reuses this same file's own established polling idiom (the `while (Date.now() - startTime < timeoutMs) { ...check...; await delay(...); continue; }` loop already used by `waitForThreadDomReady()` for history-sync DOM readiness) rather than inventing a new pattern. No other function changes.

## Phases

1. **Extract a composer-finder poll function**: add a small polling helper, injected via `chrome.scripting.executeScript`, that repeatedly queries for `[contenteditable="true"], [role="textbox"]` (last match, matching today's selector) every ~300-500ms up to a bounded timeout (e.g. 6-8s), returning success as soon as found instead of checking once.

2. **Reorder `handleSendPageMessage`'s flow**: on a tab that already exists (from `getBusinessSuiteTab`), skip the URL-match navigation-first logic — go straight to Phase 1's poll on the tab as-is. Only if the poll times out with no composer found, THEN fall back to navigating (`chrome.tabs.update` to `targetUrl`) and poll again once (FR-004) before giving up.

3. **New-tab case unaffected in spirit, tightened in mechanism**: when `getBusinessSuiteTab` finds nothing and a brand-new tab is created, keep creating it, but replace the fixed `Promise.race([waitForTabComplete(...), delay(...)])` + immediate composer check with the same Phase 1 poll after tab creation, so a slow-rendering fresh tab gets the same resilience as an existing one.

4. **Failure path unchanged**: if the composer still isn't found after navigate-and-poll, throw the same `"Không tìm thấy ô soạn tin nhắn Business Suite"` error as today — feature 015's `QUEUED_MESSAGE_RESULT` handling already turns this into a visible `failed` status, satisfying FR-005/US3 with no new code there.

5. **Validation**: manual test — (a) send while already on the correct conversation, confirm no navigation occurs and the send succeeds; (b) send to a thread requiring a fresh tab, confirm it succeeds once the SPA settles; (c) send to a Page whose tab got closed mid-flight or is genuinely unreachable, confirm a visible `failed` status within a bounded time (not a hang).

## Safety Gates

- Do not change `handleSendMessage` (personal-messenger path) or any function other than `handleSendPageMessage`.
- The polling timeout must be bounded (no infinite retry) — a genuinely broken conversation must still fail within a predictable time, not hang forever.
- Do not remove the navigation fallback entirely — some cases (tab truly on the wrong Page/thread) still need it; this feature changes the *order and conditions*, not the *existence*, of navigation.
- No change to the composer selector itself unless live testing during implementation shows it's actually wrong (current evidence says it's right — the problem is timing, not the selector).
