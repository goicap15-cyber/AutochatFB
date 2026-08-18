# Contract: Multi-source Campaign Delivery

## Snapshot and preview response

Campaign creation accepts selected thread ids only. The server resolves the route and returns recipient decisions; clients do not submit or override source type/page id.

```json
{
  "recipient": {
    "thread_id": "thread-42",
    "source_id": "source-personal-1",
    "source_type": "personal_messenger",
    "source_label": "Messenger cá nhân",
    "eligibility_status": "eligible",
    "eligibility_reason": null,
    "capabilities": { "text": true, "image": false }
  },
  "source_counts": { "page_messenger": 2, "personal_messenger": 2 }
}
```

For a Page source, `source_external_id` is available only as server-resolved result/diagnostic information and is never accepted as a client route command.

## Campaign queue envelope

Every campaign queue item that can use a non-Page route adopts contract version 2 and contains the preserved route.

```json
{
  "type": "SEND_QUEUED_MESSAGE",
  "data": {
    "contract_version": 2,
    "queue_id": "queue-id",
    "campaign_id": "campaign-id",
    "campaign_attempt_id": "attempt-id",
    "thread_id": "thread-42",
    "account_id": "account-1",
    "source_id": "source-personal-1",
    "source_type": "personal_messenger",
    "page_id": null,
    "content": "Xin chào"
  }
}
```

Rules:

- `source_type` is exactly `page_messenger` or `personal_messenger`.
- Page requires non-empty `page_id`; personal requires `page_id: null`.
- `campaign_attempt_id` and queue id are mandatory for tracking.
- An invalid/mismatched envelope is rejected before extension dispatch.

## Realtime campaign recipient update

```json
{
  "campaign_id": "campaign-id",
  "recipient_id": "recipient-id",
  "thread_id": "thread-42",
  "source_type": "personal_messenger",
  "source_label": "Messenger cá nhân",
  "status": "failed",
  "reason_code": "PERSONAL_SOURCE_NOT_CONNECTED",
  "reason_message": "Messenger cá nhân của nguồn này chưa kết nối."
}
```

Clients merge this update only into the matching campaign/recipient. It is presentation data; routing remains server-side.
