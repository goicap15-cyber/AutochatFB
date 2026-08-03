# Validation Quickstart: Persist Chat History

## Preconditions

- Use a backup/copy of `data/database.db`.
- Connect one Facebook account with two dedicated test contacts.
- Record baseline conversation IDs and message counts without exposing message content.

## Scenario 1: Local-first reload

1. Discover and synchronize both test conversations.
2. Confirm both have persisted messages.
3. Reload CRM and Facebook 10 times in alternating order.
4. Confirm both conversations appear immediately from local data with unchanged stored message counts.

Expected: no conversation disappears and no stored message is removed.

## Scenario 2: Offline history

1. Stop or disconnect the extension after a successful sync.
2. Reload the CRM.
3. Open both conversations.

Expected: stored history is readable; only live sync/send is marked unavailable.

## Scenario 3: Initial backfill and incremental append

1. Discover a conversation that already contains older Facebook messages.
2. Interrupt the first history sync after at least one batch.
3. Reconnect and resume.
4. Send one incoming and one outgoing message.
5. Run incremental sync twice.

Expected: partial progress survives, final history completes, two new messages append, and repeated sync adds zero duplicates.

## Scenario 4: Identity stability

1. Observe the same contact through sidebar discovery, normal/encrypted URL, and realtime interception.
2. Reload Facebook between observations.
3. Compare stable CRM conversation IDs.

Expected: all trusted aliases resolve to one conversation; ambiguous aliases are reported rather than silently merged.

## Scenario 5: Database consistency

1. Compare conversation, contact, and message row counts before/after migration.
2. Run SQLite integrity and foreign-key checks.
3. Compare FTS rows to live message rows after rebuild.

Expected: valid row counts are preserved, integrity checks pass, and FTS has no orphan rows.
