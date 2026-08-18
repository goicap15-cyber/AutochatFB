# Implementation Plan: Campaign File Transport

**Branch**: `040-campaign-file-transport` | **Date**: 2026-08-17 (revised) | **Spec**: [spec.md](spec.md)

## Summary

Extend campaign attachments (spec 039, image-only) to arbitrary validated files and folder selections. Multiple selected files or one selected folder become one attachment manifest per campaign message; a folder is always packaged into one ZIP. Every recipient is revalidated against its immutable Page/personal route before dispatch, and a file is marked sent only after a matching Facebook DOM confirmation. Personal arbitrary-file delivery stays behind its own feature flag, independent of personal image, until live-verified (FR-018).

**Revision note (2026-08-17)**: this plan was previously left as an unfilled template while `tasks.md`/some `[X]` code was already written against it. That produced drift: several checked tasks in `tasks.md` turned out to be only partially done when the actual code was inspected (see `tasks.md` for the corrected status). This revision replaces the template with the real technical context and corrects the plan to match what is actually in the repository today, per FR-by-FR verification done in this session. No feature code was changed as part of this revision — planning only.

## Current State (verified against code, not against `tasks.md` checkboxes)

- `CAMPAIGN_FILE_ENABLED` is unset in `.env` → the feature is globally off. Nothing below is reachable in production today.
- `src/server/services/attachmentValidation.js` validates an arbitrary single file (MIME/signature check bypass via `allowAnyFile`, executable-extension rejection, size/empty checks) — but has **no archive-traversal, symlink, or zip-entry validation** (FR-005 requires this; it does not exist for any archive type yet).
- `src/server/services/CampaignAttachmentService.saveUploads` loops `saveUpload` per file. Each file becomes its own independent `campaign_attachments` row sharing a `campaign_message_id` — there is **no manifest grouping, no `kind` field, no ZIP step**. Multiple files are silently accepted as separate rows rather than rejected (the original task note "reject multi-file manifests until queue manifest support is complete" was not implemented either way).
- **No ZIP/archive library is used anywhere in the repo** (`archiver`, `adm-zip`, `yazl`, `jszip` — none present in `package.json` or source). FR-002 (folder → ZIP) has zero implementation.
- `src/server/database/schema.sql` is unchanged from spec 039: one `campaign_attachments` row per file, `media_type CHECK(IN ('image','file'))`, no manifest/archive/ZIP-provenance columns.
- `src/client/components/CampaignComposer.jsx` attachment input is still exactly spec 039's single-image picker (`accept="image/jpeg,image/png,image/webp"`, no `multiple`, no `webkitdirectory`, gated on `imageEnabled` not a file flag). No multi-file or folder UI exists anywhere in the client.
- `src/extension/queueEnvelopeValidation.js` (new, uncommitted) validates one `attachment` object with a generic-file branch (`isGenericFile`) — it does not validate an array/manifest.
- `QueueWorker.buildAttachment()` and `message_queue` both represent exactly one attachment per queue row; there is no way to carry "3 files in one message" yet.
- `src/server/services/CampaignRouteService.js`: **fixed this session** — `inspectThreadRoute()` now computes `capabilities.file` independently from `capabilities.image` (reading `RICH_MESSAGE_PAGE_FILE_ENABLED`/`RICH_MESSAGE_PERSONAL_FILE_ENABLED` + `CAMPAIGN_FILE_ENABLED`), and `revalidateSnapshotRecipient()` gates on the correct capability per `attachmentMediaType`. Before this fix, a file attachment was incorrectly gated by the *image* capability, which would have let personal-file delivery through as soon as personal-image was enabled — a direct FR-018 violation. This is the one piece of T013 that is genuinely done; the rest of T013 (eligibility-service-level file reasons surfaced to the UI) is not.
- Test coverage: only `tests/unit/attachmentValidation040.test.js` exists (2 tests: arbitrary-MIME acceptance, executable rejection). None of `campaignFileTransport.test.js`, `campaignFilePersistence.test.js`, `campaignFileTransportUi.test.js` exist.

## Technical Context

**Language/Version**: JavaScript, Node.js 24, React 19

**Primary Dependencies**: Express, Socket.IO, better-sqlite3, Chrome extension bridge (CDP `Page.handleFileChooser`), Vite. A ZIP-creation dependency does not exist yet and must be added (see Architecture Decision 2).

**Storage**: SQLite (`campaign_attachments`, `message_queue`, `campaign_attempts`) plus server-managed staged files under `data/campaign-attachments/`. A folder selection additionally needs a server-managed staging area for the generated ZIP (reuse the same directory, one ZIP file per manifest).

**Testing**: Node built-in test runner (`npm run test:persistence`), focused integration tests under `tests/integration/`, `node --check` for server/extension files, `npm run build:all` for the client + extension bundle.

**Target Platform**: Desktop CRM (Electron), Chrome extension driving Facebook Business Suite (Page) and personal Messenger tabs on the same machine as the server.

**Project Type**: Web CRM — single repo with `src/server` (Express + WS), `src/client` (React/Vite), `src/extension` (Chrome extension, CDP-driven). There is no separate frontend/backend project split to choose between; this plan extends the existing single-project layout only.

**Performance Goals**: Validate and ZIP-package before queueing (never block the serial campaign runner mid-dispatch); one ZIP build per folder selection, not per recipient; confirmation correlation stays O(1) per thread (reuse the recency-bounded lookup already added in `OutboundDomCorrelationService` this session, extended to be manifest-aware).

**Constraints**: Server remains the sole authority for route/capability decisions (never trust a client-declared route or file type); no destructive schema migration (additive columns only, matching the pattern already used for spec 038's recipient snapshot columns); campaign queue idempotency stays separate from one-to-one rich-message `outbound_attempts` idempotency; personal arbitrary-file delivery stays off (`RICH_MESSAGE_PERSONAL_FILE_ENABLED` unset) until a live verification pass, mirroring how spec 039 gates personal image.

**Scale/Scope**: Existing campaign send-cap/serial-runner/pacing model is unchanged. New scope is strictly: arbitrary-file validation + folder-to-ZIP packaging + manifest-aware queue envelope + manifest-aware confirmation. Does not replace spec 039's image path (FR-017) and does not touch spec 038's routing/eligibility logic beyond the file/image capability split already fixed.

## Constitution Check

*GATE: informal — this repository's `.specify/memory/constitution.md` is a placeholder, so the practical gates below are the ones actually enforced by review in this codebase (matching the pattern already used in spec 038's plan).*

1. Server remains the sole authority for route and file-capability decisions — never trust a client-declared MIME type or route.
2. Every new persistence path (manifest rows, ZIP staging) needs integration coverage before being wired into the live dispatch path — no "trust the UI looks right" sign-off.
3. Personal arbitrary-file delivery must stay behind its own flag, independently testable/toggleable from personal image, per FR-018.
4. Reuse spec 027's attachment validation and spec 038's route-snapshot/revalidation machinery — do not fork a parallel campaign-only validator or router.
5. Campaign and one-to-one rich-message idempotency models stay separate (existing rule, unchanged).

**Result: Pass with safeguards**, contingent on closing the archive-validation gap (FR-005) before any ZIP feature ships, and on the file-vs-image capability separation (now fixed) being what future eligibility/UI work is built on top of.

## Project Structure

```text
specs/040-campaign-file-transport/
├── spec.md
├── plan.md                 # this file
├── research.md
├── data-model.md            # describes the TARGET manifest shape - not yet in schema.sql
├── quickstart.md
├── contracts/campaign-file-transport.md   # TARGET queue/confirmation contract - not yet implemented
└── checklists/requirements.md

src/server/
├── database/schema.sql, database/campaignSchema.sql   # needs additive manifest/ZIP columns (T005)
├── repositories/CampaignRepository.js                  # needs manifest-aware attachment queries
├── services/attachmentValidation.js                    # needs archive traversal/symlink checks
├── services/CampaignAttachmentService.js                # needs manifest grouping + ZIP creation
├── services/CampaignRouteService.js                     # file/image capability split - DONE this session
├── services/CampaignEligibilityService.js                # needs file-specific eligibility reasons
├── repositories/MessageQueueRepository.js, services/QueueWorker.js   # needs manifest-shaped envelope
├── services/OutboundConfirmationService.js, services/OutboundDomCorrelationService.js  # needs per-manifest correlation
└── server.js                                             # multipart manifest endpoint, confirmation handling

src/client/
├── components/CampaignComposer.jsx        # single-image input only - needs multi-file + folder picker
├── components/CampaignDetail.jsx
└── components/CampaignRecipientTable.jsx

src/extension/
├── queueEnvelopeValidation.js              # validates one attachment - needs manifest/array support
└── background.js                            # stageBusinessSuiteAttachment/stagePersonalMessengerAttachment - needs generic multi-file dispatch

tests/
├── unit/attachmentValidation040.test.js (exists, partial)
└── integration/campaignFileTransport.test.js, campaignFilePersistence.test.js, campaignFileTransportUi.test.js (do not exist yet)
```

**Structure Decision**: Extend the existing campaign/repository/queue/extension boundaries in place — the same ones spec 038 and spec 039 already extended. No new service layer or parallel pipeline; a "manifest" is modeled as an additive shape on top of the existing single-attachment tables and queue row, not a new subsystem.

## Architecture Decisions

1. **Manifest representation**: keep `campaign_attachments` as one row per physical file (simplest, keeps existing checksum/validation-status machinery working unchanged), and add a `campaign_attachment_manifests` grouping row (`id`, `campaign_message_id`, `kind` [`files`|`folder_zip`], `item_count`, `total_bytes`, `archive_name` nullable) that individual attachment rows reference via a new `manifest_id` column. This avoids rewriting `campaign_attachments` semantics for the already-shipped image path (spec 039) while giving `enqueueCampaignMessage`/`QueueWorker` one manifest id to carry per queue row instead of a bare `attachment_id`.
2. **ZIP library**: none is installed. Recommend `yazl` (zero runtime dependencies, streaming ZIP writer, ~a few hundred KB) over `archiver` (heavier, pulls in more transitive deps) given this repo's otherwise lean `package.json`. Record the final choice in `research.md` once picked — do not add the dependency as part of this planning pass.
3. **Folder validation**: reuse `attachmentValidation.js`'s per-file checks for every file discovered under the selected folder, then additionally reject: symlinks (never follow), any resolved path escaping the selected folder root, and any single file that individually fails existing validation — reject the whole folder selection rather than silently dropping one bad file, so the operator sees one clear error instead of a silently incomplete ZIP.
4. **Queue envelope**: extend the v2 envelope's `attachment` field to `attachment_manifest` (per `contracts/campaign-file-transport.md`) only when `manifest_id` is present; keep the existing single-`attachment` shape for spec 039 image sends unchanged so no image regression is possible. `QueueWorker.buildAttachment()` gains a manifest branch that verifies every file's checksum, not just one.
5. **Confirmation**: extend `OutboundDomCorrelationService.matchPendingImageOutbound` (added this session, currently keyed only on "has an attachment_id, no media-type filter") into a manifest-aware `matchPendingFileOutbound` that also accepts a manifest id, still recency-bounded. Do not invent a third parallel matching function — generalize the existing one once the manifest id exists to key against.
6. **Personal file flag**: `RICH_MESSAGE_PERSONAL_FILE_ENABLED` already exists as a read config value (`CampaignRouteService.getRichConfig()`); it is correctly wired into `capabilities.file` after this session's fix. No further flag plumbing is needed — only the live-verification checklist (SC-007) gates flipping it to `true` in `.env`.

## Implementation Steps (for a future `/speckit.tasks` pass or manual execution)

1. Add the archive-traversal/symlink/zip-entry validation gap in `attachmentValidation.js` (FR-005) — this blocks everything else safely, since folder ZIPs cannot be trusted without it.
2. Add the additive `campaign_attachment_manifests` table + `manifest_id` column (Architecture Decision 1), with repository methods to create/read a manifest and its member attachments.
3. Add folder selection + ZIP packaging (`CampaignAttachmentService`), using the chosen ZIP library, producing one manifest row + one archive attachment row per folder selection.
4. Update `enqueueCampaignMessage`/`MessageQueueRepository`/`QueueWorker` to carry and verify a manifest instead of (or in addition to) a single attachment.
5. Update `queueEnvelopeValidation.js` and `background.js` to stage and dispatch every file in a manifest through the correct adapter (Page vs personal), still fail-closed per FR-008/FR-014.
6. Extend `OutboundDomCorrelationService`/`OutboundConfirmationService` for manifest-aware confirmation correlation (Architecture Decision 5).
7. Build the `CampaignComposer.jsx` multi-file + folder picker, and the `CampaignDetail.jsx`/`CampaignRecipientTable.jsx` manifest display (file count, names, per-file/archive state).
8. Write the integration tests named in `tasks.md` (T008, T012, T017, T021) against the real dispatch/confirmation path — not just upload/validation, mirroring the gap already found and closed for spec 039's checksum verification this session.
9. Run `npm run test:persistence` + `npm run build:all`, keep `RICH_MESSAGE_PERSONAL_FILE_ENABLED`/`CAMPAIGN_FILE_ENABLED` off until the live verification checklist (quickstart.md) passes for personal file delivery specifically.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Separate `campaign_attachment_manifests` table instead of reshaping `campaign_attachments` | Keeps spec 039's already-shipped single-image path byte-for-byte unchanged | Adding `kind`/`manifest_json` directly onto `campaign_attachments` would require every existing image-attachment reader to handle a now-optional grouping concept it never needed |
| New ZIP dependency (`yazl`) | FR-002 has no in-repo way to create ZIP archives today | Hand-rolling ZIP writing is a well-known source of subtle corruption bugs; not worth it for a solved problem |
| Manifest-aware confirmation matching generalized from the existing image matcher | FR-012 requires exactly-one-manifest correlation | A third bespoke matching function (beyond the existing text and image matchers) would fragment the exact logic this session already consolidated into one service |

## Post-design Constitution Check

**Pass, contingent.** The plan is additive (new table/column, no destructive migration), keeps spec 039's image path untouched, reuses spec 027/038's validation and routing machinery, and requires the archive-safety gap to close before folder ZIP work starts. Personal file delivery remains flagged off until independently live-verified, matching FR-018/SC-007.
