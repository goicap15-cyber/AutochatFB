# Contract: Campaign File Transport

**Status (2026-08-17)**: target contract, not yet implemented. Today's queue envelope still carries a single `attachment` object (matching spec 039's image path); `attachment_manifest` below does not exist in `QueueWorker`/`queueEnvelopeValidation.js` yet. Confirmation events are not yet manifest-aware either. Implement alongside `data-model.md`'s `campaign_attachment_manifests` table.

## Queue envelope

```json
{
  "type": "SEND_QUEUED_MESSAGE",
  "data": {
    "contract_version": 2,
    "queue_id": "queue-id",
    "campaign_id": "campaign-id",
    "campaign_attempt_id": "attempt-id",
    "thread_id": "thread-id",
    "account_id": "account-id",
    "source_id": "source-id",
    "source_type": "personal_messenger",
    "page_id": null,
    "content": "Tài liệu gửi bạn",
    "attachment_manifest": {
      "kind": "folder_zip",
      "item_count": 12,
      "payload_path": "server-managed-path",
      "checksum_sha256": "..."
    }
  }
}
```

Page requires `page_id`; personal requires `page_id: null`. Dispatch acknowledgement is not `sent`.

## Confirmation event

```json
{
  "thread_id": "thread-id",
  "campaign_id": "campaign-id",
  "campaign_attempt_id": "attempt-id",
  "source_type": "page_messenger",
  "fb_message_id": "mid.$...",
  "media_type": "file",
  "attachment_checksum_sha256": "...",
  "confirmation_source": "page_dom"
}
```

The backend accepts the event only when it matches one active attempt and its saved route.
