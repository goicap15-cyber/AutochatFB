# Research: content.js Timestamp Mechanism Audit (Phase 4)

## Finding

`content.js` (personal messenger) does **not** share `page_content.js`'s failure mode. It has no `knownMessageTimestamps`-style in-memory anchor map at all, so there is nothing for a content-script restart to wipe.

Its timestamp sources, in priority order:

1. **Network-payload timestamps** (`content.js:56-72`, `144-166`, `180-201`, `262-298`): intercepts `fetch`/`XMLHttpRequest`/`WebSocket` traffic and reads the real timestamp Facebook's own GraphQL/Mercury response includes (`timestamp_source: 'facebook_payload'`). These are captured live, as each network event happens — there's no "backlog" concept here, so there's no scenario where an old message is discovered cold with no anchor.
2. **DOM time-label parsing** (`content.js:595-621`, the `dom_observer` fallback used when a message isn't caught by network interception): reads `parsed.effective_label` — a real, Facebook-rendered accessible label (e.g. "Tin nhắn do Bạn gửi lúc 15:20") — with regex, including AM/PM handling, and already has the same day-rollback safety net feature 010 later added to `page_content.js` (`if (now.getTime() > Date.now() + 60000) { now.setDate(now.getDate() - 1); }`).
3. Only if neither source yields a value does it fall back to `tsSource: 'realtime_fallback'` / `Date.now()` — a per-message, occasional gap (the label didn't render at scan time), not a systemic one.

## Why this doesn't need feature 014's fix

`page_content.js`'s bug was specific to Business Suite exposing **no** per-message time label at all (confirmed by live DOM inspection in feature 010), forcing a synthetic DOM-position interpolation scheme (`dom_order`) that needs a persistent anchor map to stay correct across restarts. `content.js` never needed that scheme in the first place — `facebook.com/messages` DOES expose a real time label, so it reads real data directly on every message, live or backlog, with no session-scoped memory to lose.

## Residual (separate, out of scope for this feature)

`content.js`'s `realtime_fallback` path (label regex didn't match) is a narrower, per-message risk, not a mass-mislabeling-on-restart risk — it only mis-times the one message whose label wasn't parseable at that instant, not every already-visible message in a thread after a reload. If this turns out to matter in practice, it would need a different fix (more robust label extraction, e.g. hover-title fallback), not backend-seeded anchors — there's no anchor map to seed.

## Conclusion (FR-005 / US3)

No code change applied to `content.js` in this feature. The audit confirms its mechanism is unrelated to the bug feature 014 fixes; per the spec's own instruction ("if not applicable, the audit finding MUST be documented rather than silently skipped"), this file is that documentation.
