# Rich Messaging Contracts

## Compatibility

Contract version 2 adds optional attachment fields while retaining version 1 text behavior. Legacy SEND_MESSAGE payloads containing only thread_id, content, and client_message_id remain valid.

## HTTP: Get thread capabilities

GET /api/threads/:threadId/rich-message-capabilities

### Success 200

~~~json
{
  "thread_id": "thread-id",
  "source_type": "personal_messenger",
  "connected": true,
  "contract_version": 2,
  "adapter_version": "rich-message-v1",
  "text": { "enabled": true },
  "emoji": { "enabled": true, "quick_like": "👍" },
  "image": {
    "enabled": true,
    "mime_types": ["image/jpeg", "image/png", "image/webp"],
    "max_bytes": 8388608
  },
  "file": {
    "enabled": true,
    "mime_types": ["application/pdf"],
    "max_bytes": 8388608
  },
  "disabled_reason": null
}
~~~

The server derives source and account from the thread. Clients cannot supply or override routing.

## HTTP: Stage an attachment

POST /api/threads/:threadId/outbound-attachments

Content-Type: multipart/form-data

Fields:

- file: required binary file.
- client_upload_id: optional browser-generated id used to suppress repeated upload clicks.

### Success 201

~~~json
{
  "attachment": {
    "id": "attachment-uuid",
    "thread_id": "thread-id",
    "original_name": "Bao gia.pdf",
    "safe_name": "Bao_gia.pdf",
    "media_type": "file",
    "mime_type": "application/pdf",
    "byte_size": 245761,
    "checksum_sha256": "hex-digest",
    "status": "staged",
    "expires_at": "2026-08-12T10:00:00.000Z",
    "preview_url": "/api/outbound-attachments/attachment-uuid/content"
  }
}
~~~

### Errors

| HTTP | Code | Meaning |
|---|---|---|
| 400 | ATTACHMENT_EMPTY | No bytes were provided |
| 400 | ATTACHMENT_TYPE_MISMATCH | Declared type and signature differ |
| 400 | ATTACHMENT_UNSUPPORTED | MIME/source capability is disabled |
| 403 | THREAD_FORBIDDEN | Operator cannot send to the thread |
| 404 | THREAD_NOT_FOUND | Thread does not exist |
| 409 | SOURCE_DISCONNECTED | Required account/Page extension is unavailable |
| 413 | ATTACHMENT_TOO_LARGE | Effective byte limit exceeded |
| 422 | ATTACHMENT_CORRUPT | File signature/structure is unreadable |

Text already typed in the composer is not part of this request and must remain on any upload error.

## HTTP: Remove a staged attachment

DELETE /api/threads/:threadId/outbound-attachments/:attachmentId

Returns 204 only when the attachment belongs to the thread/operator and is still staged. Queued, sending, sent, expired, or deleted rows return 409 ATTACHMENT_NOT_DISCARDABLE.

## HTTP: Read attachment content

GET /api/outbound-attachments/:attachmentId/content

Requires normal CRM authorization. Returns an inline image or attachment download with safe Content-Type and Content-Disposition. The endpoint never accepts a filesystem path.

## Socket.IO: Submit a message

Event: SEND_MESSAGE

### Version 2 request

~~~json
{
  "contract_version": 2,
  "thread_id": "thread-id",
  "client_message_id": "client_...",
  "content": "Optional caption 😊",
  "attachment_id": "attachment-uuid"
}
~~~

Rules:

- content may be empty only when attachment_id is valid.
- attachment_id may be omitted for text/emoji/quick-like.
- account_id, source_id, source_type, and page_id are forbidden client inputs.
- the same client_message_id returns the same accepted logical message and never creates a second first attempt.

### Accepted event

Event: MESSAGE_SEND_ACCEPTED

~~~json
{
  "thread_id": "thread-id",
  "client_message_id": "client_...",
  "message_id": 123,
  "attempt_id": "attempt-uuid",
  "queue_id": "queue-uuid",
  "status": "queued",
  "attachment": {
    "id": "attachment-uuid",
    "media_type": "image",
    "mime_type": "image/png",
    "name": "anh.png",
    "byte_size": 123456
  }
}
~~~

Accepted means persisted and queued, not delivered.

### Status event

Event: MESSAGE_SEND_STATUS

~~~json
{
  "thread_id": "thread-id",
  "client_message_id": "client_...",
  "message_id": 123,
  "attempt_id": "attempt-uuid",
  "status": "awaiting_confirmation",
  "fb_message_id": null,
  "confirmation_source": null,
  "error": null,
  "updated_at": "2026-08-11T10:00:00.000Z"
}
~~~

Allowed status values: queued, dispatching, awaiting_confirmation, sent, failed, uncertain.

A sent event must include fb_message_id and confirmation_source. A failed or uncertain event includes a stable error code and operator-facing message.

## Socket.IO: Retry

Event: RETRY_MESSAGE

~~~json
{
  "thread_id": "thread-id",
  "message_id": 123,
  "expected_latest_attempt_id": "attempt-uuid"
}
~~~

The backend rejects retry when an attempt is still queued/dispatching/awaiting_confirmation. For uncertain attempts it runs reconciliation first. A found Facebook message returns sent without creating a new attempt.

## Backend to extension WebSocket

Type: SEND_QUEUED_MESSAGE

~~~json
{
  "type": "SEND_QUEUED_MESSAGE",
  "data": {
    "contract_version": 2,
    "queue_id": "queue-uuid",
    "outbound_attempt_id": "attempt-uuid",
    "thread_id": "thread-id",
    "source_type": "page_messenger",
    "source_id": "source-id",
    "page_id": "page-id",
    "content": "Optional caption",
    "attachment": {
      "id": "attachment-uuid",
      "media_type": "file",
      "mime_type": "application/pdf",
      "name": "Bao_gia.pdf",
      "byte_size": 245761,
      "checksum_sha256": "hex-digest",
      "local_path": "/absolute/path/on/this/machine/data/outbound-attachments/<checksum>.pdf"
    }
  }
}
~~~

Rules:

- The backend and extension always run on the same machine (desktop app), so the attachment is referenced by an absolute local file path rather than embedded bytes. Facebook's current Business Suite/Messenger composers open a native OS file chooser instead of exposing a scriptable `<input type="file">`, so the extension supplies this path to Chrome via CDP's `DOM.setFileInputFiles` against the `backendNodeId` from `Page.fileChooserOpened` (see Decision 9 in research.md) rather than injecting bytes into a DOM element.
- `local_path` is present only after server-side validation and integrity re-check (size and checksum match the staged attachment) immediately before dispatch.
- Version 2 maximum attachment size is 8 MiB.
- Source identity/thread validation occurs before attachment staging.
- If the backend and extension are ever split across machines, this contract must change back to an embedded-bytes transport; this design assumes same-machine deployment.

## Extension to backend WebSocket

Type: QUEUED_MESSAGE_RESULT

~~~json
{
  "type": "QUEUED_MESSAGE_RESULT",
  "data": {
    "contract_version": 2,
    "queue_id": "queue-uuid",
    "outbound_attempt_id": "attempt-uuid",
    "thread_id": "thread-id",
    "outcome": "dispatched",
    "stage": "BUSINESS_SUITE_ATTACHMENT_ENTER",
    "adapter_version": "rich-message-v1",
    "error_code": null,
    "error": null
  }
}
~~~

Allowed outcomes:

- dispatched: Facebook composer accepted the staged operation; backend moves to awaiting_confirmation.
- rejected: no valid dispatch occurred; backend records failed with error_code.
- invalid_contract: envelope was rejected before Facebook interaction.

This event never marks a logical message sent.

## Confirmation contract

Existing NEW_MESSAGE/NEW_PAGE_MESSAGE observations remain the confirmation source. For a pending rich message, confirmation must provide:

- exact thread_id;
- a real fb_message_id;
- outgoing direction confirmed;
- compatible media_type when an attachment exists;
- observation timestamp inside the configured attempt window;
- optional content/caption evidence when present.

When multiple candidates remain, the attempt becomes uncertain rather than guessing.

## Stable error codes

- RICH_MESSAGE_FEATURE_DISABLED
- SOURCE_DISCONNECTED
- SOURCE_ROUTE_INVALID
- ATTACHMENT_NOT_FOUND
- ATTACHMENT_WRONG_THREAD
- ATTACHMENT_NOT_READY
- ATTACHMENT_UNSUPPORTED
- ATTACHMENT_TOO_LARGE
- ATTACHMENT_CHECKSUM_MISMATCH
- FACEBOOK_TAB_NOT_FOUND
- FACEBOOK_THREAD_NOT_READY
- FACEBOOK_ATTACHMENT_INPUT_NOT_FOUND
- FACEBOOK_ATTACHMENT_STAGE_FAILED
- FACEBOOK_COMPOSER_NOT_FOUND
- FACEBOOK_DISPATCH_REJECTED
- CONFIRMATION_TIMEOUT
- CONFIRMATION_AMBIGUOUS
- RETRY_NOT_ALLOWED
