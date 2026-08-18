# Feature Specification: Outbound Temp-ID Upgrade Dedup

**Feature Branch**: `020-outbound-temp-id-upgrade`
**Created**: 2026-08-08
**Status**: Draft

**Input**: Sending "lo a" from the CRM to the "Mang Bảo Khánh" Page thread produced two DB rows for the same real message, confirmed via direct query:

```
id 4027 | fb_message_id: 7491704639551390961              | is_outgoing:1 | sent | ts:1786161560524
id 4028 | fb_message_id: mid.$cAAQXQILUZ2SmEMwBymf34a1Km0Tx | is_outgoing:1 | sent | ts:1786161560524
```

Same content, same `timestamp_ms`, two different `fb_message_id` values. Root cause, traced from `server.js`'s `NEW_MESSAGE_RECEIVED` handler and live logs: for a self-sent (outgoing) message, `page_dom_observer` sees Facebook assign the message a **temporary, non-`mid.$` numeric `fb_message_id`** first (e.g. `7491704639551390961`), then later a **second scan sees the permanent `mid.$...` id** once Facebook's server has fully confirmed it. The existing pending→DOM correlation (`server.js:377-401`) only bridges the *first* id-arrival to the CRM's pending row (matched via `delivery_status = 'pending'`) — once that correlation runs, the row's status flips to `'sent'`, consuming the only pending match. The *second* id-arrival (the real `mid.$...` id) finds no pending row left to correlate with (already consumed) and no existing row with that exact id (it's new), so it falls through to a plain `INSERT`, creating a second row for what is really the same send.

This is the outbound-path counterpart to feature 017 (which handles a null→real id transition on the *inbound/capture* side, in `page_content.js`) — same family of bug (an id transition defeating identity-based dedup), different transition (temp-numeric→`mid.$`) and different code location (`server.js`'s pending-correlation logic, not the content script).

## User Stories

### US1 — An outgoing message's id-upgrade never creates a duplicate row (P1)

Given an outgoing message was already correlated to a pending CRM send and marked `sent` with a temporary id, and a later DOM scan reports the same message under its permanent `mid.$...` id, the existing row's `fb_message_id` is upgraded in place — no second row is created.

**Acceptance**: Simulating the exact sequence (pending row created → temp-id DOM capture correlates it to `sent` → permanent-id DOM capture arrives) results in exactly one row in `messages` for that send, with `fb_message_id` equal to the permanent id.

### US2 — Genuinely repeated identical outgoing content within the match window is a known, accepted limitation (P2)

Given the operator sends the exact same text twice in quick succession (a real, deliberate repeat), the id-upgrade match could theoretically merge the second send's temp-id capture into the first send's row instead of creating its own. This is a narrow, pre-existing-in-spirit trade-off (mirrors the already-documented `KNOWN LIMITATION` for inbound no-id dedup in `pageMessageDedup.test.js`) — not silently fixed or worsened by this feature, and must be pinned by a test so it's visible rather than accidentally regressed further.

## Functional Requirements

- **FR-001**: When an outgoing (`is_outgoing`) DOM-observer message arrives with a `fb_message_id` that doesn't match any existing row, AND the pending-correlation lookup (`delivery_status = 'pending'`) finds nothing, the handler MUST check for a recently-`sent` row in the same thread with identical `content`, `is_outgoing = 1`, a different (non-null) `fb_message_id`, within a short time window (FR-002) — and if found, UPDATE that row's `fb_message_id` to the new value instead of inserting a new row.
- **FR-002**: The time window MUST be short enough to avoid merging two genuinely distinct sends of identical content (US2) while comfortably covering the observed temp→permanent id upgrade lag (observed: ~1-3 seconds) — 8 seconds, matching the existing `recentPendings` mismatch-guard's use of a comparable short window (10s) elsewhere in the same handler.
- **FR-003**: The upgrade MUST NOT re-emit a new `NEW_MESSAGE`/`MESSAGE_SENT` socket event — the row and its CRM-visible bubble already exist and are already correct; only its `fb_message_id` identity changes, silently, so no user-visible flicker.
- **FR-004**: This check only applies within the existing `isOutgoing && (source === 'dom_observer' || source === 'page_dom_observer') && m.content` block (`server.js:365`) — no change to inbound (customer) message handling, no change to `page_content.js`.
- **FR-005**: No change to the existing pending-correlation (`server.js:377-401`) or mismatch-guard (`server.js:403-430`) logic — this is an additional check, tried after the pending-match fails and before falling through to a plain insert.

### Key Entities

- **Temp-ID Upgrade Match**: a `messages` row with `delivery_status = 'sent'`, `is_outgoing = 1`, matching thread+content, a different non-null `fb_message_id`, created within the match window — treated as "the same send, id not yet finalized" rather than a new message.

## Success Criteria

- **SC-001**: Re-sending a message from the CRM to a Page thread results in exactly one `messages` row, even when Facebook's DOM shows two different ids for it in sequence.
- **SC-002**: `npm run test:persistence` passes, including a new regression test for FR-001 and a pinning test for the US2 known limitation.

## Assumptions

- The temp numeric id (`7491704639551390961`-style, no `mid.$` prefix) is specific to how Business Suite renders a just-sent message before full server confirmation — this feature does not attempt to detect or validate that shape, it only uses "different id, same thread+content+outgoing+sent+recent" as the signal, which is agnostic to the id's format.
- 8 seconds is a judgment call, not measured against a large sample — if real-world id-upgrade lag turns out to exceed this occasionally, the fix degrades to today's behavior (a duplicate row) rather than something worse; this can be revisited if it proves too short in practice.
