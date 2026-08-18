# Quickstart Validation: CRM Rich Messaging

## Purpose

Validate that staff can remain in the CRM while a personal Messenger account and a Facebook Page both deliver emoji, images, and PDF files to the intended customer with reliable status and no duplicate delivery.

## Prerequisites

- Node.js 24.x and project dependencies installed.
- CRM database initialized with one personal_messenger source and one page_messenger source.
- Chrome extension loaded and connected for the owner account of both test sources.
- A dedicated personal Messenger test conversation.
- A dedicated Facebook Page customer test conversation.
- Test recipient access to verify visible content and downloads.
- Feature flag enabled only in the test environment.
- Initial policy: JPEG, PNG, WebP, PDF; maximum 8 MiB.

Do not use real customers for adapter development or failure testing.

## Automated validation

Run from the repository root:

~~~bash
node --check src/server/server.js
node --check src/server/services/OutboundAttachmentService.js
node --check src/server/services/RichMessageService.js
node --check src/server/services/QueueWorker.js
node --check src/extension/background.js
npm run test:persistence
npm run build:ui
~~~

Expected:

- All syntax checks exit successfully.
- Attachment validation, routing, idempotency, confirmation, migration, and existing persistence tests pass.
- UI production build completes without warnings promoted to errors.

## Unit validation matrix

### Attachment validation

- Valid JPEG, PNG, WebP, and PDF signatures pass.
- Empty, truncated, and signature/MIME mismatch fixtures fail.
- Files at the configured maximum pass; one byte over fails.
- Filenames with spaces and Vietnamese characters produce safe recognizable names.
- Traversal names and absolute paths never affect storage location.
- Duplicate bytes produce the same checksum without granting cross-thread ownership.
- A staged upload cannot be sent from another thread.

### Emoji composer

- Selecting an emoji inserts at start, middle, and end of existing text.
- Selection replacement and cursor restoration work.
- Skin-tone and zero-width-joiner samples remain intact.
- Escape and click-outside close the picker and return focus.
- Quick-like sends one 👍 only when text and attachment are absent.

### Idempotency and state

- Two identical client_message_id submissions produce one message, one first attempt, and one queue row.
- Dispatch does not set delivery_status to sent.
- Confirmed Facebook identity sets sent once.
- Timeout becomes uncertain.
- Retry of uncertain runs reconciliation first.
- Reconnect and duplicate confirmation do not create a second message.

## Live two-source acceptance matrix

Use one small PNG and one small PDF with known checksums.

| Scenario | Personal Messenger | Facebook Page | Expected CRM result |
|---|---|---|---|
| Text plus standard emoji | Required | Required | Exact visible text; sent with real Facebook id |
| Combined/skin-tone emoji | Required | Required | Intended visible sequence preserved |
| Quick-like | Required | Required | One 👍 message |
| Image only | Required | Required | One image; no empty text bubble |
| Image plus caption | Required | Required | One intended operation; no duplicate caption |
| PDF only | Required | Required | Downloadable file with recognizable name |
| PDF plus caption | Required | Required | File and text both received |
| Double-click send | Required | Required | One customer-visible item |
| Disconnect before dispatch | Required | Required | Failed; draft retained; nothing received |
| Disconnect after dispatch | Required | Required | Awaiting/uncertain until reconciliation |
| Delayed confirmation | Required | Required | Never marked sent early |
| Wrong background tab identity | Required | Required | Rejected before staging; no cross-send |

Feature completion requires every Required cell to pass. Per-source capability flags stay disabled for any failing media row.

## Manual workflow

1. Start the backend with npm start and start the UI in the project's normal development or built mode.
2. Confirm the CRM source indicator shows the expected personal account or Page.
3. Open the emoji picker, insert multiple emoji forms, send, and verify the recipient.
4. Select an image, inspect preview/name/size, send without caption, and verify recipient plus CRM status.
5. Repeat the image test with a caption.
6. Select a PDF, verify filename/type/size, send without and with caption, then download it as the recipient and compare checksum.
7. Repeat steps 3–6 for the other source type.
8. Run the failure rows by disabling the extension, changing tabs, delaying observation, and repeating a client id in the controlled test environment.
9. Inspect CRM history and database attempt records; every visible send must trace to the correct source identity and real Facebook message id.

## Security checks

- Upload an executable renamed to .pdf: rejected before queueing.
- Upload HTML/SVG/script content through the image control: rejected.
- Request another thread's attachment id: forbidden.
- Request content after staged expiry: unavailable.
- Try to supply account_id, source_id, source_type, or page_id in SEND_MESSAGE: ignored/rejected; server-derived route wins.
- Tamper with the staged file on disk between queue and dispatch: byte-size/checksum mismatch fails the attempt before any Facebook interaction.

## Rollback

The rich-message feature flag disables upload and attachment submission while leaving legacy text sending available. Existing sent history remains readable. Rollback must not delete queued/uncertain attempts or their attachment bytes until reconciliation and retention policies complete.
