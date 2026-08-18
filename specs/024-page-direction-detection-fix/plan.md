# Implementation Plan: Page Direction Detection Fix

**Branch**: 024-page-direction-detection-fix | **Date**: 2026-08-10 | **Spec**: spec.md

## Summary

Replace the fragile Page-message midpoint heuristic with container-relative edge evidence. Business Suite virtualizes the message list, so a first scan may contain only outgoing bubbles. The current midpoint then misclassifies the leftmost outgoing bubbles as incoming.

The final design has two separate concepts:

- is_outgoing remains a required boolean in SQLite for compatibility.
- direction_status is a persisted state: confirmed or pending.

Unknown geometry is retained as a pending message, with a documented storage placeholder for is_outgoing. The UI must use direction_status and never render a pending row as a confirmed incoming message.

## Technical Context

| Item | Decision |
|---|---|
| Runtime | Node.js CommonJS backend, browser JavaScript extension, React 19 UI |
| Dependencies | Express, Socket.IO, WebSocket, better-sqlite3, Chrome Manifest V3 |
| Storage | SQLite messages table with a direction_status migration |
| Tests | npm run test:persistence, node --check, live Business Suite comparison |
| Scope | Page DOM observer, bridge, backend reconciliation, schema migration, and pending UI |
| Constraint | Keep 1-second scan cadence; no per-message network calls; do not change content.js or queue routing |

## Existing Evidence

research.md documents the exact reproduction:

- A full mounted set has a genuine left anchor near 579 and outgoing bubbles near 1037-1100.
- A recent-only mounted set has midpoint 1093.51 and misclassifies what, ok khong, 123456, 31321, dadadadada, and khoai qua as incoming while lo a remains outgoing.
- The remembered-range implementation only helps after a wider two-sided observation. It does not guarantee correctness when the first usable observation is one-sided.
- page_content.js also currently returns false when horizontalMidpoint is null. That fallback is an independent unknown-to-incoming bug.

## Constitution Check

The repository constitution remains a placeholder template. Local gates are:

- Preserve content.js, personal routing, outbound queue, timestamp ordering, and feature 023 containment.
- Do not run a blanket database direction flip.
- Add automated coverage before changing persistence behavior.
- Validate the reproduction thread and at least two other Page threads.
- Take a database backup before any repair operation.

## Implementation Phases

| Phase | Goal | Main work | Gate |
|---|---|---|---|
| 0. Baseline | Freeze the known failure and current data state | Reproduce the one-sided geometry case. Read-only verify the six message ids, current direction_status/is_outgoing values, and the existing manual-repair backup. | Research and data baseline are recorded before implementation. |
| 1. Direction evidence | Classify both sides without relying on another mounted message | Add a pure helper using message-list container and bubble edge distances. Do not use a midpoint fallback when container geometry is unavailable; return unknown instead. Return unknown when geometry is missing or ambiguous. Keep unknown ids eligible for retry. | Six known messages classify outgoing in the narrow-window case; null midpoint no longer means incoming. |
| 2. Pending transport and persistence | Retain uncertain messages without false UI direction | Forward direction_source/confidence. Add direction_status to the schema and startup migration. Persist unknown Page messages as pending with is_outgoing=0 only as a storage placeholder. Promote pending rows on high-confidence evidence; use hysteresis for disagreements with confirmed rows. | No unknown message is lost; no pending row is rendered as confirmed incoming; no duplicate is created. |
| 3. UI and regression tests | Make pending state visible and testable | Update ChatArea rendering to use direction_status. Add geometry tests, pending lifecycle tests, schema migration tests, repeated-scan tests, and personal-path regression checks. | npm run test:persistence passes. |
| 4. Data verification and targeted repair | Avoid confusing historical repair with implementation | Run a read-only report first. Compare the six known ids to Business Suite and the existing backup. Repair only verified differences after taking a new backup. | Six known rows are confirmed outgoing; unrelated rows are unchanged. |
| 5. Live validation | Verify real virtualization and restart behavior | Reload extension, reopen the target thread, test narrow and mixed windows, check pending promotion, compare two other Page threads, run 10+ minutes, and restart once. | SC-001 through SC-005 pass. |

## File Responsibilities

| Area | Responsibility |
|---|---|
| src/extension/page_content.js | Edge classifier, explicit unknown, pending retry/dedup interaction |
| src/extension/background.js | Forward optional direction evidence fields |
| src/server/server.js | Validate evidence, persist pending, preserve existing timestamp/send routing |
| src/server/repositories/ConversationRepository.js | Direction state transitions, high-confidence reconciliation, hysteresis |
| src/server/database/schema.sql | direction_status definition and default |
| src/server/database/db.js | Safe migration for existing databases |
| src/client/components/ChatArea.jsx | Neutral pending rendering; never treat pending as incoming |
| tests/ | Geometry, migration, pending, dedup, and persistence regression coverage |

## Data Repair and Rollback

The previous manual correction and backup are historical evidence. Before any new repair:

1. Read-only query the six known fb_message_id values.
2. Create a new timestamped database backup.
3. Produce a dry-run list of only verified direction differences.
4. Apply targeted updates only after live Business Suite confirmation.

If validation fails, revert extension/backend/schema changes as a unit and restore only the targeted backup.

## Deferred Decisions

Direction source/confidence remain transport-level unless audit requirements justify more columns. direction_status is required for durable pending behavior. The old knownHorizontalRange/center heuristic is no longer part of direction classification and is not used as a fallback; missing geometry remains unknown.
