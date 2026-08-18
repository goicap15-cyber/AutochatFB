# Tasks: Unified Page & Personal Inbox

**Feature**: 008-unified-page-personal-inbox
**Generated**: 2026-08-05

## Phase 1: Database Migration

### Task 1.1: Create `inbox_sources` table and migration
**File**: `src/server/database/db.js` (migration v10)
**Dependencies**: None
**Priority**: P1 (blocks everything)

- [x] Add migration v10 `add_inbox_sources` to the migrations array
- [x] CREATE TABLE `inbox_sources` with columns: id, source_type, owner_account_id, external_id, display_name, avatar_url, access_token_encrypted, webhook_verify_token, status, created_at
- [x] Add UNIQUE constraint on (source_type, external_id)
- [x] Auto-create `inbox_sources` rows for each existing `accounts` row with source_type='personal_messenger'
- [x] ALTER TABLE threads ADD COLUMN source_id TEXT (nullable)
- [x] Backfill existing threads: UPDATE threads SET source_id = matching inbox_source.id
- [x] Add index idx_threads_source_id on threads(source_id)
- [x] Verify migration runs cleanly with `node --check` and backend startup

### Task 1.2: Token encryption utility
**File**: `src/server/utils/tokenEncryption.js` (NEW)
**Dependencies**: None
**Priority**: P2

- [x] Create AES-256-GCM encrypt/decrypt functions using `PAGE_TOKEN_SECRET` env var
- [x] Export `encryptToken(plaintext)` → returns `iv:authTag:ciphertext` string
- [x] Export `decryptToken(encrypted)` → returns plaintext
- [x] Handle missing PAGE_TOKEN_SECRET gracefully (warn, don't crash)

---

## Phase 2: Inbox Source Service

### Task 2.1: InboxSourceService
**File**: `src/server/services/InboxSourceService.js` (NEW)
**Dependencies**: Task 1.1, Task 1.2
**Priority**: P1

- [x] `getAllSources()` — returns all inbox_sources rows (without decrypted tokens)
- [x] `getSourceById(id)` — returns single source
- [x] `getSourceByExternalId(sourceType, externalId)` — lookup
- [x] `createPersonalSource(accountId, displayName)` — creates personal_messenger source, called when accounts register
- [x] `createPageSource({ pageAccessToken, ownerAccountId })` — validates token with Graph API, fetches Page info, encrypts token, inserts row
- [x] `removeSource(id)` — soft delete or status change
- [x] `getDecryptedToken(sourceId)` — returns decrypted Page access token
- [x] `updateSourceStatus(id, status)` — update status field

### Task 2.2: REST API for inbox sources
**File**: `src/server/server.js` (modify)
**Dependencies**: Task 2.1
**Priority**: P2

- [x] `GET /api/inbox-sources` — returns all sources (calls InboxSourceService.getAllSources)
- [x] `POST /api/inbox-sources/page` — connect a new Page (calls InboxSourceService.createPageSource)
- [x] `DELETE /api/inbox-sources/:id` — disconnect a source
- [x] Emit `INBOX_SOURCE_ADDED` / `INBOX_SOURCE_REMOVED` socket events

### Task 2.3: Auto-create personal source on REGISTER_ACCOUNT
**File**: `src/server/server.js` (modify)
**Dependencies**: Task 2.1
**Priority**: P1

- [x] In the REGISTER_ACCOUNT handler, after inserting into `accounts`, call `InboxSourceService.createPersonalSource(accountId, name)`
- [x] Ensure idempotent (don't create duplicate if source already exists)
- [x] Log `[UNIFIED_INBOX_SOURCE_RESOLVED]`

---

## Phase 3: Page Messenger Adapter

### Task 3.1: PageMessengerAdapter service
**File**: `src/server/services/PageMessengerAdapter.js` (NEW)
**Dependencies**: Task 2.1
**Priority**: P1

- [x] `handleWebhookEvent(body)` — processes webhook POST body
  - Parse entry[].messaging[] events
  - For each message: resolve source by recipient.id (Page ID)
  - Deduplicate by message.mid
  - Upsert thread (source_id + sender PSID as external_thread_id)
  - Insert message into messages table
  - Emit NEW_MESSAGE via socket.io
  - Log `[PAGE_WEBHOOK_RECEIVED]` and `[PAGE_MESSAGE_PERSISTED]`
- [x] `sendMessage(sourceId, recipientPsid, messageText)` — sends via Page Send API
  - Decrypt Page access token
  - POST to `https://graph.facebook.com/v18.0/me/messages`
  - Handle success/failure
  - Log `[PAGE_SEND_REQUEST]` and `[PAGE_SEND_RESULT]`
- [x] `validateSignature(rawBody, signature, appSecret)` — HMAC-SHA256 validation
- [x] `verifyWebhook(query)` — hub.mode/verify_token/challenge handler

### Task 3.2: Webhook endpoints
**File**: `src/server/server.js` (modify)
**Dependencies**: Task 3.1
**Priority**: P1

- [x] `GET /webhooks/meta/page` — webhook verification endpoint
  - Check hub.mode === 'subscribe'
  - Match hub.verify_token against WEBHOOK_VERIFY_TOKEN env
  - Return hub.challenge with 200
- [x] `POST /webhooks/meta/page` — webhook event receiver
  - Parse raw body for signature validation
  - Validate X-Hub-Signature-256
  - Call PageMessengerAdapter.handleWebhookEvent
  - Return 200 OK immediately (before processing if needed)
- [x] Add `express.raw({ type: 'application/json' })` middleware for webhook route to get raw body for signature check

---

## Phase 4: Source-Aware Send Router

### Task 4.1: Modify send flow to route by source_type
**File**: `src/server/server.js` (modify)
**Dependencies**: Task 3.1
**Priority**: P2

- [x] In SEND_MESSAGE handler: look up thread's source_id → get source_type
- [x] If source_type === 'personal_messenger' → use existing sendViaExtension flow
- [x] If source_type === 'page_messenger' → call PageMessengerAdapter.sendMessage
- [x] For Page sends: check 24-hour window and warn/fail if expired
- [x] Handle Page send results (success → mark sent, failure → mark failed)
- [x] Emit appropriate socket events (MESSAGE_SENT / MESSAGE_SEND_FAILED)

---

## Phase 5: Backend Thread Integration

### Task 5.1: Modify thread queries to include source info
**File**: `src/server/server.js` (modify)
**Dependencies**: Task 1.1
**Priority**: P1

- [x] Modify GET /api/threads to JOIN inbox_sources and return source_id, source_type, source_name per thread
- [x] Add `source_filter` query param: 'all', 'personal_messenger', 'page_messenger', or specific source_id
- [x] Modify THREADS_SYNCED handler to include source metadata
- [x] Modify NEW_MESSAGE socket event to include source_id and source_type
- [x] Log `[UNIFIED_INBOX_SOURCE_RESOLVED]` when resolving thread identity

### Task 5.2: Set source_id on new threads from extension
**File**: `src/server/server.js` (modify)
**Dependencies**: Task 1.1, Task 2.3
**Priority**: P1

- [x] In NEW_MESSAGE_RECEIVED handler: when creating/updating threads from extension, set source_id from the personal_messenger inbox_source matching account_id
- [x] In THREADS_SYNCED handler: same — set source_id on synced threads

---

## Phase 6: UI Changes

### Task 6.1: Source filter in ConversationSidebar
**File**: `src/client/components/ConversationSidebar.jsx` (modify)
**Dependencies**: Task 5.1
**Priority**: P1

- [x] Add `inboxSources` prop (loaded from GET /api/inbox-sources)
- [x] Replace or augment the account filter dropdown with a source filter:
  - "Tất cả nguồn"
  - "Messenger cá nhân" (all personal_messenger sources)
  - "Page" (all page_messenger sources)
  - Individual sources by name (e.g., "Page: MissPrice", "Account: Acc A")
- [x] Filter threads by selected source_id or source_type
- [x] Keep existing tab filters (ALL, ASSIGNED, UNPROCESSED, COMPLETED) working alongside source filter

### Task 6.2: Source badge in ConversationItem
**File**: `src/client/components/ConversationItem.jsx` (modify)
**Dependencies**: Task 5.1
**Priority**: P1

- [x] Display source badge below contact name: "Messenger cá nhân · [Account Name]" or "Page · [Page Name]"
- [x] Use different badge colors for personal vs Page sources
- [x] Handle missing source info gracefully (legacy threads)

### Task 6.3: Source badge in ChatHeader
**File**: `src/client/components/ChatHeader.jsx` (modify)
**Dependencies**: Task 5.1
**Priority**: P1

- [x] Show source type badge next to account pill: "Page · MissPrice" or "Messenger · Acc A"
- [x] Differentiate status indicator for Page sources (API connected vs extension connected)
- [x] Change "Extension Live" to "Page API Active" for Page sources

### Task 6.4: Load inbox sources in App.jsx
**File**: `src/client/App.jsx` (modify)
**Dependencies**: Task 2.2, Task 6.1
**Priority**: P1

- [x] Add `inboxSources` state, loaded from GET /api/inbox-sources
- [x] Pass `inboxSources` to ConversationSidebar
- [x] Listen for INBOX_SOURCE_ADDED / INBOX_SOURCE_REMOVED socket events to update state
- [x] Pass source info to threads (join by source_id)

### Task 6.5: Page connection UI in settings
**File**: `src/client/components/AccountManagerModal.jsx` (modify)
**Dependencies**: Task 2.2
**Priority**: P2

- [x] Add "Kết nối Page" section/tab in AccountManagerModal
- [x] Form to paste Page access token + select owner account
- [x] POST to /api/inbox-sources/page on submit
- [x] Show connected Pages with status, name, disconnect button
- [x] Show validation errors from server

---

## Phase 7: Page History Backfill (Optional/P3)

### Task 7.1: Backfill service
**File**: `src/server/services/PageMessengerAdapter.js` (extend)
**Dependencies**: Task 3.1
**Priority**: P3

- [x] `backfillConversations(sourceId)` — fetches GET /{page-id}/conversations
- [x] For each conversation: fetch GET /{conversation-id}/messages
- [x] Deduplicate with existing messages by fb_message_id
- [x] Gracefully handle insufficient permissions (skip, log warning)
- [x] Run automatically after Page source is connected (async, non-blocking)

---

## Dependency Graph

```
Task 1.1 (DB Migration) ──┬──> Task 2.1 (InboxSourceService) ──┬──> Task 2.2 (REST API)
                           │                                     ├──> Task 2.3 (Auto-create)
Task 1.2 (Token Encrypt) ─┘                                     ├──> Task 3.1 (PageAdapter) ──> Task 3.2 (Webhooks) ──> Task 4.1 (Send Router)
                                                                 │
                           Task 5.1 (Thread queries) ────────────┤
                           Task 5.2 (Set source_id) ─────────────┤
                                                                 │
                           Task 6.1 (Source filter) ─────────────┤
                           Task 6.2 (ConvItem badge) ────────────┤
                           Task 6.3 (ChatHeader badge) ──────────┤
                           Task 6.4 (App.jsx sources) ───────────┤
                           Task 6.5 (Page connect UI) ───────────┘
                           Task 7.1 (Backfill) ──────────────────── (optional, after 3.1)
```
