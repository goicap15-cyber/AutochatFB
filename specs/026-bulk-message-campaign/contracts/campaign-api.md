# Campaign API Contract

The exact framework remains the existing Express/Socket.IO server style. This contract defines behavior, not implementation bodies.

## Campaign lifecycle

### `POST /api/campaigns`

Creates a draft from selected thread ids.

Request fields:

```json
{
  "name": "string",
  "thread_ids": ["string"],
  "start_position": 1,
  "direction": "asc",
  "messages": [{"text_content": "string"}]
}
```

The server resolves and snapshots each thread's source/account route. It must not accept a client-provided account route as authoritative.

### `GET /api/campaigns/:id`

Returns campaign lifecycle state, counts, message validation, and recipient rows including execution order and latest outcome.

### `POST /api/campaigns/:id/preview`

Validates content, source routes, eligibility, start position, direction, and attachment references. Returns the exact execution order. It must not dispatch.

### `POST /api/campaigns/:id/start`

Atomically transitions a ready campaign to running. Repeated start calls are idempotent and must not create a second runner.

### `POST /api/campaigns/:id/pause`

Transitions running to pausing/paused. No new recipient may be dispatched after the acknowledged paused state.

### `POST /api/campaigns/:id/resume`

Transitions paused to running after revalidating source availability and limits.

### `POST /api/campaigns/:id/cancel`

Transitions a running or paused campaign to cancelled and marks unsent recipients cancelled.

### `POST /api/campaigns/:id/recipients/:recipientId/retry`

Creates one explicit retry attempt for a failed or unknown recipient after route/content validation.

### `POST /api/campaigns/:id/attachments`

Accepts a multipart upload, validates type/size, stores it under a server-managed path, and returns an attachment id. It must not accept arbitrary filesystem paths.

## Realtime events

The campaign detail view subscribes to Socket.IO events:

- `CAMPAIGN_UPDATED`: lifecycle or aggregate counters changed.
- `CAMPAIGN_RECIPIENT_UPDATED`: one recipient status/attempt changed.
- `CAMPAIGN_AUDIT_EVENT`: an action or delivery result was recorded.

Every event includes `campaign_id`; recipient events include `campaign_recipient_id` and a monotonic update timestamp/version.

## Error contract

Errors return a stable `code`, human-readable `message`, and optional `details`:

```json
{
  "error": {
    "code": "CAMPAIGN_NOT_READY",
    "message": "Campaign cannot start",
    "details": {"invalid_recipient_count": 2}
  }
}
```

Required codes include `CAMPAIGN_NOT_FOUND`, `CAMPAIGN_NOT_READY`, `CAMPAIGN_STATE_CONFLICT`, `INVALID_RECIPIENT`, `INVALID_ORDER`, `SOURCE_UNAVAILABLE`, `ATTACHMENT_INVALID`, `SEND_LIMIT_REACHED`, and `RECIPIENT_ALREADY_SENT`.
