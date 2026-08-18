# API Contracts: Unified Page & Personal Inbox

## New REST Endpoints

### Inbox Sources Management

#### `GET /api/inbox-sources`
Returns all registered inbox sources.

**Response** `200 OK`:
```json
[
  {
    "id": "src_personal_100008005082872",
    "source_type": "personal_messenger",
    "external_id": "100008005082872",
    "display_name": "Acc A",
    "avatar_url": "/api/avatars/100008005082872.jpg",
    "status": "ACTIVE",
    "owner_account_id": null,
    "created_at": "2026-08-05T09:00:00Z"
  },
  {
    "id": "src_page_123456789",
    "source_type": "page_messenger",
    "external_id": "123456789",
    "display_name": "MissPrice",
    "avatar_url": "/api/avatars/page_123456789.jpg",
    "status": "ACTIVE",
    "owner_account_id": "100008005082872",
    "created_at": "2026-08-05T09:10:00Z"
  }
]
```

#### `POST /api/inbox-sources/page`
Connect a new Facebook Page as an inbox source.

**Request Body**:
```json
{
  "page_access_token": "EAAxxxxxxxx",
  "owner_account_id": "100008005082872"
}
```

**Response** `201 Created`:
```json
{
  "id": "src_page_123456789",
  "source_type": "page_messenger",
  "external_id": "123456789",
  "display_name": "MissPrice",
  "status": "ACTIVE"
}
```

**Error** `400`:
```json
{
  "error": "Invalid or expired Page access token"
}
```

#### `DELETE /api/inbox-sources/:id`
Disconnect and remove an inbox source.

**Response** `200 OK`:
```json
{
  "success": true
}
```

---

### Meta Webhook Endpoints

#### `GET /webhooks/meta/page`
Webhook verification endpoint (called by Meta during webhook subscription setup).

**Query Parameters**:
- `hub.mode` = `subscribe`
- `hub.verify_token` = configured verify token
- `hub.challenge` = challenge string from Meta

**Response**: Returns `hub.challenge` as plain text with `200 OK` if verify_token matches.

#### `POST /webhooks/meta/page`
Receives webhook events from Meta.

**Headers**:
- `X-Hub-Signature-256`: HMAC-SHA256 signature of the request body

**Request Body** (from Meta):
```json
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1723456789,
      "messaging": [
        {
          "sender": { "id": "CUSTOMER_PSID" },
          "recipient": { "id": "PAGE_ID" },
          "timestamp": 1723456789000,
          "message": {
            "mid": "m_unique_message_id",
            "text": "Hello!"
          }
        }
      ]
    }
  ]
}
```

**Response**: `200 OK` (always, within 5 seconds)

---

### Modified Existing Endpoints

#### `GET /api/threads` (modified)
Add `source_filter` query parameter.

**New Query Parameters**:
- `source_filter` — One of: `all`, `personal_messenger`, `page_messenger`, or a specific source ID

**Response**: Same structure as current, with additional fields per thread:
```json
{
  "id": "...",
  "source_id": "src_page_123456789",
  "source_type": "page_messenger",
  "source_name": "MissPrice",
  "contact_name": "Nguyễn Văn B",
  "last_message": "Hello!",
  "last_activity": "..."
}
```

---

## Socket.io Events (Modified/New)

### New Events
- `PAGE_MESSAGE_RECEIVED` — Emitted when a webhook message is persisted for a Page
- `INBOX_SOURCE_ADDED` — Emitted when a new source is connected
- `INBOX_SOURCE_REMOVED` — Emitted when a source is disconnected
- `INBOX_SOURCE_STATUS_CHANGED` — Emitted when source status changes

### Modified Events
- `NEW_MESSAGE` — Now includes `source_id` and `source_type` fields
- `THREADS_SYNCED` — Now includes `source_id` per thread
