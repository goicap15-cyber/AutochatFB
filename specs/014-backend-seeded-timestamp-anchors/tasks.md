# Tasks: Backend-Seeded Timestamp Anchors

## Phase 1 — Backend endpoint

- [x] T001 Add `GET /api/threads/:id/message-timestamps` in `src/server/server.js`, returning `[{ fb_message_id, timestamp_ms }, ...]` for the thread, ordered the same way as `GET /api/threads/:id/messages`. Backed by new `ConversationRepository.getMessageTimestamps`.
- [x] T002 Add a regression test for T001's query logic (tested at the `ConversationRepository`/DB level, mirroring how `getMessages` is already tested) — also verifies synthetic `fingerprint()` ids (`history_...`) are excluded, since they never match a real DOM `data-message-id`.

## Phase 2 — background.js relay

- [x] T003 Add a `GET_THREAD_TIMESTAMPS` case to `chrome.runtime.onMessage` in `src/extension/background.js` that fetches the Phase 1 endpoint and responds via `sendResponse` (async, `return true`).
- [x] T004 Add a bounded timeout (2s, `AbortController`) around the fetch so an unreachable backend resolves with an empty result instead of hanging the caller.

## Phase 3 — page_content.js seeding

- [x] T005 On thread switch (detected the same way `isLikelyBacklog` already does, checked before it mutates state), request `GET_THREAD_TIMESTAMPS` for the new thread from `background.js`.
- [x] T006 Merge the response into `knownMessageTimestamps`, only for `fb_message_id`s not already present in the map (FR-004).
- [x] T007 The request is fire-and-forget (never awaited by `scanForMessages`) — the 1-second cadence is never blocked; a slow/failed response simply arrives too late to help the tick(s) already in flight.

## Phase 4 — content.js audit

- [x] T008 Read `content.js`'s timestamp-assignment path end to end; documented in `specs/014-backend-seeded-timestamp-anchors/research.md`. Finding: it has no anchor map at all — it reads real timestamps from intercepted network payloads (`facebook_payload`) or a real Facebook-rendered DOM time label (`facebook_label`, with its own day-rollback), unlike Business Suite which exposes neither.
- [x] T009 Not applicable — no equivalent failure mode exists to fix (documented in research.md, no code change to `content.js`).

## Phase 5 — Validation

- [x] T010 Ran the new regression test plus the full existing suite (`npm run test:persistence`) — 17/17 pass.
- [ ] T011 Manual test: simulate a cold script restart (reload the tab) on a Page thread with existing multi-day backend history; confirm no newly-discovered older message gets stamped with today's date. **(requires live browser test — not run by this pass)**
- [x] T012 Run `graphify update .`.

## Dependencies

- Phase 1 blocks Phase 2; Phase 2 blocks Phase 3.
- Phase 4 (audit) can run independently of Phases 1-3, but T009's fix (if needed) depends on Phases 1-3 existing to reuse.
- Phase 5 runs last.
