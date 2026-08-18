# Implementation Plan: CRM Rich Messaging

**Branch**: 027-crm-rich-messaging | **Date**: 2026-08-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from specs/027-crm-rich-messaging/spec.md

## Summary

Extend the one-to-one CRM composer so an operator can send Unicode emoji, one validated image, or one validated PDF with optional text to either a personal Messenger conversation or a Facebook Page conversation without leaving the CRM. Both source types enter one persisted rich-message queue, then a source-specific extension adapter stages the payload in the correct Facebook conversation. A dispatch is not treated as delivered until the existing DOM/webhook observation path reconciles a real Facebook message identity.

## Technical Context

**Language/Version**: Node.js 24.x, JavaScript, React 19

**Primary Dependencies**: Express 4, Socket.IO 4, ws 8, better-sqlite3 11, Chrome Extension APIs/CDP, Vite 6, Tailwind CSS 4; add emoji-picker-react 4.x for categorized/searchable/recent emoji selection

**Storage**: Existing SQLite database plus server-managed files under data/outbound-attachments

**Testing**: Node built-in test runner through npm run test:persistence, node --check, npm run build:ui, and a live two-source Facebook acceptance matrix

**Target Platform**: Existing desktop/web CRM backend and Chrome extension on the same workstation, supporting connected personal Messenger and Facebook Page sessions

**Project Type**: Single CRM application with React UI, Express/Socket.IO backend, SQLite persistence, and a Chrome extension transport bridge

**Performance Goals**: Validate and stage an attachment without blocking the UI; show an accepted send immediately; reconcile at least 95% of successful sends within 15 seconds after the item appears on Facebook; keep only one active rich-media attempt per thread

**Constraints**: Staff stay in the CRM; exact account/Page routing is mandatory; one attachment per message; initial cross-source formats are JPEG, PNG, WebP, and PDF; default upload limit is 8 MiB until larger payload transport is proven; unsupported capability fails closed; no cross-identity fallback; no false sent state from an Enter key dispatch alone

**Scale/Scope**: One-to-one composer only, existing account/Page connection model, single local backend, one attachment per message, concurrent sends across different threads but serialized attachment dispatch within each thread

## Constitution Check

The repository constitution still contains placeholder principles and therefore defines no enforceable project-specific gates. This plan applies the following safety gates derived from the existing messaging architecture:

- Persist target source, attachment identity, and attempt identity before extension dispatch.
- Derive routing from the server-side thread/source record, never from a browser-supplied account or Page id.
- Validate bytes by signature as well as declared MIME type and constrain every stored path to the configured attachment root.
- Treat extension dispatch as awaiting confirmation, not as final delivery.
- Preserve idempotency across double-clicks, reconnects, delayed observations, and retries.
- Prove every enabled MIME/source pair in the live acceptance matrix before exposing it in the CRM capability response.

**Gate result before research**: PASS. The feature extends existing boundaries without adding a new runtime or bypassing current routing controls.

## Architecture

### End-to-end flow

1. The composer requests capabilities for the active thread and shows only verified actions.
2. Emoji selection inserts Unicode at the textarea cursor. Emoji-only and quick-like messages use the normal text path.
3. An image or PDF is uploaded to a thread-scoped staging endpoint. The server validates type, signature, size, filename, checksum, authorization, and target thread before returning attachment metadata.
4. The operator submits content plus the staged attachment id and a client message id.
5. The backend atomically creates or reuses the pending message, delivery attempt, and queue row using the client message id as the idempotency boundary.
6. The queue worker resolves the stored thread source and dispatches the same versioned rich-message envelope to the extension connection for that exact owner account.
7. The extension selects the personal Messenger adapter or Page Business Suite adapter, verifies tab identity/thread, stages the file, inserts optional text, and dispatches.
8. The extension reports only dispatched or rejected. Existing DOM/webhook capture supplies the real Facebook message id and media evidence used to mark the pending message sent.
9. A confirmation timeout moves the latest attempt to uncertain. Retry first reconciles recent Facebook history before creating a new attempt.

### UI boundary

MessageComposer owns draft text, cursor-aware emoji insertion, picker visibility, local preview, attachment upload/removal, submit disabling, and draft preservation. App owns optimistic message insertion and realtime status reconciliation. MessageBubble and MediaViewer render pending/sent/failed/uncertain attachment states, image previews, filenames, and authenticated downloads.

Switching threads with a non-empty attachment draft is guarded. Text drafts may remain per thread, while a staged attachment remains permanently bound to the thread used at upload and cannot be silently retargeted.

### Server boundary

RichMessageService validates a send request, derives source routing, creates the pending message/attempt/queue transaction, and handles retry eligibility. OutboundAttachmentService owns multipart parsing, signature detection, filename sanitation, checksums, storage lifecycle, and authenticated content access. RichMessageCapabilityService reports the intersection of product policy, configured MIME limits, source adapter support, and current connection state.

The normal one-to-one Page and personal sends use the same MessageQueueRepository/QueueWorker boundary. Existing campaign attachment rows remain separate because campaign reuse, ownership, and retention semantics differ from one-to-one drafts.

### Extension boundary

SEND_QUEUED_MESSAGE becomes a versioned envelope that can carry optional attachment bytes and metadata for both source types. The Page adapter generalizes the existing Business Suite image staging path to the verified file input for image or PDF. The personal adapter adds equivalent attachment staging after exact Messenger tab/thread verification. Both adapters insert optional text only after attachment staging succeeds.

Attachment staging uses the existing byte envelope and DataTransfer file construction for the first increment, with strict 8 MiB server limits. A CDP file-input adapter may replace it later if live testing shows that a Facebook surface ignores synthetic change events. The extension never reports final sent solely because staging and Enter succeeded.

### Confirmation and idempotency

One logical outbound message has one stable client message id, zero or one attachment, and one or more immutable attempts. Each attempt is linked to exactly one queue row with a separate queue id. A retry creates a new attempt only when the prior attempt is failed or remains uncertain after reconciliation.

Confirmation matching requires the same thread, outgoing direction, compatible media type, and a bounded dispatch window. Caption matching is additional evidence when present. Page webhook message ids are preferred; DOM data-message-id is the fallback. Only one attachment attempt may await confirmation per thread, preventing ambiguous media-only matching.

### Capability policy

- Emoji and quick-like are available whenever text sending is available.
- JPEG, PNG, and WebP are enabled only when the selected source adapter has passed attachment staging and confirmation tests.
- PDF is enabled only after the source adapter proves file input discovery, dispatch, recipient download, filename handling, and confirmation.
- The initial maximum is 8 MiB for every attachment despite Messenger product support for larger files; the limit may be raised only after WebSocket memory, timeout, and both-source tests pass.
- Additional Word/Excel/text formats remain disabled until their signatures, security rules, and both-source behavior are specified and tested.

## Project Structure

### Documentation

~~~
specs/027-crm-rich-messaging/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/rich-messaging.md
└── checklists/requirements.md
~~~

### Source changes

~~~
src/client/
├── App.jsx
└── components/
    ├── MessageComposer.jsx
    ├── EmojiPickerPopover.jsx
    ├── AttachmentPreview.jsx
    ├── MessageBubble.jsx
    └── MediaViewer.jsx

src/server/
├── database/
│   ├── schema.sql
│   └── db.js
├── repositories/
│   ├── MessageQueueRepository.js
│   ├── OutboundAttachmentRepository.js
│   └── OutboundAttemptRepository.js
├── services/
│   ├── attachmentValidation.js (shared signature/checksum/safe-path checks, used by OutboundAttachmentService and CampaignAttachmentService)
│   ├── OutboundAttachmentService.js
│   ├── RichMessageService.js
│   ├── RichMessageCapabilityService.js
│   ├── QueueWorker.js
│   └── OutboundConfirmationService.js
└── server.js

src/extension/
├── background.js
├── content.js
└── page_content.js

tests/
├── integration/
│   ├── richMessageAttachments.test.js
│   ├── richMessageRouting.test.js
│   ├── richMessageIdempotency.test.js
│   └── richMessageConfirmation.test.js
└── unit/
    └── outboundAttachmentValidation.test.js
~~~

**Structure Decision**: Extend the existing single-project boundaries. Attachment persistence and routing remain server-owned; browser automation remains extension-owned; the React composer only submits thread-bound ids and renders server-confirmed state.

## Phase Strategy

### Increment 1 - Emoji and queue normalization

- Integrate a lazy-rendered emoji picker with search, categories, recent items, skin tones, keyboard close, and cursor-aware insertion.
- Make quick-like submit a normal Unicode text message.
- Route new one-to-one sends through one server service and preserve current text behavior for both sources.
- Add the versioned event contract and idempotent accepted/status events before enabling attachment buttons.

### Increment 2 - Shared attachment lifecycle and Page images

- Add thread-scoped upload, validation, storage, cleanup, preview, and download.
- Add attachment/attempt persistence and atomic queue creation.
- Generalize the proven Page Business Suite image path and confirmation reconciliation.
- Enable JPEG/PNG/WebP for Page only behind a capability flag until the Page matrix passes.

### Increment 3 - Personal images and cross-source parity

**Prerequisite**: `specs/025-multi-account-reliability-hardening` finding #3 (tab-creation race condition in `background.js`) must be fixed and validated before this increment starts. This increment adds new automated attachment staging on the personal Messenger tab, which depends on the same tab-selection/identity guarantee that finding #3 covers; building on top of an unresolved race would let a rich-message attachment dispatch to the wrong identity, violating FR-003. Increment 2 (Page-only) does not depend on this fix and may proceed first.

- Add personal Messenger image input discovery/staging and exact tab/thread verification.
- Run duplicate, disconnect, delayed-confirmation, and retry tests.
- Expose image controls for both source types only after both matrices pass.

### Increment 4 - PDF files on both sources

- Add PDF signature validation and generic file preview/download.
- Prove native file input behavior, filename retention, attachment-only send, caption send, and recipient download on personal and Page surfaces.
- Keep PDF capability off independently per source until its live matrix passes; feature completion requires both to pass.

### Increment 5 - Recovery, retention, and rollout

- Add confirmation timeout/reconciliation and safe retry.
- Add staged-file expiration and orphan cleanup.
- Complete audit fields, diagnostic error mapping, feature flag rollout, and operator-facing failure copy.
- Remove the rich-message flag only after automated tests and live two-source acceptance pass.

## Test Gates

- Attachment signature, size, traversal, empty file, checksum, lifecycle, and authorization tests pass.
- Queue transaction produces exactly one pending message and attempt for duplicate client ids.
- Routing tests prove no account/Page fallback and no browser-controlled route override.
- Extension contract tests prove invalid/missing attachments fail before Enter.
- Confirmation tests prove dispatched is not sent, real Facebook ids upgrade pending rows, and timeout becomes uncertain.
- Retry tests reconcile first and never duplicate a confirmed message.
- UI tests cover cursor insertion, quick-like, attachment-only submit, preview/removal, thread-switch guard, and error preservation.
- Live matrix passes personal and Page rows for emoji, quick-like, image-only, image-plus-caption, PDF-only, PDF-plus-caption, disconnect, delayed confirmation, and duplicate click.

## Post-design Constitution Check

PASS. The design persists state before dispatch, validates all untrusted attachment data, keeps source routing server-derived, and requires observed delivery evidence. No new constitution violation is introduced.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Separate outbound attachment table | One-to-one drafts have thread ownership, expiration, and single-send lifecycle | Reusing campaign attachments would mix incompatible ownership and retention rules |
| Immutable outbound attempt records | Rich media can be dispatched, uncertain, reconciled, and retried | Mutable queue status alone loses retry history and cannot distinguish dispatch from confirmation |
| Shared queue for personal and Page sends | Both source types need the same idempotency and attachment lifecycle | Extending only the direct personal socket path would duplicate reliability logic and leave cross-source behavior inconsistent |
| Capability service | Facebook surfaces and configured limits can differ by source | Always-visible controls would allow payloads that one adapter cannot deliver |
