# Data Model: Unified Page & Personal Inbox

## New Table: `inbox_sources`

Represents a connected messaging channel. Each personal FB account and each Facebook Page is one source.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Internal unique ID (UUID or `src_<type>_<external_id>`) |
| `source_type` | TEXT | NOT NULL, CHECK(IN ('personal_messenger', 'page_messenger')) | Type of messaging channel |
| `owner_account_id` | TEXT | NULLABLE | For Pages: the FB account that owns/manages this Page. NULL for personal accounts |
| `external_id` | TEXT | NOT NULL | Facebook Account ID or Page ID |
| `display_name` | TEXT | NOT NULL | Human-readable name (account name or Page name) |
| `avatar_url` | TEXT | NULLABLE | Profile picture URL or local path |
| `access_token_encrypted` | TEXT | NULLABLE | Encrypted Page access token (NULL for personal_messenger) |
| `webhook_verify_token` | TEXT | NULLABLE | Random verify token for this Page's webhook subscription |
| `status` | TEXT | DEFAULT 'ACTIVE', CHECK(IN ('ACTIVE', 'DISCONNECTED', 'TOKEN_EXPIRED')) | Connection status |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

**Unique constraint**: `(source_type, external_id)`

**Relationships**:
- `owner_account_id` → `accounts.id` (optional FK, for Page sources linked to a personal account)

---

## Modified Table: `threads`

Add `source_id` column to link each thread to its inbox source.

| New Column | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `source_id` | TEXT | NULLABLE, FK → `inbox_sources.id` | Which inbox source this thread belongs to |

**Migration strategy**:
1. Add `source_id` column as NULLABLE (additive, no breakage)
2. Auto-create `inbox_sources` rows for each existing `accounts` row with `source_type = 'personal_messenger'`
3. Backfill existing threads: `UPDATE threads SET source_id = (SELECT id FROM inbox_sources WHERE external_id = threads.account_id AND source_type = 'personal_messenger')`
4. New threads MUST have `source_id` set

**New unique constraint**: `UNIQUE(source_id, external_thread_id)` — prevents same external conversation appearing twice under the same source

---

## Existing Table: `messages` — No Schema Change

Messages reference threads via `thread_id`. Since threads now carry `source_id`, messages are implicitly source-aware. No changes needed.

---

## Existing Table: `contacts` — No Schema Change

Contacts reference threads via `thread_id`. Source info comes through the thread join. No changes needed.

---

## Entity Relationships

```
inbox_sources (1) ──< threads (many)
     │                    │
     │                    ├──< messages (many)
     │                    └──< contacts (1)
     │
accounts (1) ──< inbox_sources (many, via owner_account_id)
```

## State Transitions

### Inbox Source Status
```
ACTIVE ──(token expired)──> TOKEN_EXPIRED
ACTIVE ──(disconnected)──> DISCONNECTED
TOKEN_EXPIRED ──(token refreshed)──> ACTIVE
DISCONNECTED ──(reconnected)──> ACTIVE
```

### Message Delivery (Page)
```
pending ──(Send API success)──> sent
pending ──(Send API error)──> failed
pending ──(24h window expired)──> failed
```
