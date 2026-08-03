# Data Model: Reliable Outbound Messaging

## OutboundMessageAttempt

| Field | Meaning | Rules |
|---|---|---|
| `client_message_id` | CRM-generated correlation key | Required, unique per send attempt |
| `thread_id` | CRM/Facebook conversation | Must belong to registered account |
| `account_id` | Sending Facebook account | Must match extension connection |
| `content` | Text submitted by operator | Non-empty after trim |
| `status` | `pending`, `sent`, or `failed` | Monotonic except explicit retry creates new attempt |
| `fb_message_id` | Official Facebook ID | Required for `sent`; absent for pending/failed |
| `error_code` | Normalized failure category | Safe, stable code for UI/retry |
| `created_at` / `updated_at` | Lifecycle timestamps | Preserve across reload |

## State transitions

```text
pending ── official fb_message_id ──> sent
pending ── dispatch/API/timeout error ──> failed
failed  ── retry ──> pending (new client_message_id)
sent    ── duplicate event ──> sent (no-op)
```

## Persistence mapping

The existing `messages` row remains the canonical UI record. Pending rows must be correlated by `client_message_id`; success updates the row's `fb_message_id` and status metadata rather than inserting a second bubble. If schema changes are required, use a versioned migration and preserve the existing migration backup/integrity guard.
