# Implementation Plan: Dedicated Background Tab Per Role

## Architecture

All changes are confined to `src/extension/background.js`. Introduce a small persisted tab-role registry and make existing tab-lookup functions (`getFacebookTab`, `getBusinessSuiteTab`, `ensureFacebookMessagesTab`) consult it before falling back to their current query/guess behavior. No changes to `content.js`, `page_content.js`, or the backend.

## Phases

1. **Immediate containment — narrow `getFacebookTab`'s query**: change its `chrome.tabs.query` pattern from `*://*.facebook.com/*` to something that cannot match `business.facebook.com` (e.g. `*://www.facebook.com/*` plus the existing `*://*.messenger.com/*`). This alone stops the direct hijack and can land first, independent of the registry work.

2. **Tab role registry**: add an in-memory `Map` (`role -> tabId`) plus a mirrored copy in `chrome.storage.session` (survives service worker restarts within the browser session). Roles: `personal:<accountId>` and `page:<pageId>`. On every background script startup, hydrate the in-memory map from `chrome.storage.session` before any tab lookup runs (addresses FR-004/US4).

3. **Registry-aware lookups**: update `getFacebookTab` and `getBusinessSuiteTab` to check the registry first (verify the tab still exists via `chrome.tabs.get`, treat a missing tab as an eviction) before falling back to their current query logic. When a fallback discovery succeeds, write the result back into the registry so subsequent calls skip the query entirely.

4. **Tab close eviction**: register a `chrome.tabs.onRemoved` listener that scans the registry for the closed tab ID and deletes that entry (both in-memory and in `chrome.storage.session`), satisfying FR-003.

5. **Inbound Page sync uses the same dedicated-tab pattern as outbound send**: wherever inbound Page sync currently has no equivalent of `getBusinessSuiteTab` (if any code path still relies on `getFacebookTab` for Page-related sync), point it at the registry-aware `getBusinessSuiteTab` instead.

6. **(Stretch, P3) Service worker keep-alive**: add a `chrome.alarms` periodic heartbeat to reduce how often the service worker suspends and the WebSocket reconnects, lowering how often tab-role logic even runs. This is a mitigation on top of 1-5, not a substitute for them.

7. **Validation**: manual test matrix — (a) only a Business Suite tab open, trigger repeated personal sync, confirm no navigation; (b) both a personal tab and a Page tab open, trigger both sync paths, confirm neither tab is touched by the other; (c) close a registered tab, trigger sync, confirm exactly one fresh tab is created; (d) clear in-memory state to simulate a service worker restart, confirm the registry recovers from `chrome.storage.session` before any query-based fallback runs.

## Safety Gates

- Never force-navigate a tab that is currently active/focused in its window — if a dedicated tab needs correcting and it happens to be the user's active tab, prefer creating a separate background tab over hijacking the one they're looking at.
- No change to `content.js`'s or `page_content.js`'s passive scanning behavior.
- Outbound send paths (`handleSendMessage`, `handleSendPageMessage`) must keep working exactly as before — the registry augments their existing tab lookups, it does not replace their sending logic.
- No behavior change for accounts/Pages that only ever have one tab of their own kind open (the common case must not regress while fixing the shared-tab edge case).
