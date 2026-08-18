# Research: CRM Rich Messaging

## Decision 1: Use one persisted outbound queue for both source types

**Decision**: New one-to-one text and attachment sends enter the same server-side rich-message service and queue. The queue resolves the thread's stored source and dispatches a versioned envelope to the correct extension connection.

**Rationale**: Page text already uses MessageQueueRepository and QueueWorker, and campaign images already prove that attachment metadata can travel through this boundary. Personal text currently bypasses the queue, but media requires durable staging, idempotency, and confirmation states that should not be duplicated in a second path.

**Alternatives considered**:

- Keep direct personal SEND_MESSAGE and add media fields: rejected because retries, attachment lifecycle, and uncertain confirmation would diverge from Page behavior.
- Send attachments directly from the browser UI to the extension: rejected because it trusts browser routing, cannot safely persist/retry, and loses server-side validation/audit.

## Decision 2: Keep two source adapters behind one contract

**Decision**: The extension keeps separate personal Messenger and Page Business Suite adapters, but both consume the same rich-message envelope and return the same dispatch result.

**Rationale**: The Facebook surfaces use different tabs, thread identifiers, and composers. The current project already performs exact Page/tab role checks and separate personal tab selection. Hiding this difference behind one envelope gives the CRM a consistent experience without pretending the browser surfaces are identical.

**Alternatives considered**:

- Replace both paths with Meta's official Messenger Platform Send API: rejected for this increment because Meta's Page API requires a Page/app, pages_messaging permission, and messaging-window eligibility, while it does not provide the existing personal-account workflow.
- Build one generic DOM selector set: rejected because a selector that is valid on Messenger can target the wrong element in Business Suite and weaken identity guarantees.

## Decision 3: Start with one attachment and an 8 MiB limit

**Decision**: Version one accepts one JPEG, PNG, WebP, or PDF of at most 8 MiB per message, with optional text. Capability flags remain off per source/MIME pair until live acceptance passes.

**Rationale**: Existing campaign image validation and the current WebSocket base64 envelope already use an 8 MiB source limit. Meta states that current Messenger clients can send files up to 100 MB and common Word/PDF/Excel formats, but carrying a 100 MB file as base64 would expand memory and timeout risk, and the Page Business Suite path still needs live proof for generic files.

**Alternatives considered**:

- Advertise Messenger's 100 MB limit immediately: rejected until backend memory, WebSocket frame, browser staging, Page parity, and confirmation tests pass.
- Enable all common document extensions: rejected because extension-only validation is unsafe and each source/MIME pair needs actual dispatch and recipient-download proof.
- Multiple attachments: deferred because the existing queue and confirmation logic are single-attachment shaped and reliable correlation is the priority.

## Decision 4: Use a maintained React emoji picker and transmit native Unicode

**Decision**: Add emoji-picker-react 4.x, render it lazily, and insert the selected native Unicode sequence at the textarea selection. Store recent choices locally in the CRM.

**Rationale**: The reviewed picker supports search, categories, recent/frequent items, skin tones, lazy loading, and native emoji output. Unicode can use the existing text transport and CRM history schema. This avoids maintaining a partial emoji catalog.

**Alternatives considered**:

- Build a small hard-coded grid: rejected because search, skin tones, combined sequences, and catalog maintenance would quickly become incomplete.
- Send Facebook sticker assets for emoji: rejected because stickers are a different media operation and are out of scope.

## Decision 5: Create a separate one-to-one attachment lifecycle

**Decision**: Add outbound_attachments and outbound_attempts rather than reuse campaign_attachments. Store validated files under data/outbound-attachments using a checksum-derived storage name while retaining a sanitized display name.

**Rationale**: Campaign uploads are tied to a draft campaign message and can be reused across many recipients. A one-to-one attachment is bound to one thread, expires if abandoned, and is consumed by one logical outbound message. Separate ownership prevents accidental cross-recipient reuse.

**Alternatives considered**:

- Reuse campaign_attachments with nullable campaign ids: rejected because it weakens foreign-key meaning and mixes incompatible cleanup policies.
- Store bytes in SQLite: rejected because attachment size would inflate the database and backups and complicate streaming/download behavior.

**Shared validation code**: campaign_attachments already exists (`CampaignAttachmentService.js`) and performs the same class of checks this feature needs: MIME/signature detection, size limits, checksum computation, and storage-path safety. The two features MUST NOT duplicate this logic. Extract the byte-signature/checksum/safe-path validation into a shared module (for example `src/server/services/attachmentValidation.js`) used by both `OutboundAttachmentService` and `CampaignAttachmentService`; only ownership, lifecycle, and table rows stay separate.

## Decision 6: Validate bytes and constrain storage paths

**Decision**: Validate declared MIME type and magic bytes, enforce a non-empty maximum size, compute SHA-256, sanitize display names, generate storage names from the checksum, and verify every resolved path remains below the configured root. Initial signatures cover JPEG, PNG, WebP, and PDF.

**Rationale**: File extensions and browser-provided MIME values are untrusted. Server-side signature and path validation prevents renamed executables, traversal, and unintended file reads. Checksum metadata also supports integrity diagnostics and safe cleanup.

**Alternatives considered**:

- Trust the input accept attribute: rejected because it is only a UI hint.
- Send the browser File object directly without staging: rejected because retry and reconnect would lose the bytes.

## Decision 7: Separate dispatch from confirmed delivery

**Decision**: Extension results are dispatched or rejected. A message becomes sent only when Page webhook or DOM observation yields a real Facebook message identity with matching thread/media evidence. Missing confirmation becomes uncertain and retry performs reconciliation first.

**Rationale**: Existing text adapters already report COMPOSER_DISPATCHED_WAITING_CONFIRMATION after Enter. Media-only messages have no text identity, so marking them sent at dispatch would create false positives and unsafe retries.

**Alternatives considered**:

- Treat successful file-input change plus Enter as sent: rejected because Facebook can still reject upload or navigation can target an unexpected composer.
- Automatically resend on timeout: rejected because the original send may have succeeded and would be duplicated.

## Decision 8: Capability-gate rollout by source and MIME type

**Decision**: Capabilities are derived from configured policy, source type, current extension connection, and a verified adapter matrix. UI buttons remain visible for a consistent layout but are disabled with an explanation when the selected source is not ready.

**Rationale**: Personal Messenger and Business Suite can change independently. Failing closed avoids silently dropping the attachment or sending from another identity while allowing each adapter increment to be tested safely.

**Alternatives considered**:

- Hide unsupported controls: rejected because operators cannot understand why features appear inconsistently.
- Enable based only on source type: rejected because connection health and adapter/MIME verification also matter.

## Decision 9: Supply attachment bytes via CDP file-chooser interception, not DOM input injection

**Decision**: Live testing against the current Business Suite composer (2026-08) found zero `<input type="file">` elements in the DOM before or after triggering the attach icon; the icon opens the OS-native file chooser directly (consistent with the browser's File System Access API rather than a classic file input). The `DataTransfer`/hidden-input technique the campaign feature originally used for Page images does not apply here. Instead, the extension now uses `chrome.debugger` (already used for trusted Enter/text dispatch) to call `Page.setInterceptFileChooserDialog(true)`, dispatches a CDP-trusted mouse click on the attach control, and answers the resulting `Page.fileChooserOpened` event - which carries the hidden file input's `backendNodeId` - with `DOM.setFileInputFiles({ files: [localPath], backendNodeId })`. (A first live attempt on 2026-08-12 called a `Page.handleFileChooser` method that does not exist in the Chrome DevTools Protocol - CDP error `-32601 Method not found` - and was corrected to `DOM.setFileInputFiles` after confirming the real fulfillment command against the live composer.) This requires a real local file path, not bytes, which the backend can provide directly because the extension and backend always run on the same machine; the WebSocket envelope's attachment field changed from `data_base64` to `local_path` accordingly.

**Rationale**: A plain `element.click()` dispatched via `chrome.scripting.executeScript` is not a trusted user gesture and cannot satisfy the activation requirement of a native/File-System-Access-style file chooser; only a CDP-dispatched input event is treated as trusted. File-chooser interception works regardless of whether the underlying trigger is a classic `<input type="file">` or the newer picker API, so it is robust to Facebook changing this implementation detail again.

**Alternatives considered**:

- Keep looking for a hidden `<input type="file">` with a longer poll: rejected after live testing showed the element never exists, on a fresh page load or after cancelling the native dialog - this was a technique mismatch, not a timing race.
- Simulate a `drop` `DragEvent` with a synthetic `DataTransfer` onto the composer/message area: considered as a lower-effort alternative, but depends on whether Facebook's current composer still honors drag-and-drop, which was not confirmed; CDP file-chooser interception is a general Chromium capability that does not depend on Facebook's drop-zone implementation.
- Write bytes to a temp file via `chrome.downloads` before handing a path to CDP: rejected as unnecessary - the backend already persists the validated upload under `data/outbound-attachments/` before the extension ever sees it, so a real path already exists and needs no re-staging on the extension side.

## External references reviewed

- Meta's Messenger Platform collection describes Send API support for text and attachments and requires a Page, pages_messaging permission, and an eligible messaging window: https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api
- Meta's Messenger product announcement states that Messenger supports files up to 100 MB, including Word, PDF, and Excel: https://about.fb.com/news/2024/04/hd-photos-shared-albums-and-more-on-messenger/
- emoji-picker-react documents search, recent items, skin tones, lazy loading, native styles, and current React usage: https://emoji-picker-react.vercel.app/

## Resolved unknowns

- Initial source coverage: both personal Messenger and Page are required for completion.
- Initial media set: JPEG, PNG, WebP, PDF.
- Initial limit: 8 MiB, configurable downward; increases require separate performance proof.
- Attachment count: one per logical message.
- Reaction scope: Unicode emoji and quick-like only; reactions on existing messages remain out of scope.
- Delivery truth: observed Facebook message identity, never dispatch alone.
