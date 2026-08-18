# Implementation Plan: Unified Page & Personal Inbox

**Feature**: 008-unified-page-personal-inbox
**Branch**: 008-unified-page-personal-inbox
**Status**: Planning Complete

## Technical Context

| Aspect | Current State | Target State |
|--------|--------------|--------------|
| Data Model | `accounts` + `threads` linked by `account_id` | New `inbox_sources` table; threads linked by `source_id` |
| Personal Messenger | Chrome extension → WebSocket → server.js | No change; auto-creates personal_messenger source |
| Page Messaging | Not supported | Meta Webhook + Send API via PageMessengerAdapter |
| UI Thread List | Filter by account_id only | Filter by source_type + specific source_id |
| Sending Router | Always `sendViaExtension()` | Route by source_type: extension or Page API |
| Token Storage | fb_dtsg in extension memory | Page tokens encrypted in DB (AES-256-GCM) |

## Design Artifacts

- [research.md](research.md) — Technical decisions and rationale
- [data-model.md](data-model.md) — Database schema changes
- [contracts/api-contracts.md](contracts/api-contracts.md) — REST + WebSocket API contracts
- [quickstart.md](quickstart.md) — Validation scenarios

## Implementation Phases

### Phase 1: Database Migration (Additive)
- Create `inbox_sources` table
- Add `source_id` column to `threads`
- Auto-create inbox_source rows for existing accounts
- Backfill `source_id` on existing threads
- Add unique index `(source_id, external_thread_id)`

### Phase 2: Inbox Source Service
- `InboxSourceService.js` — CRUD for inbox_sources
- Token encryption/decryption utility
- Auto-create personal_messenger source on REGISTER_ACCOUNT
- REST API: `GET /api/inbox-sources`, `POST /api/inbox-sources/page`, `DELETE /api/inbox-sources/:id`

### Phase 3: Page Messenger Adapter
- `PageMessengerAdapter.js` — Core Page messaging service
- Webhook endpoints: `GET /webhooks/meta/page` (verify), `POST /webhooks/meta/page` (events)
- Signature validation (X-Hub-Signature-256)
- Message deduplication by `message.mid`
- Persist webhook messages to unified conversations
- Send API integration for outgoing messages

### Phase 4: Source-Aware Send Router
- Modify `sendViaExtension()` to be called only for personal_messenger
- Add `sendViaPageAPI()` path
- Unified `sendMessage()` function that routes by source_type
- 24-hour window warning for Page messages

### Phase 5: Backend Thread Integration
- Modify `GET /api/threads` to include source info and accept `source_filter`
- Modify `NEW_MESSAGE_RECEIVED` handler to set `source_id`
- Modify `THREADS_SYNCED` to include source metadata
- Add source info to Socket.io events

### Phase 6: UI — Source Filter & Badges
- Add source filter dropdown to ConversationSidebar
- Add source badge to ConversationItem
- Add source badge to ChatHeader
- Inbox Sources management in Settings/AccountManager

### Phase 7: Page History Backfill (Optional)
- `GET /{page-id}/conversations` pagination
- `GET /{conversation-id}/messages` history
- Graceful degradation if permissions insufficient

## Safety Gates

- All migrations are additive (no DROP, no ALTER existing columns)
- Existing `account_id` FK on threads preserved
- Personal Messenger extension flow untouched
- Backup DB before migration
- Structured logging with `[PAGE_*]` and `[UNIFIED_*]` tags
