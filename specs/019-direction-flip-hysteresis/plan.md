# Implementation Plan: Direction Flip Hysteresis

## Architecture

Entirely contained within `src/server/repositories/ConversationRepository.js`'s `reconcileExistingMessage()`. No change to `server.js`'s call site (same arguments, same return shape), no change to `page_content.js`/direction-detection itself (the noisy geometry reading isn't being made more accurate — the *reaction* to it is being made less trigger-happy), no schema change (in-memory tracking, per spec Assumptions).

## Phases

1. **Add a module-level tracking map**: `const directionFlipCandidates = new Map();` (`fb_message_id -> proposedIsOutgoing` as `0`/`1`) alongside the existing `ranks` constant in `ConversationRepository.js`.

2. **Replace `shouldUpdateDirection`'s computation** in `reconcileExistingMessage`:
   ```js
   let shouldUpdateDirection = false;
   if (source === 'page_dom_observer' && Number(!!existingMsg.is_outgoing) !== Number(!!isOutgoing)) {
     const proposed = isOutgoing ? 1 : 0;
     if (directionFlipCandidates.get(stableMessageId) === proposed) {
       shouldUpdateDirection = true;
       directionFlipCandidates.delete(stableMessageId); // confirmed - commit and clear
     } else {
       directionFlipCandidates.set(stableMessageId, proposed); // first disagreement (or a different one) - wait for confirmation
     }
   } else {
     directionFlipCandidates.delete(stableMessageId); // reading agrees with stored value - any pending disagreement was noise
   }
   ```
   This directly implements FR-001 through FR-004: first disagreement records+waits, matching second disagreement commits, a differing third value resets the wait, an agreeing reading clears the candidate.

3. **Existing UPDATE statement unchanged** — it already gates on the `shouldUpdateDirection` boolean via the `CASE WHEN` pattern; no SQL changes needed, just how the boolean gets computed.

4. **Test isolation hook**: export `static _resetDirectionFlipTracking()` (clears the map) for use in `beforeEach`/between test cases in `tests/integration/pageMessageDedup.test.js` — without this, tests that call `reconcileExistingMessage` for the same `fb_message_id` across multiple `it()` blocks would leak state between them.

5. **Update existing tests**: the current single-call self-correction test ("existing message self-corrects is_outgoing on re-scan without duplicating") must become a two-call sequence (first call records candidate + no change, second call with the same disagreement commits the change) to reflect FR-001/FR-002. Add new tests for FR-003 (agreeing reading clears candidate) and FR-004 (a different second disagreement resets rather than reuses the first).

## Safety Gates

- Do not touch `page_content.js`'s geometry detection itself — this feature is entirely about the backend's reaction to it, not about making the reading itself more accurate (that's a separate, harder problem not in scope here).
- Do not persist the candidate map to the DB — in-memory-only is intentional (FR-005): a restart should NOT carry over a "1 disagreement already logged" state from before the restart, since the restart itself is what triggers the noisy first reading in the reported scenario.
- Timestamp reconciliation logic (`shouldUpdateTimestamp`) must remain completely unchanged — only touch the direction branch.
- Keep the map's key exactly `stableMessageId` (== `fb_message_id` in practice, since `reconcileExistingMessage` is only ever called with a real `fb_message_id` already resolved) — do not introduce a second identity scheme.
