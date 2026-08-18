# Feature Specification: Dedicated Background Tab Per Role

**Feature Branch**: `013-dedicated-tab-per-role`
**Created**: 2026-08-07
**Status**: Draft

**Input**: The extension serves two independent flows from the same Chrome install: personal-messenger sync (`content.js`, tabs on `facebook.com`/`messenger.com`) and Page-inbox capture (`page_content.js`, tabs on `business.facebook.com`). `background.js`'s `getFacebookTab(accountId)` — used to find "the personal messenger tab" — queries `*://*.facebook.com/*`, which also matches `business.facebook.com`, and then picks a tab by matching the logged-in `c_user` cookie only, with no URL-based exclusion. Because the personal account and its managed Pages share the same Facebook login, a Business Suite tab the user is actively working in gets misidentified as "the personal tab" whenever no dedicated personal tab exists yet. `ensureFacebookMessagesTab()` then force-navigates that tab to `facebook.com/messages`, kicking the user out of the Page inbox they were using — observed as constant, disruptive reloads. This is worsened by the extension's Manifest V3 service worker being suspended/restarted frequently (visible as repeated `REGISTER_ACCOUNT`/`SYNC_THREADS` churn in the backend logs), which re-triggers the misdetection on every restart.

## User Stories

### US1 — A Page inbox tab is never hijacked by personal-messenger sync (P1)

Given the user has only a Business Suite tab open (no dedicated personal-messenger tab), personal-messenger background sync never navigates that tab away from Business Suite.

**Acceptance**: With a single `business.facebook.com` tab open and personal sync firing repeatedly (simulating the observed reconnect churn), the tab's URL never changes.

### US2 — Personal messenger and Page inbox sync run independently in the background (P1)

Given both a personal-messenger background tab and one or more Page background tabs exist, each keeps syncing on its own without either being redirected, closed, or repurposed by the other's logic — regardless of which tab (if any) the user is actively looking at.

**Acceptance**: With a personal tab and a Page tab both open, triggering sync for one does not change the other's URL or tab identity.

### US3 — Each connected Page gets its own persistent background tab (P2)

Given a Page is connected, the extension creates (once) and thereafter reuses a dedicated background tab for that Page's inbox, the same way `handleSendPageMessage` already does for outbound sends, but also for inbound sync.

**Acceptance**: Repeated sync cycles for the same Page reuse the same tab ID instead of creating a new tab or grabbing an unrelated one.

### US4 — Tab role assignment survives service worker restarts (P2)

Given the Manifest V3 service worker is suspended and restarted (observed to happen often), the extension does not "forget" which tab belongs to which role and re-run the flawed discovery logic that caused US1's bug.

**Acceptance**: After a simulated service worker restart (in-memory state cleared), the extension recovers each role's tab from persistent storage before falling back to any tab query.

## Functional Requirements

- **FR-001**: `getFacebookTab` (personal-messenger tab lookup) MUST NOT match tabs on `business.facebook.com`.
- **FR-002**: The extension MUST maintain a registry mapping each role (`personal:<accountId>`, `page:<pageId>`) to a specific tab ID, checked before any tab-discovery query, instead of re-querying and guessing by cookie/URL on every sync.
- **FR-003**: When a registered tab is closed, the extension MUST evict that registry entry (via `chrome.tabs.onRemoved`) so the next sync creates or discovers a fresh dedicated tab instead of silently failing or grabbing an unrelated one.
- **FR-004**: The registry MUST persist across service worker restarts (e.g. via `chrome.storage.session`), so a restart does not force re-running the flawed discovery path.
- **FR-005**: Inbound Page sync MUST reuse the same dedicated-tab-per-Page pattern already used by the outbound send path (`getBusinessSuiteTab`/`asset_id` matching), rather than relying on `getFacebookTab`'s broad, cookie-based matching.
- **FR-006**: No tab-role logic introduced here MUST force-navigate a tab away from its current page once that tab is registered to a role matching its current context (a Business Suite tab registered to a Page must never be redirected to personal messenger, and vice versa).

### Key Entities

- **Tab Role Registry**: a persisted mapping of role identifier (`personal:<accountId>` or `page:<pageId>`) to a Chrome tab ID, used to find or create the correct dedicated background tab without re-discovering it by guesswork each time.

## Success Criteria

- **SC-001**: With only a Business Suite tab open, 20 consecutive simulated personal-sync cycles produce zero navigation events on that tab.
- **SC-002**: A personal tab and a Page tab open simultaneously both continue receiving/sending messages correctly after 10 minutes of normal use, with neither tab's URL changing unexpectedly.
- **SC-003**: Closing a registered tab and triggering the next sync for that role creates exactly one new tab, not zero and not more than one.
- **SC-004**: Clearing in-memory extension state (simulating a service worker restart) and triggering sync recovers the correct tab from storage without re-triggering US1's bug.

## Assumptions

- Business Suite pages always live under `business.facebook.com`; personal Messenger always lives under `www.facebook.com` or `*.messenger.com` — distinguishable by hostname alone, no further DOM inspection needed for this fix.
- The user may have zero, one, or several Facebook-related tabs open at any time; the fix must not assume exactly one exists.
- Reducing Manifest V3 service worker suspension frequency (e.g. via a `chrome.alarms` heartbeat) is a helpful mitigation but not required for correctness once FR-001–FR-004 are in place — the registry must be correct even if restarts remain frequent.
