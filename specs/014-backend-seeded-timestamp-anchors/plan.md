# Implementation Plan: Backend-Seeded Timestamp Anchors

## Architecture

Add a request/response round trip on top of the existing push-only pipeline (`page_content.js` → `background.js` → backend). The content script asks the background script for a thread's already-known timestamps; the background script fetches them over HTTP (it already has network access and the required `host_permissions`) and relays the result back via the standard `chrome.runtime.sendMessage`/`sendResponse` pattern. No change to the existing WebSocket push path for new messages.

## Phases

1. **Backend: lightweight timestamp-snapshot endpoint**: add `GET /api/threads/:id/message-timestamps` returning `[{ fb_message_id, timestamp_ms }, ...]` for the thread — a thin projection of the existing `messages` table, mirroring the query style already used by `GET /api/threads/:id/messages` but without content/media fields.

2. **background.js: relay handler**: add a `chrome.runtime.onMessage` case (e.g. `GET_THREAD_TIMESTAMPS`) that `fetch()`s the new endpoint and responds asynchronously (`sendResponse` + `return true`), with a bounded timeout so a slow/unreachable backend can't hang the caller.

3. **page_content.js: seed on thread open**: when a thread switch is detected (the same transition `isLikelyBacklog` already uses to reset per-thread state), request the snapshot from `background.js`, and merge each `(fb_message_id, timestamp_ms)` into `knownMessageTimestamps` — only for ids not already present in-session (satisfies FR-004: never let a stale backend value clobber something this session already anchored more precisely). Do not block `scanForMessages`'s 1-second cadence on this request; let it complete asynchronously and simply improve subsequent ticks once it resolves.

4. **content.js audit**: read `content.js`'s message-timestamp assignment path end to end. If it has an equivalent in-memory-only anchor/interpolation mechanism, apply the same seeding pattern (reusing the Phase 1 endpoint and Phase 2 relay, parameterized by thread). If its mechanism is different (e.g. already sourced from real Facebook message timestamps in the DOM/GraphQL payload) and not subject to this failure mode, document that finding instead of changing it speculatively.

5. **Validation**: unit-testable pieces — the new endpoint (via an HTTP request in a Node test) and the merge logic (`knownMessageTimestamps` seeding, factored so it's testable without a live `chrome.*` environment). Manual test: simulate a cold script restart on a thread with existing multi-day history and confirm no new "today" mis-datings.

## Safety Gates

- The new endpoint must not expose message content or media — only `fb_message_id` and `timestamp_ms`, since it's a lightweight sync-hint channel, not a message-reading API.
- Seeding must never overwrite an already-in-session anchor with a stale/older-ranked backend value (FR-004) — protects against a slow response arriving after the session has already anchored something better.
- A failed or slow seeding request must never block or delay message capture (FR-003) — capture correctness (not losing messages) takes priority over date correctness.
- No change to the WebSocket push path, dedup logic, or direction detection from features 010-013.
