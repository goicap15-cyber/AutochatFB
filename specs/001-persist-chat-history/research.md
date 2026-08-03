# Research: Persist Chat History

## Decision 1: SQLite is the display source of truth

**Decision**: CRM startup and reload render stored conversations/messages first. Facebook synchronization only appends or updates data.

**Rationale**: Current behavior confuses a partial sidebar snapshot with durable CRM state. Local-first display remains usable offline and prevents reload loss.

**Alternatives considered**: Re-scrape every startup; cache only in React memory. Both are slower and lose data when Facebook or the extension is unavailable.

## Decision 2: Backfill once, then incremental reconciliation

**Decision**: New conversations receive a resumable initial backfill; later syncs stop after reaching an already known message/checkpoint.

**Rationale**: Avoids repeated full DOM scans while repairing gaps caused by temporary disconnections.

**Alternatives considered**: Re-scrape the entire conversation each time; realtime-only capture. Full scans are slow, while realtime-only capture cannot recover missed history.

## Decision 3: Persist batches, not one final history payload

**Decision**: Persist bounded history batches and update sync state after each batch.

**Rationale**: A Facebook reload currently discards an in-progress scrape. Batch commits retain useful progress and allow idempotent retry.

**Alternatives considered**: One transaction after the full scrape. It is simpler but loses all progress on interruption and creates large WebSocket payloads.

## Decision 4: Stable internal identity with external aliases

**Decision**: Use one CRM conversation ID and map trusted URL, E2EE, thread, participant, and network identifiers through account-scoped aliases.

**Rationale**: `thread_fbid`, `other_user_id`, sidebar URL IDs, and encrypted route IDs are not interchangeable. Mixing them causes the same person to reappear as new.

**Alternatives considered**: Use contact name; use whichever ID arrives first without aliases. Names are not unique, and raw identifiers can drift by source.

## Decision 5: Deterministic, layered message deduplication

**Decision**: Prefer official Facebook message ID, then client message ID, then a deterministic conversation-scoped fingerprint for DOM-only messages.

**Rationale**: The same message can arrive through network interception, DOM observation, history sync, and optimistic sending.

**Alternatives considered**: Random fallback IDs or content-only matching. Random IDs duplicate on every sync; content-only matching incorrectly merges repeated messages.

## Decision 6: Preserve data on every sync failure

**Decision**: Empty/partial sidebar and history responses update sync status only; they never delete stored conversations/messages.

**Rationale**: Facebook DOM is transient and failure-prone. A failed extraction is not evidence that the customer or message was deleted.

**Alternatives considered**: Replace local state with each snapshot. This is the current failure mode.

## Decision 7: Repair FTS consistency as part of persistence

**Decision**: Add update/delete synchronization and verify/rebuild the search index during migration.

**Rationale**: The current database has 54 messages but 98 FTS rows, including 44 orphan index rows.

**Alternatives considered**: Leave FTS unchanged because joins hide most orphans. That permits unbounded index drift and weakens validation.
