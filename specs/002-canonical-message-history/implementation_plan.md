# Implementation Plan: Canonical Message History

This file is the execution handoff for T033–T043. Runtime code changes remain task-scoped and must be validated before marking each task complete.

## Execution order

1. Confirm T033–T035 with syntax checks and real SQLite integration tests.
2. Implement Vietnamese timestamp parsing and accessibility-label filtering (T036–T037).
3. Run T043 one time against a backup copy; preserve valid content and report affected rows.
4. Implement deterministic IDs and canonical deduplication (T038–T039).
5. Enforce chronological ordering and one timestamp source through repository/server/UI (T040–T042).
6. Run the two-user reload scenarios and all SpecKit acceptance criteria.

## Graphify checkpoints

1. Before implementation: inspect extension history extraction → THREAD_MESSAGES_SYNCED → repository persistence → UI rendering.
2. After backend changes: run graphify update . and verify the persistence path has no orphan handler.
3. After client changes: run graphify update . again and verify sorting/date grouping consume timestamp_ms.
4. Record the Graphify command result in the implementation handoff before closing T042/T043.

## Quality gates

- No new database column; messages.timestamp_ms is the canonical timestamp.
- Existing rows are never deleted automatically except polluted accessibility-label text explicitly identified by T043.
- Five repeated syncs produce zero new rows.
- A Friday-labelled message renders under Friday, not Today.
- CRM order matches Messenger order for the two test conversations.
