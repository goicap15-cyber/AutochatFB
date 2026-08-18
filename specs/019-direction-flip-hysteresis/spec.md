# Feature Specification: Direction Flip Hysteresis

**Feature Branch**: `019-direction-flip-hysteresis`
**Created**: 2026-08-08
**Status**: Draft

**Input**: Live testing (restart of `npm start` while a Page thread's messages get re-scanned via `SYNC_THREADS`/backlog replay) showed two already-correctly-stored messages (`is_outgoing = 1`, confirmed by an earlier successful send/capture) get **flipped to `is_outgoing = 0`** by `ConversationRepository.reconcileExistingMessage()`, logged as `🔁 Sửa lại is_outgoing cho fb_message_id ...: 1 -> 0`. Root cause: `page_content.js`'s direction detection (`isMessageOutgoing`, geometry-based — compares a bubble's bounding-box position against a self-computed horizontal midpoint recalculated fresh every scan tick) can produce a noisy/wrong single reading right after a page reload, before layout has fully settled (e.g. only a partial/skewed subset of messages mounted at the exact scan tick). `reconcileExistingMessage`'s `shouldUpdateDirection` check has no protection against this — it commits a direction change on a single disagreeing reading, with no confirmation step, silently corrupting previously-correct data.

## User Stories

### US1 — A single noisy direction reading never overwrites a stored value (P1)

Given a message's stored `is_outgoing` disagrees with a *single* freshly-scanned reading, the stored value is NOT changed yet — the disagreement is only remembered as a candidate, not committed.

**Acceptance**: One `reconcileExistingMessage` call with a disagreeing `isOutgoing` reading, for a message whose previous reading (if any) agreed with the stored value or doesn't exist yet, does not change the stored `is_outgoing`.

### US2 — A direction change only commits once confirmed by a second matching disagreement (P1)

Given the *same* disagreeing direction is read again on a subsequent scan (not a different, also-wrong value), the stored `is_outgoing` is updated to match — the original self-correction behavior (feature 011) still works, just requires confirmation.

**Acceptance**: Two consecutive `reconcileExistingMessage` calls with the same disagreeing `isOutgoing` value results in the stored value being updated on the second call.

### US3 — A confirming (agreeing) reading clears any pending disagreement (P2)

Given a message has one pending disagreeing reading tracked, and a later scan reads a value that agrees with the *currently stored* direction, the pending candidate is discarded — the stored value was right, the earlier disagreement was noise.

**Acceptance**: disagree(A) → agree(stored) → disagree(A) again requires a *fresh* second confirmation; it does not flip on the third call by reusing the first disagreement.

## Functional Requirements

- **FR-001**: `reconcileExistingMessage` MUST NOT change `is_outgoing` on the first scan that disagrees with the stored value for a given `fb_message_id` — it must record the proposed value and wait.
- **FR-002**: `reconcileExistingMessage` MUST commit the direction change only when the *same* proposed value is seen again on a subsequent call for the same `fb_message_id` (two matching consecutive disagreements).
- **FR-003**: A call whose reading agrees with the currently-stored `is_outgoing` MUST clear any pending disagreement candidate for that `fb_message_id` (US3).
- **FR-004**: A call whose reading disagrees with the stored value but does NOT match a previously-pending *different* proposed value MUST reset the candidate to the new value (start a fresh confirmation window), not silently ignore it.
- **FR-005**: The hysteresis tracking state MUST reset on server restart (in-memory is acceptable and actually desirable) — this is what protects against exactly the reported scenario: a single bad reading right after a fresh page/server reload no longer has "memory" of prior (correct) confirmations to immediately contradict.
- **FR-006**: Timestamp-upgrade reconciliation (`shouldUpdateTimestamp`) is unaffected — this feature only changes the direction-flip path.
- **FR-007**: Existing tests for `reconcileExistingMessage`'s single-call self-correction behavior (feature 011/012) must be updated to reflect the new two-call requirement; a reset hook must be exposed for test isolation between cases.

### Key Entities

- **Direction Flip Candidate**: an in-memory record (`fb_message_id -> proposedIsOutgoing`) of a single unconfirmed disagreement, cleared on confirmation (flip happens) or on an agreeing reading (candidate discarded).

## Success Criteria

- **SC-001**: Re-running the exact reported scenario (restart, backlog rescan of already-correct messages) with a single noisy reading no longer corrupts stored `is_outgoing`.
- **SC-002**: A genuinely wrong direction (confirmed by 2 consecutive scans) still self-corrects, preserving feature 011's original intent.
- **SC-003**: `npm run test:persistence` passes with updated/added tests covering US1-US3.

## Assumptions

- Two consecutive matching disagreements is a reasonable confirmation bar given the 1s scan cadence (2s worst case to confirm) — not tunable via config for this feature, hardcoded like `MAX_PENDING_TICKS` in feature 017.
- The candidate-tracking map grows by one entry per never-confirmed, never-reagreed disagreement and is never explicitly size-bounded in this feature — accepted low-risk growth (bounded by distinct `fb_message_id` count actually scanned, cleared on confirm/agree in the common case), consistent with how similar in-memory maps (e.g. `domReplaySuppressUntil` in `server.js`) are handled elsewhere in this codebase.
