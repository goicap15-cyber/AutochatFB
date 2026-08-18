# Data Model: Campaign File Transport

**Status (2026-08-17)**: target design, not yet in `schema.sql`. `campaign_attachments` today (spec 039) is still one row per file with no grouping/kind/archive fields. See `plan.md` Architecture Decision 1 for the recommended additive shape: keep `campaign_attachments` as one row per physical file, and add a new `campaign_attachment_manifests` grouping table that attachment rows reference via a new `manifest_id` column, rather than reshaping the fields below directly onto `campaign_attachments`.

## Campaign File Manifest

One attachment payload for one campaign message.

| Field | Rules |
|---|---|
| `kind` | `files` or `folder_zip` |
| `item_count` | At least 1 |
| `total_bytes` | Positive and within configured limit |
| `manifest_json` | Safe names, relative paths, detected types, sizes, checksums |
| `archive_name` | Required for `folder_zip` |
| `checksum_sha256` | Checksum of resulting payload |
| `storage_path` | Server-managed safe path |
| `validation_status` | `pending`, `valid`, or `invalid` |

## File Delivery Attempt

The existing campaign attempt keeps the immutable recipient route and references the manifest. Its lifecycle is:

```text
pending -> processing -> awaiting_confirmation -> confirmed
                              |-> failed
                              |-> unknown
```

Dispatch acknowledgement cannot skip confirmation.

## Safety Rules

- Reject empty files/folders, path traversal, absolute paths, symlinks, unsafe archive entries, and changed checksums.
- Preserve payloads referenced by pending, confirmed, or retryable attempts.
