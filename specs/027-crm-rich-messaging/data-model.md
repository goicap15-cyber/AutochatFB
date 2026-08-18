# Data Model: CRM Rich Messaging

## Overview

The design adds a thread-bound staged attachment and immutable delivery attempts while retaining messages as the canonical conversation history and message_queue as the dispatch work list.

## Entity: Outbound Attachment

**Purpose**: Represents one validated image or file selected from the one-to-one CRM composer.

| Field | Type | Rules |
|---|---|---|
| id | text identifier | Primary key; server generated |
| thread_id | text identifier | Required; immutable; references the target conversation |
| created_by | staff identifier | Required when authenticated staff identity is available |
| original_name | text | Required; operator-visible original filename |
| safe_name | text | Required; sanitized filename used for display/download headers |
| media_type | enum | image or file |
| mime_type | text | image/jpeg, image/png, image/webp, or application/pdf in v1 |
| byte_size | integer | Greater than zero and no larger than the configured limit |
| storage_path | text | Required; checksum-derived path inside the attachment root |
| checksum_sha256 | text | Required; lowercase 64-character digest |
| status | enum | staged, queued, sending, sent, failed, expired, deleted |
| validation_error | text | Nullable; stable error code/details |
| created_at | timestamp | Required |
| expires_at | timestamp | Required while staged; cleared or extended after queueing |
| consumed_by_message_id | message identifier | Nullable until submitted; unique once set |

**Constraints**:

- An attachment is permanently bound to one thread.
- One attachment can be consumed by at most one logical outbound message.
- Duplicate bytes may share a physical checksum file, but ownership/lifecycle rows remain separate.
- storage_path is never accepted from a client and must resolve below the configured root.
- A staged attachment can be deleted by its creator; queued/sending/sent attachments cannot be deleted through the draft endpoint.

## Entity: Outbound Attempt

**Purpose**: Immutable record of one dispatch attempt for a logical outbound message.

| Field | Type | Rules |
|---|---|---|
| id | text identifier | Primary key; server generated |
| message_id | message identifier | Required; references canonical messages row |
| queue_id | text identifier | Nullable before queue insert; unique once assigned |
| attachment_id | attachment identifier | Nullable for text/emoji; references outbound attachment |
| source_id | source identifier | Required; copied from server-side thread route |
| source_type | enum | personal_messenger or page_messenger |
| account_id | account identifier | Required; extension connection owner |
| page_id | text identifier | Required only for Page attempts |
| attempt_number | integer | Starts at 1; unique per message |
| idempotency_key | text | Required; unique; first attempt derived from client message id |
| status | enum | queued, dispatching, awaiting_confirmation, sent, failed, uncertain, superseded |
| dispatch_method | text | Nullable diagnostic adapter/method version |
| error_code | text | Nullable stable code |
| error_message | text | Nullable operator/diagnostic detail |
| dispatched_at | timestamp | Nullable |
| confirmed_at | timestamp | Nullable |
| confirmation_message_id | text | Nullable real Facebook message id |
| confirmation_source | enum | webhook, personal_dom, page_dom, reconciliation |
| created_at | timestamp | Required |
| updated_at | timestamp | Required |

**Constraints**:

- Attempt rows are not overwritten by retries; state fields may advance but rows remain auditable.
- Only one attempt for a message may be queued, dispatching, or awaiting_confirmation at a time.
- A retry creates the next attempt_number after reconciliation.
- idempotency_key prevents duplicate first-attempt creation from repeated SEND_MESSAGE events.

## Existing Entity Changes: Message

Add:

| Field | Type | Rules |
|---|---|---|
| attachment_id | attachment identifier | Nullable; references outbound_attachments |
| latest_attempt_id | attempt identifier | Nullable; references outbound_attempts |
| media_name | text | Nullable cached display name for history |
| media_mime_type | text | Nullable |
| media_size | integer | Nullable |

Existing content remains nullable, allowing attachment-only sends. Existing media_type, media_url, and local_media_path remain the canonical render fields. Existing delivery_status remains pending, sent, or failed for backward compatibility; the UI derives preparing and uncertain from the latest attempt.

## Existing Entity Changes: Message Queue

Reuse attachment_id, attachment_path, attachment_mime_type, and attachment_name. Add:

| Field | Type | Rules |
|---|---|---|
| outbound_attempt_id | attempt identifier | Nullable for legacy rows; required for new rich messages |
| attachment_media_type | enum | Nullable; image or file |
| attachment_byte_size | integer | Nullable; positive when attachment exists |
| attachment_checksum | text | Nullable; SHA-256 when attachment exists |
| contract_version | integer | Defaults to 1 for legacy text; rich-message envelope starts at 2 |

Queue rows remain mutable work records. Outbound attempts remain the audit history.

`message_queue.idempotency_key` already exists from the campaign feature migration and is UNIQUE. Rich-message queue rows created by this feature MUST leave it NULL and rely on `outbound_attempts.idempotency_key` for their own idempotency boundary; this feature MUST NOT read, write, or repurpose the campaign idempotency_key value. SQLite permits multiple NULLs in a UNIQUE column, so this causes no collision, but the separation must be explicit in the implementation so the two idempotency mechanisms are never conflated.

## Derived Entity: Source Capability

This is returned by a service and need not be persisted initially.

| Field | Meaning |
|---|---|
| thread_id | Active target conversation |
| source_type | personal_messenger or page_messenger |
| connected | Required extension connection is healthy |
| text_enabled | Text/emoji sending is available |
| image_enabled | Image adapter has passed the source matrix |
| file_enabled | PDF adapter has passed the source matrix |
| allowed_mime_types | Enabled types for this exact source |
| max_bytes | Effective configured/source-tested limit |
| disabled_reason | Operator-facing reason when a capability is off |
| adapter_version | Diagnostic contract/adapter version |

## Relationships

- Thread 1 → many Outbound Attachments.
- Thread 1 → many Messages.
- Message 0..1 → Outbound Attachment.
- Message 1 → many Outbound Attempts.
- Outbound Attempt 0..1 → one Message Queue row.
- Outbound Attachment 1 → 0..1 consumed Message.

## State Transitions

### Attachment

~~~
staged ──submit──> queued ──worker claim──> sending ──confirmation──> sent
   │                  │                         ├──terminal error──> failed
   ├──discard──> deleted                       └──timeout──> failed or retained for uncertain attempt
   └──retention timeout──> expired
~~~

Rules:

- Validation failure returns no usable staged row.
- queued/sending attachments cannot be rebound or discarded.
- failed attachment bytes are retained through the retry window, then cleaned by policy.
- sent attachment metadata remains; physical bytes follow message-history retention policy.

### Attempt

~~~
queued ──claim──> dispatching ──Enter accepted──> awaiting_confirmation ──observed──> sent
   │                   │                                  ├──timeout──> uncertain
   └──queue error──> failed                               └──definitive rejection──> failed
uncertain ──reconcile found──> sent
uncertain ──reconcile absent + explicit retry──> superseded
~~~

### Message

- Created as pending before dispatch.
- Becomes sent only with a real Facebook message id.
- Becomes failed on a definitive terminal failure with no active/uncertain attempt.
- Remains pending while the latest attempt is awaiting_confirmation or uncertain; UI shows the more precise attempt state.

## Transaction Boundaries

### Submit transaction

1. Verify thread, staff permission, source route, connection/capability, client message id, and attachment ownership/state.
2. Reuse the existing result when the first-attempt idempotency key already exists.
3. Insert pending Message.
4. Mark attachment queued and bind consumed_by_message_id.
5. Insert Outbound Attempt.
6. Insert Message Queue row linked to the attempt.
7. Update latest_attempt_id and thread preview.
8. Commit before QueueWorker can claim the row.

### Confirmation transaction

1. Resolve pending candidate by exact thread and bounded active attempt.
2. Validate outgoing direction and compatible text/media evidence.
3. Upgrade pending fb_message_id to the observed real id.
4. Mark Message sent, Attempt sent, Queue sent, and Attachment sent.
5. Emit one normalized realtime status after commit.

## Retention and Cleanup

- Staged, unconsumed attachments expire after a configurable short retention period; recommended default is 24 hours.
- Failed/uncertain attachment bytes are retained through the retry/reconciliation window; recommended minimum is 72 hours.
- Cleanup deletes a checksum file only when no attachment row still references it.
- Sent attachment metadata is retained with history. Physical byte retention follows the existing local media policy and must never break a still-active download URL without an explicit expired state.
