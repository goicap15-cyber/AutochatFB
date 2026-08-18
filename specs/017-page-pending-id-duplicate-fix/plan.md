# Implementation Plan: Page Pending-ID Duplicate Fix

## Architecture

Entirely contained within `src/extension/page_content.js` — `scanForMessages()` and `processPotentialMessage()`. No change to `background.js`, `server.js`, or any DB/repository code.

## Phases

1. **Tick counter**: add a module-level `let currentTick = 0;` incremented once at the top of every `scanForMessages()` call (`page_content.js:289`), so ticks are countable without touching `Date.now()` (avoids any interaction with the existing timestamp-anchor logic).

2. **Pending-bubble tracking**: add `let pendingNoIdBubbles = new WeakMap();` (element → `{ firstSeenTick }`). `WeakMap` means a bubble that scrolls out of the virtualized list and gets garbage-collected is cleaned up for free — no manual eviction needed.

3. **Extract the bubble-ancestor walk**: `processPotentialMessage()` already walks up from `element` looking for a `dir="auto"` ancestor as part of its "ROBUST DOM STRUCTURAL FILTERING" block (`page_content.js:386-412`, sets `isInsideMessageBubble`). Pull the *element itself* out of that walk (not just the boolean) into a small helper, e.g. `findBubbleAncestor(element)` returning the `dir="auto"` node or `null`. Call it once near the top of `processPotentialMessage()`, before the identity/dedup section, and reuse its result both for the new pending-check (step 4) and the existing filtering block (which currently redoes the same walk) — no duplicate walk, no behavior change to filtering.

4. **Defer-or-forward decision**, inserted right after `fbMessageId` is computed (`page_content.js:340-350`), before the existing dedup-hash/forward logic:
   - If `fbMessageId` is present: if the bubble ancestor is in `pendingNoIdBubbles`, delete it (resolved — the ID showed up). Proceed exactly as today.
   - If `fbMessageId` is `null`:
     - No bubble ancestor found at all (shouldn't normally happen for a real message, but keep the existing fallback behavior for safety) → proceed exactly as today (forward with null ID), unchanged.
     - Bubble ancestor found, not yet in `pendingNoIdBubbles` → record `{ firstSeenTick: currentTick }`, **return without forwarding** (FR-001).
     - Bubble ancestor found, already pending, `currentTick - firstSeenTick < MAX_PENDING_TICKS` (2) → **return without forwarding** (still waiting).
     - Bubble ancestor found, already pending, wait expired → delete from `pendingNoIdBubbles`, proceed exactly as today (forward with null ID — FR-002's fallback).

5. **No other changes**: dedup hash (`processedHashes`), timestamp assignment, direction detection, contact/avatar extraction, and the `NEW_PAGE_MESSAGE_FROM_DOM` payload shape are all untouched (FR-005/FR-006).

6. **Validation**: `page_content.js` runs in a browser DOM context and isn't part of the `node --test` suite (confirmed: no existing test references it; feature 014's `assignOrderedTimestamps` was validated the same way). Validate this fix with a small standalone Node simulation script (mirroring feature 014's approach) that fakes two `processPotentialMessage`-equivalent calls — tick 1 with `fbMessageId = null`, tick 2 with a real ID on the same fake element — and asserts exactly one forward call happens with the real ID, plus a second scenario asserting the bounded-wait fallback still forwards an ID-less message after `MAX_PENDING_TICKS` ticks. Then a live manual test on the actual Page thread.

## Safety Gates

- Do not change `server.js`, `background.js`, or `content.js` (personal-messenger path).
- The bounded wait (`MAX_PENDING_TICKS`) must stay small and fixed — no unbounded retry, no change to the 1s scan cadence.
- Must not regress US2: an ID-less message must still eventually be forwarded, never silently dropped.
- Reuse the existing `dir="auto"` ancestor walk rather than adding a second, separate DOM walk for the same purpose.
