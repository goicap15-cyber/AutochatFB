# Implementation Plan: Multi-source Campaign Delivery

**Branch**: `038-multi-source-campaign` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

## Summary

Extend new bulk campaigns from their current Page-only restriction to safely deliver a mixed recipient snapshot through exact Page Messenger or personal Messenger identities. Route facts are captured by the backend, revalidated before each dispatch, delivered through the existing v2 queue envelope, and surfaced in preview/results. Personal recipients never inherit a Page id; no failed recipient falls back to another connected account or Page.

## Technical Context

**Language/Version**: JavaScript, Node.js 24, React 19

**Primary Dependencies**: Express, Socket.IO, better-sqlite3, Chrome extension bridge, Vite, Lucide/Tailwind utilities

**Storage**: SQLite campaign/source/thread/message queue tables; existing server-managed campaign media storage

**Testing**: Node built-in test runner (`npm run test:persistence`), focused integration tests, `node --check`, Vite UI build

**Target Platform**: Desktop CRM, connected Facebook personal Messenger and Business Suite Page extension tabs

**Project Type**: Web CRM with server, React client, and Chrome extension

**Performance Goals**: Keep one active attempt per campaign; recipient route status becomes visible in the same campaign update cycle; no additional client-side route lookup before send

**Constraints**: Persist before dispatch; source route derives only from backend data; preserve Page-only historic snapshots; source mismatch fails closed; confirmation stays evidence-based; respect existing pacing, caps, retry, pause/cancel and tab-identity safeguards; do not add anti-abuse evasion

**Scale/Scope**: Existing campaign cap and serial runner; new mixed Page/personal text support plus capability-gated campaign images; generic campaign files excluded

## Constitution Check

The repository constitution is presently a placeholder. Applied practical gates:

1. Server-owned source routing and immutable snapshots are mandatory.
2. Every transition from snapshot to extension queue requires persistence and integration coverage.
3. Cross-source identity, confirmation, and recovery must be tested; visual UI success is insufficient.
4. Existing spec 025 tab identity protection is a prerequisite for personal route dispatch.
5. Keep campaign and one-to-one rich-message idempotency models separate.

**Result: Pass with safeguards.** This feature reuses existing queue/extension boundaries rather than inventing a parallel personal sending path.

## Architecture and Research Decisions

1. **Route snapshot migration**: add nullable `source_type_snapshot`, `source_external_id_snapshot`, and source-label snapshot fields to campaign recipients. New feature-version campaigns populate them from server-resolved thread/source data; legacy rows remain untouched.
2. **Shared route capability**: extract/reuse a backend-only capability resolver from rich messaging so campaign eligibility and dispatch ask the same question about exact account/source connection and image support. Campaigns never trust a browser-supplied route.
3. **Eligibility**: replace only the Page-only rejection with explicit Page/personal validation. Text is eligible for an active, connected exact route. Attached images need the matching route image capability. Unsupported is recipient-local and visible before start.
4. **Dispatch**: make `enqueueCampaignMessage` consume the recipient snapshot and emit the valid v2 queue contract. A Page includes its snapshot Page id; personal has null Page id. QueueWorker and extension retain their existing route validation/switch.
5. **Reliability**: preserve serial runner ordering, idempotent campaign attempts, recovery, pause/cancel, and evidence-backed confirmation. Route errors have source-specific codes and never invoke fallback.
6. **UI**: remove the Page-only selection narrative; show source counts and badges in create/preview/detail/results, including actionable disconnected/capability explanations.

## Project Structure

```text
specs/038-multi-source-campaign/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/multi-source-campaign.md
└── checklists/requirements.md

src/server/
├── database/campaignSchema.sql and database/db.js
├── repositories/CampaignRepository.js, MessageQueueRepository.js
├── services/CampaignEligibilityService.js, CampaignService.js,
│   CampaignRunner.js, CampaignEventService.js, CampaignRecoveryService.js
├── services/RichMessageCapabilityService.js (shared resolver extraction)
├── services/QueueWorker.js
└── server.js

src/client/
├── components/CampaignCreateModal.jsx
├── components/CampaignDetail.jsx
├── components/CampaignRecipientTable.jsx
└── components/CampaignComposer.jsx

src/extension/background.js

tests/integration/
├── campaignSnapshot.test.js
├── campaignExecution.test.js
├── campaignAttachments.test.js
├── campaignAuditRecovery.test.js
├── richMessageRouting.test.js
└── multiSourceCampaign.test.js (new)
```

**Structure Decision**: Extend the current campaign/repository/queue/extension boundaries. One shared backend capability resolver prevents campaign and one-to-one rich messaging from duplicating or disagreeing about route readiness.

## Implementation Steps

1. Add pure source-route and capability decision logic with tests, including explicit user-facing reason mapping. Preserve the page tab-identity guard as an external prerequisite and validate the same personal guard.
2. Add only additive campaign recipient snapshot columns and repository mappings. Implement legacy-row compatibility without a destructive data migration.
3. Update campaign eligibility/snapshot creation/revalidation to accept Page and personal routes, compare all saved route facts, and validate content capability per recipient.
4. Update campaign dispatch to use the saved v2 route envelope. Keep campaign attempt idempotency and verify personal sends have no Page id while Page sends require one.
5. Generalize campaign UI selection, preview, counters, recipient table, details, audit labels, and errors for source-aware mixed outcomes.
6. Add focused integration/unit coverage for mixed dispatch, source mismatch, missing connection, attachment capability variance, confirmation, retry/recovery, and historical Page-only compatibility. Run the full persistence suite and UI build before marking work complete.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Complete recipient route snapshot | Ensures review-time identity is the dispatch-time identity | Looking up current source data only can silently change sender after the campaign is reviewed |
| Shared route capability resolver | Page/personal capability decisions must agree across campaign and composer | Two independent source checks would drift and create unsafe false eligibility |
| Source-aware UI rows/counts | Operators need to understand mixed outcomes without logs | Hiding type in audit payload makes recipient failures unactionable |

## Post-design Constitution Check

**Pass.** The plan uses an additive migration, retains transport separation, reuses verified extension routing, preserves existing state-machine guarantees, and requires coverage for identity and confirmation failure modes.
