# Data Model: Multi-source Campaign Delivery

## Existing entities extended

### Campaign recipient route snapshot

The existing `campaign_recipients` row remains one recipient per immutable campaign snapshot. New nullable snapshot attributes are populated for new multi-source campaigns:

| Field | Meaning | Validation |
|---|---|---|
| `source_type_snapshot` | `page_messenger` or `personal_messenger` | Must match the source resolved from the thread at creation and at dispatch. |
| `source_external_id_snapshot` | Page identity for a Page source; null for personal | Required for Page; must remain null for personal. |
| `source_display_name_snapshot` | Human-readable Page/account source label | Display/audit only; never used as routing authority. |

The existing `source_id` and `account_id` remain authoritative foreign route references. Historical rows may leave the new fields null and follow the legacy Page-only interpretation; their data is not rewritten.

### Route capability decision

An ephemeral validation result used during creation/preview/start and revalidation:

| Field | Meaning |
|---|---|
| `text_enabled` | Route can presently send text. |
| `image_enabled` | Route can send the attached campaign image. |
| `source_active` / `account_active` / `connected` | Preconditions to dispatch through the exact saved source. |
| `reason_code` / `reason_message` | Stable diagnostic and Vietnamese operator explanation. |

It is recalculated from backend-owned source/account/connection facts. The UI may display it but may not write it as route truth.

### Campaign attempt and queue item

Existing attempt and queue entities are reused. For every mixed-source dispatch:

- `campaign_attempts.idempotency_key` remains the campaign delivery idempotency key.
- `message_queue` carries the recipient snapshot's `source_id`, `source_type`, `account_id`, and `page_id` (only for a Page).
- `message_queue.idempotency_key` remains the campaign attempt key for campaign work. Rich-message uses its own `outbound_attempts.idempotency_key`; the mechanisms must not be merged.
- Confirmation and recovery continue to update the matching attempt/recipient only.

## State transitions

```text
selected thread
  -> backend resolves current route
  -> recipient snapshot with route facts
  -> eligible | unsupported | invalid_route | opted_out

eligible recipient selected by runner
  -> revalidate current route equals snapshot
  -> revalidate exact-route connection + text/image capability
  -> create campaign attempt + v2 queue item
  -> dispatched
  -> Facebook evidence confirms => sent/confirmed
     or evidence/recovery fails => failed/unknown/retry under current policy
```

If revalidation finds a mismatch, missing Page id, inactive source, missing personal connection, or unsupported attachment, the transition is recipient-local `failed`/`unsupported`; no alternate source is selected.

## Migration and compatibility rules

- Additive nullable columns only; do not rebuild campaign tables or mutate historical recipient routes.
- A new feature version identifies snapshots created after multi-source support is enabled.
- Backfill is deliberately avoided for old rows because it could assert a historical source identity that was never persisted.
- Repository reads expose effective source fields for legacy Page-only rows while preserving raw snapshot fields for audit.
