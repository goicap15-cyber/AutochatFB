# Implementation Plan: Phone Capture Automation

**Branch**: `035-phone-capture-automation` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

Replace the CRM's broad, one-field phone regex with exact Vietnamese number normalization, immutable source evidence and protected manual contact data. Then add opt-in campaign reactions to stop future work or send one confirmed thank-you after phone capture.

## Technical Context

**Language/Version**: JavaScript, Node.js 24, React 19  
**Primary Dependencies**: Express, Socket.IO, better-sqlite3, React, Lucide, Tailwind utilities  
**Storage**: SQLite and forward-safe migrations in `src/server/database/`  
**Testing**: Node built-in test runner and Vite production build  
**Target Platform**: Local desktop CRM, supported Messenger/Page extension routes  
**Project Type**: Web application  
**Performance Goals**: No perceptible delay in ordinary incoming-message persistence or normal contact display.  
**Constraints**: Incoming customer text only; no carrier lookup; manual values protected; no recall of dispatched work; replay-safe outbound acknowledgement.  
**Scale/Scope**: Existing contacts, incoming messages and bulk campaigns only; no Facebook transport rewrite.

## Constitution Check

The project constitution is a placeholder. The plan follows active practical gates: migrations are forward-safe, parsing is isolated/testable, outbound confirmation is reused, persistence is auditable, and unrelated UI/transport code is untouched.

**Result**: Pass. Capture history and action records are required to distinguish evidence from the selected field and prevent duplicate campaign acknowledgements.

## Design Decisions

1. Put exact prefix data and pure normalization in one server utility; retain compatible email extraction.
2. Use a capture transaction that persists once, conditionally fills an empty contact phone, emits a minimal live event and only then invokes campaign policy.
3. Keep manual/legacy/confirmed contact values protected; expose different captures as dated candidates.
4. Store campaign policy per campaign, defaulting to `continue`.
5. Stop only recipient work not yet dispatched. Queue thank-you through the established outbound pipeline, keyed once by recipient/capture, and audit all outcomes.

## Review Findings — Risks to Address Before/During Implementation

Found while reviewing this plan against the current codebase, before any code was written. Each must be explicitly handled by the tasks below, not left to assumption.

1. **Resolve `thread_id` before writing captures.** The existing auto-lead branch this plan replaces (`server.js:790-799`) inserts into `contacts` keyed by the raw `m.thread_id` from the inbound message payload. For personal-Messenger messages observed via DOM (`content.js`), that raw value is the **bare PSID**, not the compound `<account_id>:<psid>` format that `contacts.thread_id`/`threads.id` actually use elsewhere — the exact mismatch already fixed once this session via `src/server/utils/threadIdResolver.js`'s `resolveInternalThreadId()` for rich-message confirmation. `PhoneCaptureService` (T006) MUST resolve the internal thread_id the same way before any capture/contact write, or captured numbers for personal-Messenger customers will attach to a phantom `contacts` row that never surfaces in the CRM. `data-model.md`/`contracts/phone-capture.md` should note this resolution step explicitly.

2. **Reuse the existing "fill-empty-only" SQL, don't route through `ContactService.update()`.** FR-006 ("fill an empty phone, never auto-replace a non-empty one") is already correctly implemented in the code being replaced: `COALESCE(NULLIF(excluded.phone,''), contacts.phone)`. `ContactService.update()` (the shared path used for manual/UI saves) uses the weaker `COALESCE(excluded.phone, contacts.phone)`, which only protects against a NULL incoming value — it silently overwrites whenever any non-empty value is supplied, including from automated capture. `PhoneCaptureService`/`ContactPhoneCaptureRepository` (T005/T006) MUST write phone updates with the same `NULLIF`-guarded pattern (or an equivalent explicit "only if currently empty" check), never by calling `ContactService.update({ phone: capturedNumber })` directly.

3. **Migration must explicitly backfill `phone_source`.** T003's migration should set `phone_source = 'legacy'` for every existing contact row where `phone IS NOT NULL AND phone != ''` at migration time — `data-model.md` states legacy values "become protected" but doesn't say this has to be an explicit backfill statement in the migration, not an assumption about column defaults.

4. **`message_id` is not guaranteed stable across DOM-observer replays — test this specifically.** FR-004/SC-005's replay-idempotency relies on the `message_id + normalized_phone` unique constraint. This session independently found that hash-based fallback `fb_message_id` values (`dom_<thread>_hash_X_Y`, generated when no native Facebook message id is attached yet) are **not always stable** across repeated DOM observations of the same logical message. T004's replay tests must specifically cover DOM-observer-sourced incoming messages replayed with a realistic (not synthetic/stable) id generation path, not just assume `message_id` is a clean, stable key.

5. **Campaign stop-vs-in-flight-dispatch race (T017) needs an explicit mechanism.** Acceptance Scenario 5 requires "never claims to recall" an already-dispatched message and stops only undispatched work. The plan and data-model acknowledge this ("in-flight work follows its existing settlement path") but don't specify how `CampaignRunner` avoids a check-then-dispatch race (a stop signal arriving between the runner's "is this recipient stopped?" check and the actual dispatch call). T017 should state the concrete guard (e.g., a DB-transaction-scoped status check immediately before dispatch, not a pre-loop check) rather than leave it to be discovered during implementation.

## Project Structure

```text
src/
├── server/
│   ├── database/schema.sql and db.js                # schema and migrations
│   ├── repositories/ContactPhoneCaptureRepository.js # new evidence boundary
│   ├── repositories/CampaignRepository.js            # policy/action persistence
│   ├── services/PhoneCaptureService.js               # new inbound transaction
│   ├── services/CampaignPhoneCaptureService.js       # policy action
│   ├── services/CampaignRunner.js                    # safe future-work suppression
│   ├── utils/vietnamPhone.js                         # new parser/allowlist
│   ├── utils/leadExtractor.js                        # compatible structured extraction
│   └── server.js                                     # message wiring/payloads
└── client/
    ├── App.jsx                                       # live capture reconciliation
    └── components/
        ├── LeadDetailsPanel.jsx                      # provenance/candidates
        ├── CampaignCreateModal.jsx                   # policy controls
        ├── CampaignComposer.jsx                      # policy summary/edit
        └── CampaignDetail.jsx                        # policy audit outcome

tests/
├── unit/vietnamPhone.test.js
├── unit/contactPhoneSelection.test.js
├── unit/campaignPhoneCapturePolicy.test.js
└── integration/
    ├── phoneCapturePersistence.test.js
    └── campaignPhoneCaptureFlow.test.js
```

## Implementation Steps

1. Build and test exact prefix configuration, formatting normalization and candidate boundaries.
2. Add migration-safe provenance/capture/action schema and repositories; protect legacy non-empty values.
3. Replace the inline inbound lead branch with idempotent capture processing and additive live payloads.
4. Add provenance/candidate display and deliberate selection while preserving manual edits, exports and existing contact filters.
5. Add campaign policy validation and safe stop/thank/status application on the existing queue/audit path.
6. Run focused tests, full persistence suite, UI build and all [quickstart](quickstart.md) scenarios.

## Complexity Tracking

| Added component | Why needed | Simpler alternative rejected because |
|---|---|---|
| Capture history table | Preserves source date/message and competing candidates | One phone field loses evidence and permits silent overwrite. |
| Campaign action table | Guarantees one auditable response through restart/retry | Transient inbound flags cannot prevent duplicate thank-yous. |
