# Feature Specification: Backend-Seeded Timestamp Anchors

**Feature Branch**: `014-backend-seeded-timestamp-anchors`
**Created**: 2026-08-07
**Status**: Draft

**Input**: `page_content.js`'s `dom_order` timestamp strategy (feature 010) derives a message's synthetic timestamp by interpolating between neighboring messages already anchored in `knownMessageTimestamps` — a `Map` that lives only in the content script's in-memory JS context. That context resets on every content-script restart (tab reload, navigation, browser restart, sleep/wake, or an extension/service-worker restart triggering a tab reload). When the script restarts and then discovers a message that is genuinely new to the backend (e.g. surfaced for the first time by the scroll-back feature) with no surviving anchor to interpolate against, it falls back to "close to now" — stamping a message from a prior day as if it arrived today. This was observed in production: messages from a previous day's test session appeared under "Hôm nay" (Today) with today's time, both on the Page-inbox path and, per the user's report, in some form on the personal-messenger path as well. Rows are not duplicated (backend dedup is by the real, never-reused Facebook `fb_message_id`), but the timestamp — and therefore display order and date grouping — is wrong for anything captured while the anchor map is empty.

## User Stories

### US1 — Newly-discovered old messages keep their real relative position after a script restart (P1)

Given the content script restarts (tab reload, browser restart, service worker restart) and then scans a thread that already has messages recorded in the backend, any message the script hasn't personally anchored yet is still placed in correct chronological order relative to the backend's existing record for that thread, not stamped with "now".

**Acceptance**: Simulate an empty in-memory anchor map (fresh script context) scanning a thread whose backend already has 5 messages spanning 2 days; a 6th, genuinely-new-to-backend message discovered in that scan is placed relative to the existing 5, not dated "today" regardless of when it's actually being scanned.

### US2 — The fix survives everything a purely local cache can't (P2)

Given the extension is reinstalled, browser data is cleared, or the user switches machines, the same thread's next scan still anchors correctly, because the source of truth is the backend's persisted database, not any client-side cache.

**Acceptance**: Clearing all local/session storage the extension might have used does not reintroduce US1's bug, because anchoring is seeded from a backend request each time a thread is (re)opened, not from local persistence alone.

### US3 — Personal-messenger path gets the same fix if it shares the same weakness (P2)

Given the user reported both the Page-inbox and personal-messenger paths exhibit the "today" mis-dating symptom, `content.js`'s equivalent timestamp mechanism is audited and, if it has the same in-memory-only weakness, receives the same backend-seeding fix.

**Acceptance**: `content.js` is read and its timestamp-assignment mechanism documented; if it matches the same failure mode as `page_content.js`, it's fixed the same way in this feature; if its mechanism is unrelated (e.g. it already reads real Facebook timestamps), that's documented instead of assumed.

## Functional Requirements

- **FR-001**: Backend MUST expose a lightweight way for the extension to fetch already-recorded `(fb_message_id, timestamp_ms)` pairs for a given thread, without requiring the full message payload (content, media, etc.) for this specific purpose.
- **FR-002**: `page_content.js` MUST request this data when it starts observing a thread (thread switch or script init) and seed `knownMessageTimestamps` from the response before running `assignOrderedTimestamps` for that thread.
- **FR-003**: If the backend request fails or times out, the extension MUST fall back to its current in-memory-only behavior rather than blocking message capture — this is a correctness improvement, not a new hard dependency for basic operation.
- **FR-004**: Seeding MUST NOT overwrite a timestamp the content script already anchored more recently in the same session with a stale backend value for the same `fb_message_id` (the backend is the seed for gaps, not a forced override of live-session data).
- **FR-005**: `content.js`'s timestamp mechanism MUST be audited for the same failure mode as part of this feature; if confirmed, it MUST receive an equivalent seeding fix; if not applicable, the audit finding MUST be documented rather than silently skipped.

### Key Entities

- **Thread Timestamp Snapshot**: the set of `(fb_message_id, timestamp_ms)` pairs already recorded for a thread, fetched once per thread-open to seed the content script's anchor map.

## Success Criteria

- **SC-001**: Simulating a cold content-script restart against a thread with existing backend history produces zero "today" mis-datings for older, newly-discovered messages in that thread.
- **SC-002**: The seeding request completes or times out within a bounded time (target: under 2 seconds) and never blocks the 1-second scan loop from proceeding.
- **SC-003**: `content.js` audit finding (fixed the same way, or documented as not applicable) is recorded in this feature's research notes.

## Assumptions

- The backend's `messages` table remains the authoritative source of truth for a thread's real recorded timestamps; nothing in this feature changes what gets written there, only what seeds the client-side interpolation before new writes happen.
- A per-thread timestamp snapshot is small enough (tens to low hundreds of rows for a typical conversation) to fetch synchronously on thread-open without meaningful UI/UX delay.
