# Tasks: CRM Rich Messaging

**Input**: Design documents from specs/027-crm-rich-messaging/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rich-messaging.md, quickstart.md

**Tests**: Automated validation is required before each story checkpoint. Live Facebook checks remain explicitly unchecked until actually performed.

**Progress rule**: Tick a task only after its code and stated validation are complete. Do not bulk-mark planned work.

## Phase 1: Setup and workflow controls

**Purpose**: Prepare dependency, feature context, and trustworthy progress tracking.

- [x] T001 Verify Spec Kit feature context, complete requirements checklist, and existing ignore coverage in .specify/feature.json, specs/027-crm-rich-messaging/checklists/requirements.md, and .gitignore
- [x] T002 Add the emoji-picker-react dependency and lockfile update in package.json and package-lock.json
- [x] T003 Create rich-message test fixture documentation and safe fixture locations in tests/fixtures/rich-messaging/README.md

**Checkpoint**: Feature files, dependency, and test fixture rules are ready.

---

## Phase 2: Foundational attachment and persistence infrastructure

**Purpose**: Build shared byte validation, one-to-one attachment persistence, immutable attempt tracking, and versioned queue contracts.

**Critical constraints**:

- CampaignAttachmentService and OutboundAttachmentService MUST share attachmentValidation.js.
- Rich-message queue rows MUST leave message_queue.idempotency_key NULL.
- Rich-message idempotency MUST use outbound_attempts.idempotency_key only.

- [x] T004 [P] Add failing unit coverage for MIME/signature/checksum/safe-path behavior in tests/unit/attachmentValidation.test.js
- [x] T005 Implement shared JPEG/PNG/WebP/PDF signature, checksum, filename, and safe-path helpers in src/server/services/attachmentValidation.js
- [x] T006 Refactor src/server/services/CampaignAttachmentService.js to use src/server/services/attachmentValidation.js and keep existing campaign behavior passing
- [x] T007 [P] Add failing schema/repository tests for outbound_attachments, outbound_attempts, message linkage, queue contract_version, and NULL campaign idempotency in tests/integration/richMessagePersistence.test.js
- [x] T008 Add outbound rich-message schema and idempotent migrations in src/server/database/schema.sql and src/server/database/db.js
- [x] T009 [P] Implement attachment persistence methods in src/server/repositories/OutboundAttachmentRepository.js
- [x] T010 [P] Implement immutable attempt persistence and state transitions in src/server/repositories/OutboundAttemptRepository.js
- [x] T011 Extend src/server/repositories/MessageQueueRepository.js for contract v2 rich-message rows while always writing NULL to message_queue.idempotency_key
- [x] T012 [P] Add failing service tests for upload ownership, source capability, idempotent submit, and attachment-only messages in tests/integration/richMessageService.test.js
- [x] T013 Implement thread-bound staging and cleanup in src/server/services/OutboundAttachmentService.js
- [x] T014 Implement source capability derivation in src/server/services/RichMessageCapabilityService.js
- [x] T015 Implement atomic submit/retry orchestration in src/server/services/RichMessageService.js
- [x] T016 Add rich-message capabilities, upload, discard, authenticated content, SEND_MESSAGE v2, and RETRY_MESSAGE handlers in src/server/server.js
- [x] T017 Extend src/server/services/QueueWorker.js to dispatch versioned attachment envelopes and update outbound attempt states
- [x] T018 Run foundational tests and syntax checks for all Phase 2 files via npm run test:persistence and node --check

**Checkpoint**: A validated attachment can be staged, persisted, queued exactly once, and represented by immutable attempts without touching Facebook.

---

## Phase 3: User Story 1 - Emoji-rich CRM messages (Priority: P1) MVP

**Goal**: Insert/search/reuse native Unicode emojis and send a quick-like entirely from the CRM for both source types.

**Independent Test**: Insert standard, skin-tone, and combined emoji at different cursor positions; send normal emoji text and quick-like through personal and Page text routes without changing the visible sequence.

- [x] T019 [P] [US1] Implement lazy searchable emoji popover with categories/recent/skin tones in src/client/components/EmojiPickerPopover.jsx
- [x] T020 [US1] Add cursor-aware emoji insertion, focus restoration, Escape handling, and quick-like submit in src/client/components/MessageComposer.jsx
- [x] T021 [US1] Extend optimistic payload and realtime reconciliation for SEND_MESSAGE v2 text/emoji sends in src/client/App.jsx
- [x] T022 [US1] Validate Unicode and quick-like behavior with npm run build:ui, server/extension syntax checks, and documented manual checks in specs/027-crm-rich-messaging/quickstart.md

**Checkpoint**: User Story 1 is independently usable with no attachment.

---

## Phase 4: User Story 2 - Images from CRM to Page and personal Messenger (Priority: P1)

**Goal**: Select, preview, remove, send, and confirm one JPEG/PNG/WebP with optional caption on both source types.

**Independent Test**: Send image-only and image-plus-caption from a Page and personal conversation, with correct identity and no duplicate text/media.

### Page increment (not blocked by spec 025)

- [x] T023 [P] [US2] Implement image/file draft preview and validation UI in src/client/components/AttachmentPreview.jsx
- [x] T024 [US2] Add image selection, upload, removal, attachment-only submit, and draft preservation in src/client/components/MessageComposer.jsx and src/client/App.jsx
- [x] T025 [US2] Generalize Page attachment staging and v2 dispatch result handling in src/extension/background.js. Superseded by live testing on 2026-08-12: Business Suite's attach icon exposes no scriptable `<input type="file">` (confirmed live, before and after interaction) - it opens the OS-native file chooser directly. Reimplemented `stageBusinessSuiteAttachment` using CDP (`chrome.debugger`, already used for trusted Enter/text) to intercept the native chooser (`Page.setInterceptFileChooserDialog` + `Page.fileChooserOpened` + `Page.handleFileChooser`) and hand it a real local file path instead of injected bytes. The WebSocket envelope's `attachment.data_base64` field was replaced with `attachment.local_path` end-to-end (`QueueWorker.buildAttachment`, `validateRichQueuedEnvelope`, `contracts/rich-messaging.md`, `research.md` Decision 9) - the backend and extension always run on the same machine, so the staged file's path is directly usable. Automated tests updated and passing; live send through this new path has not yet been confirmed (see T054). Update 2026-08-12: first live attempt failed with CDP error `-32601 'Page.handleFileChooser' wasn't found` - that method does not exist. Corrected `stageBusinessSuiteAttachment` to call `DOM.setFileInputFiles({ files, backendNodeId })` using the `backendNodeId` carried on the `Page.fileChooserOpened` event (`DOM.enable` added alongside the existing `Page.enable`). `research.md` Decision 9 and `contracts/rich-messaging.md` updated to match. Re-run after the fix (2026-08-12, thread `100092115712908`, test conversation) succeeded: `DOM.setFileInputFiles` staged the file, the caption dispatched, and the Page DOM observer captured the outgoing text back with a real Facebook message id (`mid.$cAAQXQILUZ2SmJjnlAWf9PSUuf6-K`) - the CRM shows the message as sent (no retry state). This confirms one Page image-plus-caption row of the T054 matrix; the remaining rows (personal, PDF, image-only, disconnect, delayed confirmation, duplicate click) are still unverified and T054 remains unticked until all of them pass.

Update 2026-08-12 (second finding, reported by the operator's own manual live test): with an attachment staged, Business Suite's composer stayed a draft (file + caption present, nothing sent) after the automated attempt. First fix attempt added `findSendButtonCenter`/`dispatchTrustedClick`, searching for `[aria-label="Gửi"/"Send"]` and dispatching a CDP-simulated pixel-coordinate mouse click. The `[Retest 4 - click nut Gui thay vi Enter]` row that then showed `sent` was **not actually confirmation of this code path** - the operator clarified they clicked the real Send button themselves out of impatience while waiting, and separately pointed out that Enter does normally work fine for sending (the "Enter inserts a newline once an attachment exists" theory was never actually verified). Re-reviewing `handleSendMessage` (the already-proven personal-Messenger path, `background.js` ~line 618-726) showed the real proven pattern: search for the send control by its actual Facebook aria-label (`"Nhấn Enter để gửi"`, not "Gửi"/"Send"), call a plain in-page `sendButton.click()` (no CDP mouse simulation needed), and fall back to `dispatchTrustedEnter` only if that DOM click fails. Rewrote `handleSendPageMessage`'s submit step to follow this same pattern (removed the untested `findSendButtonCenter`/`dispatchTrustedClick` helpers) and re-tested live *without any manual interaction this time*: message `[Retest 5 - DOM click that button proven pattern]` (row 11087) reached `delivery_status: sent` with real `fb_message_id: mid.$cAAQXQILUZ2SmJqldyGf9WQOyh2Uz`, and the server log shows no "DOM click nút gửi thất bại" fallback line, confirming the DOM click succeeded on its own.
- [x] T026 [P] [US2] Add Page image queue/confirmation integration coverage in tests/integration/richMessageAttachments.test.js
- [x] T027 [US2] Enable Page image capability only after automated Page envelope/confirmation tests pass in src/server/services/RichMessageCapabilityService.js

### Mandatory personal-Messenger prerequisite from spec 025

- [x] T028 [P] [US2] Add deterministic concurrent tab-creation coordinator coverage in tests/unit/tabCreationCoordinator.test.js
- [x] T029 [US2] Implement reusable per-role in-flight tab creation lock in src/extension/tabCreationCoordinator.js and load it from src/extension/background.js
- [x] T030 [US2] Apply the lock with an inside-lock tab recheck to personal and Page creation branches in src/extension/background.js; update only actually completed items in specs/025-multi-account-reliability-hardening/tasks.md
- [x] T031 [US2] Validate the race fix with automated concurrency tests and node --check before starting personal attachment staging (63/63 tests pass, `node --check` clean on background.js and tabCreationCoordinator.js). Live two-caller race verification (spec 025 T005) remains unchecked and manual.

### Personal image increment

- [x] T032 [US2] Add personal Messenger image input discovery, exact tab/thread verification, staging, optional caption, and dispatched-only result in src/extension/background.js. Implemented `stagePersonalMessengerAttachment` (shares the CDP file-chooser core with Business Suite via a new `stageAttachmentViaFileChooser`), `handleSendPersonalMessageWithAttachment`, and a shared `typeAndSubmitComposer` (also refactored out of `handleSendPageMessage`). `validateRichQueuedEnvelope` extended to accept `personal_messenger` image attachments. Live testing on 2026-08-13 surfaced and fixed 3 real bugs before it worked, in order: (1) `getFacebookTab` (look-only) found no tab since this Chrome window only had a Business Suite tab open - switched to `ensureFacebookMessagesTab` (creates one if missing, matching the Page adapter's pattern); (2) the personal composer's real attach-icon aria-label is `"Đính kèm file có kích thước tối đa là ...MB"`, not any Business Suite label - fixed via a starts-with match on the size-independent prefix rather than an exact string (avoids depending on getting the trailing, size-dependent text byte-for-byte); (3) `thread_id` here is the CRM's compound `"account_id:psid"` but `ensureTabOnThread`'s matching only knows the plain PSID - added the same `recipientPsid` extraction `handleSendPageMessage` already does. Verified live, unaided (no manual clicks) after all three fixes: message `[Personal image test 6 - PSID extraction fix]` dispatched with `error=none`, and the Facebook DOM observer captured the exact caption back as a real outgoing message (`is_outgoing: true`, matching content, real timestamp) - the send mechanism itself is confirmed working. Note: the CRM's own bookkeeping does not yet mark this confirmed - see note below.
- [x] T033 [P] [US2] Add personal image contract/routing tests in tests/integration/richMessageRouting.test.js. 3 tests: capability enablement is per-adapter (personal on/off independent of Page), the v2 envelope for `personal_messenger` builds correctly and confirms via `OutboundConfirmationService`, and an image upload is rejected before queueing when the adapter's image flag is off.
- [ ] T034 [US2] Enable personal image capability only after automated adapter contract tests pass in src/server/services/RichMessageCapabilityService.js. Not enabled in `.env` - the live send (T032) worked, but confirmation matching does not yet upgrade the pending row to sent (see below), so an operator would see every personal image send stuck at "pending" forever. Enable only after that gap and/or a broader live matrix (more than one send) are addressed.
- [x] T035 [US2] Render pending/sent/failed image metadata and preview consistently in src/client/components/MessageBubble.jsx and src/client/components/MediaViewer.jsx. No source-specific change needed - both already render generically by `media_type`/`media_url` regardless of `source_type`, and this was independently confirmed working for Page images after the 2026-08-12 `media_url` signing fix; the same rendering path applies unchanged to personal.

**Checkpoint**: User Story 2's send mechanism is proven live for both sources. Remaining before this story is fully "done": the confirmation/idempotency gap below applies to both Page and personal identically and was deferred by the operator ("để sau, làm nốt ảnh cá nhân trước đã", 2026-08-13).

**Known gap (applies to both sources, not personal-specific)**: Live testing on both Page (2026-08-12) and personal (2026-08-13) found that a real Facebook confirmation for a rich-message attachment does not update the original pending `messages` row - it creates a **separate** row instead (via the legacy plain-text DOM-match path, which was never taught about the rich-message pending row's compound thread_id/content-with-attachment shape). Concretely for personal: sending `[Personal image test 6 - PSID extraction fix]` left row id 16455 (`thread_id: "100008005082872:969878666067566"`, `attachment_id` set) stuck at `delivery_status: pending` forever, while the DOM observer's confirmation created two new duplicate rows (ids 16456/16457, `thread_id: "969878666067566"` - note the different, bare-PSID thread_id - `delivery_status: sent`, no attachment). Root cause: `src/server/services/OutboundConfirmationService.js` (T042) exists and is unit-tested but is never called from `src/server/server.js`'s real NEW_MESSAGE/SEND_MESSAGE_RESULT handling (T043, still unchecked) - this is Phase 6 work, already deferred by the operator's own choice.

**Fixed separately (2026-08-13)**: the same live testing also surfaced that rich-message rows sorted to the very top of chat history (ahead of messages from days earlier) instead of the bottom, because `RichMessageService.submit()`'s INSERT never set `timestamp_ms`/`timestamp_source`, defaulting to `timestamp_ms = 0` (schema default) - and every history query sorts `ORDER BY timestamp_ms ASC` first, so `0` always sorts before any real timestamp. Confirmed this is independent of the confirmation gap above: even `OutboundConfirmationService.confirmObservation()` never touches `timestamp_ms`, so nothing would ever correct it after insert. Fixed by setting `timestamp_ms = Date.now()` / `timestamp_source = 'client_submit'` at submit time; added a regression test (`tests/integration/richMessageService.test.js`, "a new submit gets a real timestamp_ms and sorts after older history, not before it"). Not backfilled for already-existing test rows (e.g. message 16455) - test/debug data, not customer history.

---

## Phase 5: User Story 3 - PDF files from CRM to both sources (Priority: P1)

**Goal**: Send a validated PDF with a recognizable filename and optional caption through either source.

**Independent Test**: Send PDF-only and PDF-plus-caption through personal and Page adapters, download as recipient, and verify filename/checksum; spoofed PDFs fail before queueing.

- [ ] T036 [P] [US3] Expand validation/security fixtures for valid, corrupt, renamed, empty, and oversized PDFs in tests/unit/attachmentValidation.test.js
- [ ] T037 [US3] Generalize Page and personal attachment staging for application/pdf and filename preservation in src/extension/background.js
- [ ] T038 [P] [US3] Add PDF queue, adapter, filename, and unsupported-type tests in tests/integration/richMessageAttachments.test.js
- [ ] T039 [US3] Enable per-source PDF capability after automated source contract tests pass in src/server/services/RichMessageCapabilityService.js
- [ ] T040 [US3] Add PDF filename/download presentation in src/client/components/AttachmentPreview.jsx and src/client/components/MediaViewer.jsx

**Checkpoint**: PDF behavior is implemented for both adapters and remains capability-gated until live source verification.

---

## Phase 6: User Story 4 - Reliable delivery and safe recovery (Priority: P1)

**Goal**: Distinguish queued, dispatching, awaiting confirmation, sent, failed, and uncertain; retry only after reconciliation.

**Independent Test**: Exercise confirmed send, definitive rejection, timeout, delayed observation, duplicate confirmation, reconnect, and explicit retry without duplicate customer delivery.

- [ ] T041 [P] [US4] Add failing confirmation/idempotency/retry tests in tests/integration/richMessageConfirmation.test.js and tests/integration/richMessageIdempotency.test.js
- [ ] T042 [US4] Implement bounded media confirmation matching and atomic message/attempt/queue upgrade in src/server/services/OutboundConfirmationService.js
- [ ] T043 [US4] Integrate rich-message confirmation with NEW_MESSAGE and SEND_MESSAGE_RESULT processing in src/server/server.js
- [ ] T044 [US4] Implement uncertain timeout, reconcile-before-retry, and stable error mapping in src/server/services/RichMessageService.js
- [ ] T045 [US4] Render preparing/queued/awaiting/sent/failed/uncertain states and safe retry in src/client/App.jsx and src/client/components/MessageBubble.jsx

**Checkpoint**: Facebook observation, not Enter dispatch, is delivery truth and retries are idempotent.

---

## Phase 7: User Story 5 - Consistent cross-source composer (Priority: P2)

**Goal**: Keep one operator workflow while accurately exposing source-specific readiness and protecting thread-bound drafts.

**Independent Test**: Switch between Page/personal threads with empty and non-empty drafts; controls stay consistent, capabilities remain accurate, and no attachment is retargeted.

- [ ] T046 [P] [US5] Add capability and wrong-thread attachment tests in tests/integration/richMessageRouting.test.js
- [ ] T047 [US5] Load per-thread capabilities and expose actionable disabled reasons in src/client/App.jsx and src/client/components/MessageComposer.jsx
- [ ] T048 [US5] Implement explicit thread-switch guard and per-thread text draft retention in src/client/App.jsx and src/client/components/MessageComposer.jsx
- [ ] T049 [US5] Normalize history metadata, filenames, downloads, and status layout across sources in src/client/components/MessageBubble.jsx and src/client/components/MediaViewer.jsx

**Checkpoint**: Operators use one consistent composer without losing source correctness.

---

## Phase 8: Polish, cleanup, and release gates

**Purpose**: Retention, diagnostics, regression validation, and honest live acceptance tracking.

- [ ] T050 [P] Add staged/failed attachment expiry and reference-safe checksum cleanup coverage in tests/integration/richMessagePersistence.test.js
- [ ] T051 Implement attachment retention cleanup and startup scheduling in src/server/services/OutboundAttachmentService.js and src/server/server.js
- [ ] T052 Add feature flag/default configuration and diagnostic logging in src/server/server.js and .env.example. Partial 2026-08-12: discovered neither the plain `node src/server/index.js` entrypoint nor Electron's `require(serverPath)` ever loaded `.env` (no dotenv dependency, no `--env-file`) - every var in it, including the pre-existing `PAGE_TOKEN_SECRET`/`WEBHOOK_VERIFY_TOKEN`/`META_APP_SECRET`, was silently unset at runtime. Fixed by calling Node's built-in `process.loadEnvFile()` at the top of server.js; verified live that `RICH_MESSAGE_PAGE_IMAGE_ENABLED=true` in `.env` now reaches `RichMessageCapabilityService.getConfig()` and the `/api/threads/:id/rich-message-capabilities` response with no inline env var needed. Created `.env.example` documenting all `RICH_MESSAGE_*` flags. Diagnostic logging for rich-message dispatch/error paths is still not added.
- [ ] T053 Run node --check on every touched server/extension file, npm run test:persistence, and npm run build:ui
- [ ] T054 Execute the live two-source matrix in specs/027-crm-rich-messaging/quickstart.md and tick this task only after personal/Page emoji, image, PDF, failure, and duplicate cases actually pass
- [ ] T055 Reconcile all checkboxes in specs/027-crm-rich-messaging/tasks.md and prerequisite checkboxes in specs/025-multi-account-reliability-hardening/tasks.md against evidence; leave any unperformed manual work unchecked

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 starts immediately.
- Phase 2 depends on Phase 1 and blocks all attachment stories.
- Phase 3 depends on the SEND_MESSAGE v2 foundation but can complete before Facebook attachment work.
- Phase 4 Page work can start after Phase 2. Personal work is blocked until T028–T031 complete.
- Phase 5 depends on image staging patterns from Phase 4.
- Phase 6 depends on persisted attempts and at least one attachment adapter.
- Phase 7 depends on capabilities and attachment draft state.
- Phase 8 depends on all implemented story phases.

### User story dependencies

- US1 is independently deliverable after foundational contracts.
- US2 Page image is independently deliverable after Phase 2; US2 personal image additionally depends on the spec 025 tab race fix.
- US3 depends on US2 attachment staging but remains independently testable by PDF-only sends.
- US4 depends on outbound attempts/queue persistence and applies to all stories.
- US5 depends on capabilities from US1–US3.

### Parallel opportunities

- T004/T007/T009/T010/T012 target different test/repository files after interfaces are agreed.
- T019 can proceed alongside server attachment foundations.
- T023 and T026 can proceed while the Page extension adapter is updated.
- T028 and T036 use isolated test/helper files.
- T041 and T046 use separate integration suites.
- T050 can be written while UI polishing proceeds.

## Implementation Strategy

1. Deliver emoji/quick-like first without changing Facebook attachment behavior.
2. Build shared validation and durable attachment/attempt infrastructure.
3. Deliver Page images using the already-proven campaign image staging path.
4. Fix and validate the per-role tab-creation race before any personal attachment automation.
5. Deliver personal images, then PDF on both sources.
6. Add confirmation/retry hardening and cross-source UI consistency.
7. Keep live-only tasks unchecked until a real browser/recipient test is performed.

## Notes

- message_queue.idempotency_key remains campaign-only and NULL for every rich-message row.
- outbound_attempts.idempotency_key is the sole rich-message idempotency boundary.
- attachmentValidation.js is shared by campaign and one-to-one attachment services.
- Do not mark T054 complete from unit/integration tests; it requires the live Facebook matrix.
