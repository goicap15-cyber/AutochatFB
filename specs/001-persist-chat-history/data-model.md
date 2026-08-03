# Data Model: Persist Chat History

## Conversation

Stable CRM-owned representation of one Facebook conversation.

| Field | Purpose |
|-------|---------|
| `id` | Stable internal CRM identifier |
| `account_id` | Owning Facebook account |
| `preferred_external_thread_id` | Current identifier used when requesting sync or sending |
| `thread_url` | Last verified Facebook route |
| `contact_name` | Display name |
| `last_message` | Persisted preview derived from the latest valid message |
| `last_activity` | Latest known message activity, not sidebar refresh time |
| `workflow_status` | Unprocessed, assigned, or completed; never reset by sync |
| `assigned_user_id` | Current CRM assignee |

**Rules**:

- A conversation belongs to exactly one account.
- Absence from a sidebar snapshot does not delete or hide it.
- `last_message` is derived from persisted messages when available.

## ConversationAlias

Maps one external Facebook identifier to a stable conversation.

| Field | Purpose |
|-------|---------|
| `account_id` | Scopes aliases to the owning account |
| `alias_type` | `SIDEBAR_URL`, `THREAD_FBID`, `E2EE_THREAD`, `PARTICIPANT_ID`, or `NETWORK_THREAD` |
| `alias_value` | External identifier value |
| `conversation_id` | Resolved stable conversation |
| `source` | Where the alias was observed |
| `confidence` | Verified or provisional mapping state |

**Rules**:

- `(account_id, alias_type, alias_value)` is unique.
- Provisional aliases cannot merge two existing conversations automatically.
- Conflicts are logged and retained for review.

## Message

Durable message belonging to one conversation.

| Field | Purpose |
|-------|---------|
| `id` | Local database identifier |
| `conversation_id` | Stable owning conversation |
| `fb_message_id` | Official Facebook identifier when available |
| `client_message_id` | CRM-generated outgoing identifier |
| `dedupe_key` | Deterministic fallback identity |
| `sender_id` | External sender identifier |
| `content` | Cleaned message content |
| `is_outgoing` | Direction |
| `timestamp_ms` | Best known event time |
| `timestamp_source` | Provenance/rank for timestamp upgrades |
| `persistence_status` | Pending, persisted, confirmed, or failed |

**Rules**:

- Official Facebook ID wins over all fallback identities.
- A client message reconciles to an official Facebook ID without creating a second message.
- Retries and repeated sync batches are idempotent.

## ConversationSyncState

Tracks resumable initial and incremental synchronization.

| Field | Purpose |
|-------|---------|
| `conversation_id` | One-to-one owner |
| `mode` | Initial backfill or incremental |
| `status` | Not started, running, partial, complete, or failed |
| `newest_known_message_id` | Incremental stop marker |
| `oldest_known_message_id` | Backfill progress marker |
| `last_success_at` | Last completed batch/sync |
| `last_attempt_at` | Most recent attempt |
| `last_error_code` | Structured failure reason |
| `retry_count` | Bounded retry tracking |

### State transitions

```text
NOT_STARTED → RUNNING → COMPLETE
                    ↘ PARTIAL → RUNNING
                    ↘ FAILED  → RUNNING
```

Stored conversations/messages remain readable in every state.

## Migration rules

1. Create a backup before structural migration.
2. Assign a stable conversation ID to every existing thread.
3. Create a verified alias from each existing account/thread ID pair.
4. Repoint existing messages and contacts transactionally.
5. Preserve workflow status, assignment, lead data, and message IDs.
6. Rebuild and verify FTS after ownership migration.
7. Abort and retain the original database if integrity or row-count checks fail.
