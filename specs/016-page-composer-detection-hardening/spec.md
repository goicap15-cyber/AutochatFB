# Feature Specification: Page Composer Detection Hardening

**Feature Branch**: `016-page-composer-detection-hardening`
**Created**: 2026-08-07
**Status**: Draft

**Input**: Feature 015 wired the CRM's send button into the already-built Page-sending pipeline (`message_queue` → `QueueWorker` → `SEND_QUEUED_MESSAGE` → `handleSendPageMessage`), but live testing shows every send still fails with `"Không tìm thấy ô soạn tin nhắn Business Suite"` (composer not found), confirmed via the extension's own service worker console (`QUEUED_MESSAGE_RESULT` payload). This happens even when the operator is already looking at the exact right conversation in Business Suite. Root cause, from code review: `handleSendPageMessage()` decides whether the tab needs navigating by checking `tab.url.includes('selected_item_id=' + recipientPsid)` — but Business Suite is an SPA that selects conversations via client-side routing and does not reliably reflect the selected thread in the URL Chrome's tab API reports. This makes the "already on the right thread" check unreliable, causing an unnecessary `chrome.tabs.update` reload right before checking for the composer — followed by a single, immediate, one-shot DOM query for `[contenteditable="true"], [role="textbox"]` with no retry, which fails whenever the SPA hasn't finished re-rendering yet (manually confirmed: the same query returns 1 match when run by hand after the page has settled).

## User Stories

### US1 — Sending to a Page thread succeeds even from a cold/uncertain tab state (P1)

Given the extension's Business Suite tab has just been created or navigated, or its URL doesn't clearly indicate the target conversation is selected, the send flow waits for the composer to actually appear before giving up, instead of checking once immediately.

**Acceptance**: Simulating a composer that appears 1-3 seconds after the check starts (matching real SPA render delay) still results in a successful send, not a `"Không tìm thấy ô soạn tin nhắn Business Suite"` failure.

### US2 — Sending to a Page thread never triggers an unnecessary reload when already correct (P1)

Given the operator is already looking at the exact target conversation in Business Suite, sending a message does not force a tab reload first — reloading is only attempted when the composer genuinely cannot be found after polling.

**Acceptance**: With the Business Suite tab already on the correct conversation (composer visible), a send completes without any `chrome.tabs.update` navigation occurring.

### US3 — A composer that's still missing after polling produces a clear, actionable failure (P2)

Given the composer still cannot be found after the polling window, and after a navigation-and-retry attempt, the failure surfaces to the CRM as a real `failed` status (not a silent hang) — building on feature 015's `QUEUED_MESSAGE_RESULT` handling.

**Acceptance**: A genuinely broken/unreachable conversation (e.g. Page disconnected) still fails within a bounded time and is visible as `failed` in the CRM UI, not stuck `pending` forever.

## Functional Requirements

- **FR-001**: `handleSendPageMessage` MUST attempt to find the message composer with a bounded polling loop (checking repeatedly for up to several seconds) before concluding it's missing — never a single immediate check.
- **FR-002**: `handleSendPageMessage` MUST NOT force a tab navigation (`chrome.tabs.update`) as its first response to an ambiguous or non-matching `tab.url` — it MUST first poll for the composer on the tab as-is, since Business Suite's SPA routing does not reliably reflect the selected conversation in the URL the extension can read.
- **FR-003**: Navigation (`chrome.tabs.update` to the target `selected_item_id` URL) MUST remain available as a fallback, attempted only when the composer genuinely cannot be found after FR-001's polling window on the current page state.
- **FR-004**: After a navigation fallback, the same bounded polling from FR-001 MUST be used again before failing — not a fixed delay followed by one check (today's behavior, which is what produces the false failure even after a legitimate navigation).
- **FR-005**: The final failure path (composer still not found after polling + navigation + polling again) MUST continue to report through the existing `QUEUED_MESSAGE_RESULT`/`SEND_MESSAGE_RESULT` → `messages.delivery_status = 'failed'` flow from feature 015 — no new failure-reporting mechanism needed.
- **FR-006**: None of this MUST change the personal-messenger send path (`handleSendMessage`) or any other function — scoped entirely to `handleSendPageMessage`'s composer-detection step.

### Key Entities

- **Composer Poll**: a bounded retry loop (interval + timeout) that repeatedly checks for the Business Suite message composer element, replacing today's single immediate check.

## Success Criteria

- **SC-001**: Sending a reply to the "Mang Bảo Khánh" Page test thread from the CRM UI succeeds while the operator is already viewing that conversation, with zero unnecessary tab reloads observed.
- **SC-002**: Sending a reply to a Page thread whose tab was just created (cold start) succeeds once the SPA finishes rendering, within the polling window, without manual intervention.
- **SC-003**: A Page thread that's genuinely unreachable (e.g. tab closed mid-flight, Page disconnected) still resolves to a visible `failed` status within a bounded time, not an indefinite `pending` hang.

## Assumptions

- The composer element itself (`[contenteditable="true"][role="textbox"]`, confirmed live via DevTools to resolve to exactly 1 match once the page has settled) is still the correct target selector — this feature changes *when and how many times* it's checked, not *what* is checked.
- Business Suite does not need a hard page reload for most sends — most of the time the existing tab, given a moment to settle, already has the right composer available. Reload remains a fallback, not the default path.
