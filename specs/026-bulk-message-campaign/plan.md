# Implementation Plan: Bulk Message Campaigns

**Branch**: `026-bulk-message-campaign` | **Date**: 2026-08-11 | **Spec**: [spec.md](spec.md)

## Summary

Add a campaign workflow that snapshots selected conversations, previews an explicit execution order, and sends text sequentially through the existing source/account routing. The MVP is Page-first and text-first. Attachments, monitoring, audit, and restart recovery are built on the same persisted campaign/recipient/attempt model; unsupported source/media combinations fail closed.

## Technical Context

**Language/Version**: Node.js 24.x, JavaScript; React 19 for the existing UI

**Primary Dependencies**: Express, Socket.IO, WebSocket extension bridge, better-sqlite3, Vite

**Storage**: Existing SQLite database plus server-managed media storage under `data/`

**Testing**: Node built-in test runner via `npm run test:persistence`, focused integration tests, `node --check`, and `npm run build:ui`

**Target Platform**: Existing Linux/Windows desktop backend and Chrome extension runtime

**Project Type**: Desktop/web CRM with an Express backend, React UI, and browser extension transport

**Performance Goals**: Maintain one active campaign attempt per campaign; preview 50 recipients without a full page reload; campaign status updates visible within one realtime event cycle

**Constraints**: Preserve existing one-to-one send behavior; never cross account/source boundaries; persist state before dispatch; do not rely on a moving inbox filter; respect configured pacing, caps, quiet hours, and retry limits; do not implement anti-abuse evasion

**Scale/Scope**: MVP supports a campaign of at least 50 recipients, one common text sequence, Page sources, and one sequential runner per campaign; media is incremental

## Constitution Check

The repository constitution currently contains placeholder principles and no enforceable project-specific MUST gates. No constitution violation is identified. The plan still applies the intended quality constraints: stateful operations are persisted, routing is explicit, and integration tests cover queue/recovery behavior.

## Architecture

### Boundaries

- **Campaign API/service** owns draft validation, lifecycle transitions, preview, and authorization checks.
- **Campaign repository** owns campaign, recipient, message, attachment, attempt, and audit persistence with atomic transitions.
- **Campaign runner** owns one active dispatch decision at a time, pacing, retry classification, and restart recovery.
- **Existing queue/adapter** remains the transport boundary for a single outbound attempt. It receives campaign metadata and an idempotency key but does not own campaign lifecycle.
- **React campaign UI** owns selection handoff, composition, preview, controls, progress, recipient results, and audit display.
- **Extension** only performs the source-specific send operation and reports a result; it does not choose another account or source.

### Ordering model

At draft creation, each selected thread receives a stable `selection_order`. Preview validates `start_position` and `direction`, then persists `execution_order`. The runner selects the next eligible recipient by `execution_order`, not by queue insertion time or live sidebar order.

### Reliability model

Every dispatch has a unique attempt/idempotency key. The recipient row and attempt row are written before transport dispatch. A restart reconciles `processing` attempts into `unknown` or a retryable state according to the recorded transport evidence; it never blindly re-sends an uncertain attempt.

### Media model

Attachments are server-managed uploads referenced by campaign messages. The source adapter reports supported media types before start. The first media increment should support only the type that can be validated end-to-end on the Page adapter; video/file and personal Messenger remain blocked until their adapters are proven.

## Project Structure

### Documentation

```text
specs/026-bulk-message-campaign/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/campaign-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source changes

```text
src/server/
├── database/schema.sql
├── repositories/CampaignRepository.js
├── repositories/MessageQueueRepository.js
├── services/CampaignService.js
├── services/CampaignEligibilityService.js
├── services/CampaignRunner.js
├── services/CampaignAttachmentService.js
├── services/CampaignRecoveryService.js
├── services/CampaignEventService.js
├── services/PageMessengerAdapter.js
└── server.js

src/extension/background.js

src/client/
├── App.jsx
├── components/CampaignCreateModal.jsx
├── components/CampaignComposer.jsx
├── components/CampaignDetail.jsx
└── components/CampaignRecipientTable.jsx

tests/integration/
├── campaignSnapshot.test.js
├── campaignExecution.test.js
├── campaignLifecycleContract.test.js
├── campaignAttachments.test.js
└── campaignAuditRecovery.test.js
```

**Structure Decision**: Extend the existing single-project CRM boundaries. Campaign state belongs in server repositories/services; transport changes remain in the existing queue and Page adapter; UI stays in the existing React component tree; tests use the current Node integration test style.

## Design Gates

- Campaign state transitions and idempotency must be tested before live dispatch is enabled.
- Recipient source/account routing is resolved from server-side thread data, never trusted from the browser selection payload.
- Pause/cancel behavior must be verified around an in-flight send.
- Restart recovery must distinguish confirmed, failed, and unknown attempts before retrying.
- Media must be capability-gated and rejected before any recipient dispatch when unsupported.
- The MVP must remain text-only if the attachment transport is not proven end-to-end.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Campaign recipient/attempt model | Per-recipient order, pause/resume, retry, audit, and restart recovery | A flat queue cannot represent immutable snapshots or safe lifecycle transitions |
| Campaign runner | Exactly-one active dispatch and recovery decisions | Directly inserting 50 queue rows cannot safely coordinate pause/cancel/retry |
| Attachment entity | Validate and reuse one upload across recipient attempts | Putting local file paths in queue rows is unsafe and non-reproducible |
