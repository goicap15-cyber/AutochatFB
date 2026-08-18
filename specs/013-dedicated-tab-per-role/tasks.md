# Tasks: Dedicated Background Tab Per Role

## Phase 1 — Immediate containment (land first, independent of the rest)

- [x] T001 In `src/extension/background.js`, narrow `getFacebookTab`'s effective matching so it cannot match `business.facebook.com` — implemented as a post-query `isBusinessSuiteUrl()` filter (hostname check) rather than a narrower query pattern, so legitimate personal-messenger subdomains besides `www` are still considered.

## Phase 2 — Tab role registry

- [x] T002 Add an in-memory `Map` in `src/extension/background.js` keyed by role (`personal:<accountId>`, `page:<pageId>`) storing tab IDs.
- [x] T003 Mirror registry writes to `chrome.storage.session` and hydrate the in-memory map from it on script startup, before any tab lookup runs.

## Phase 3 — Registry-aware lookups

- [x] T004 Update `getFacebookTab` to check the registry first (verify via `chrome.tabs.get` that the tab still exists) before falling back to its current query/cookie-matching logic.
- [x] T005 Update `getBusinessSuiteTab` the same way, keyed by `page:<pageId>`.
- [x] T006 When either function's fallback discovery succeeds, write the result into the registry so the next call skips the query. Also register tabs at creation time in `ensureFacebookMessagesTab` and `handleSendPageMessage`, not only on query-discovery.

## Phase 4 — Tab close eviction

- [x] T007 Add a `chrome.tabs.onRemoved` listener in `src/extension/background.js` that finds and deletes any registry entry pointing at the closed tab ID, in both the in-memory map and `chrome.storage.session`.

## Phase 5 — Inbound Page sync alignment

- [x] T008 Audited `handleSync100Threads` and `handleSyncThreadMessages`: both only ever call `ensureFacebookMessagesTab`/`getFacebookTab` for the personal-messenger sidebar/history scrape, never for Page threads. No additional call sites needed repointing — the Phase 3 fix to `getFacebookTab` itself already covers both transparently.

## Phase 6 — Stretch: service worker keep-alive (P3, optional)

- [ ] T009 Add a `chrome.alarms` periodic heartbeat in `src/extension/background.js` to reduce service worker suspension frequency and the resulting WebSocket reconnect churn. **Not done this pass** — requires adding the `alarms` permission to `manifest.json`; deferred since Phases 1-5 already make the bug impossible regardless of restart frequency.

## Phase 7 — Validation

- [ ] T010 Manual test: only a Business Suite tab open, trigger repeated personal-sync cycles, confirm the tab's URL never changes. **(requires live browser test — not run by this pass)**
- [ ] T011 Manual test: a personal tab and a Page tab open simultaneously, trigger both sync paths, confirm neither tab is redirected by the other. **(requires live browser test — not run by this pass)**
- [ ] T012 Manual test: close a registered tab, trigger the next sync for that role, confirm exactly one fresh tab is created. **(requires live browser test — not run by this pass)**
- [ ] T013 Manual test: clear in-memory registry state (simulating a service worker restart) and confirm it recovers from `chrome.storage.session` before falling back to a query. **(requires live browser test — not run by this pass)**
- [x] T014 Run `graphify update .`.

## Dependencies

- Phase 1 has no dependencies and can land immediately as a standalone fix.
- Phase 2 blocks Phases 3 and 4.
- Phase 5 depends on Phase 3.
- Phase 6 is independent and optional; does not block Phase 7's core validation (T010-T013), only informs how often the scenarios in T010/T011 naturally recur.
- Phase 7 runs last.
