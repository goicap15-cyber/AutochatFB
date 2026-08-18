# Research: Unified Page & Personal Inbox

## R1: Meta Webhook Protocol for Page Messaging

**Decision**: Use Meta Messenger Platform webhooks with `POST /webhooks/meta/page` endpoint

**Rationale**:
- Meta's webhook delivers real-time messaging events for Pages and Instagram Professional accounts
- Webhook requires HTTPS endpoint, `hub.verify_token` for GET verification, and `X-Hub-Signature-256` for POST event validation
- Page access token needs `pages_messaging` + `pages_manage_metadata` permissions to subscribe
- Must respond with HTTP 200 within 20 seconds (Meta's requirement), but best practice is under 5 seconds
- Events include `messaging` field with `sender.id` (customer PSID), `recipient.id` (Page ID), `message.mid`, `message.text`, and `timestamp`

**Alternatives considered**:
- Polling Graph API: Too slow (30s+ latency), rate-limited, not suitable for real-time CRM
- Scraping Page inbox via Chrome extension: Fragile, violates Meta TOS, won't work for Pages the user doesn't have open

## R2: Meta Page Send API

**Decision**: Use `POST https://graph.facebook.com/v18.0/me/messages` with Page access token

**Rationale**:
- Official Meta Send API for Pages, supports text, images, templates
- Requires valid Page access token with `pages_messaging` permission
- Subject to 24-hour messaging window: can only message customers who messaged the Page in the last 24 hours (unless using approved message tags)
- Response includes `recipient_id` and `message_id` for delivery confirmation

**Alternatives considered**:
- Using the personal Messenger extension to reply to Page messages: Would require the Page to be open in Messenger, fragile, can't distinguish sender identity

## R3: Page Conversation History Backfill

**Decision**: Use `GET /{page-id}/conversations` + `GET /{conversation-id}/messages` for initial backfill

**Rationale**:
- Webhooks only deliver new events; existing conversations need backfill for context
- Conversations API returns thread list with participants; Messages sub-resource returns message history
- Requires `pages_messaging` permission on the Page token
- Pagination via cursors; rate-limited by Meta's standard Graph API limits
- Graceful degradation: if token lacks permissions, skip backfill and rely on webhook-only mode

**Alternatives considered**:
- No backfill at all: Would leave operators without context for existing conversations
- Full historical sync: Impractical due to API rate limits; recent history (last 30 days or 50 conversations) is sufficient

## R4: Data Model for Multi-Source Inbox

**Decision**: Add `inbox_sources` table + extend `threads` with `source_id` column via additive migration

**Rationale**:
- Current schema ties threads to `accounts` (personal FB accounts). Pages need a separate identity model
- `inbox_sources` table abstracts both personal accounts and Pages as "sources" with a common interface
- Unique constraint `(source_id, external_conversation_id)` prevents cross-source thread collision
- Additive migration: no existing columns/tables dropped, old data continues to work
- Existing `account_id` on threads maps 1:1 to the auto-created personal_messenger source

**Alternatives considered**:
- Reusing `accounts` table for Pages: Conflates personal FB accounts with Pages, makes filtering and routing complex
- Creating a completely separate `page_threads` table: Fragments queries and prevents unified inbox

## R5: Token Security

**Decision**: Encrypt Page access tokens at rest using AES-256-GCM with a server-side secret from environment variable

**Rationale**:
- Page tokens grant messaging ability on behalf of the Page; must be protected
- AES-256-GCM provides authenticated encryption (confidentiality + integrity)
- Server-side key stored in `PAGE_TOKEN_SECRET` environment variable
- Tokens decrypted only when needed for API calls; never sent to frontend

**Alternatives considered**:
- Storing tokens in plaintext: Security risk if database is compromised
- Using a dedicated secrets manager (Vault): Overkill for current deployment; can be added later

## R6: Webhook Signature Validation

**Decision**: Validate `X-Hub-Signature-256` header using HMAC-SHA256 with App Secret

**Rationale**:
- Meta signs webhook payloads with the App Secret using HMAC-SHA256
- Server must recompute the signature and compare to reject forged/tampered events
- App Secret stored in `META_APP_SECRET` environment variable
- This is a Meta requirement for production webhooks

**Alternatives considered**:
- Skipping validation: Insecure, allows anyone to send fake events to the webhook endpoint
