# Implementation Plan: Reliable CRM-to-Messenger Outbound Messaging

**Branch**: `004-reliable-outbound-messaging` | **Date**: 2026-08-03 | **Spec**: [spec.md](spec.md)

## Summary

Make CRM outbound text truthful and end-to-end reliable. Preserve the existing Socket.IO → server WebSocket → extension → Facebook topology, but add a strict outbound state machine, safe Facebook response diagnostics, official-ID correlation, idempotent acknowledgement handling, and retryable UI states.

## Technical Context

**Language/Version**: Node.js 24, browser JavaScript, React
**Primary Dependencies**: `ws`, Socket.IO, `better-sqlite3`, Chrome MV3 extension APIs
**Storage**: SQLite (`messages`, `threads`, versioned migrations)
**Testing**: Node built-in test runner via `npm run test:persistence`; contract/integration tests plus manual Facebook E2E
**Target Platform**: Linux Node server and Chrome Facebook/Messenger tab
**Project Type**: React desktop/web CRM with Node backend and browser extension
**Performance Goals**: Dispatch acknowledgement classification within 2 seconds for normal connected sends; no duplicate row on repeated events
**Constraints**: Never expose cookies/tokens in logs; do not auto-resend pending messages after reload; preserve existing history persistence and migration safeguards
**Scale/Scope**: Text messages in one-to-one CRM threads for the MVP; attachments/broadcast excluded

## Constitution Check

The repository constitution is still a placeholder, so no project-specific gate can be evaluated. This plan adopts the existing project safeguards: tests for persistence/integration, versioned SQLite changes, structured bounded logs, and backward-compatible event handling. No new external service is introduced.

## Research Summary

- HTTP success is insufficient; only an official Facebook message ID means sent.
- Existing relay topology is retained.
- Client correlation keys and idempotent result handling prevent duplicate bubbles.
- The hard-coded Facebook GraphQL operation must be diagnosed from safe response metadata before replacing it.

## Project Structure

```text
src/client/components/MessageComposer.jsx   # send and status UI
src/client/App.jsx                           # socket event merge/state handling
src/server/server.js                         # validation, relay, result correlation
src/server/repositories/ConversationRepository.js
src/server/database/db.js                    # only if migration is required
src/extension/background.js                  # Facebook request and result normalization
src/extension/content.js                     # DOM confirmation/deduplication
tests/unit/outboundMessage.test.js
tests/integration/outboundMessaging.test.js
tests/contract/outboundEvents.test.js
specs/004-reliable-outbound-messaging/      # design artifacts
```

## Design Phases

### Phase 0 — Evidence and contract baseline

Capture current CRM send event, server relay, extension request, and Facebook response shapes without logging secrets. Add failing contract tests for required fields and success criteria.

### Phase 1 — Canonical outbound state

Define pending/sent/failed transitions and correlation behavior in the repository/server. Ensure an acknowledgement updates the pending row rather than inserting a second message.

### Phase 2 — Facebook adapter reliability

Normalize GraphQL/API responses, distinguish transport/application/token/thread errors, verify account/tab/token context, and return official IDs only on confirmed success. Keep a bounded diagnostic code for failures.

### Phase 3 — UI and DOM reconciliation

Render truthful states, retry failed attempts with a new client ID, and merge later Facebook DOM confirmations idempotently.

### Phase 4 — End-to-end validation

Run automated tests and the manual quickstart against a real test conversation, including reconnect, delayed response, duplicate event, and failure cases.

## Risks and Mitigations

- Facebook may change its private GraphQL contract: isolate the adapter and fail closed when response shape is unknown.
- Pending rows may be left after browser crash: show pending after reload and require explicit retry.
- Duplicate DOM and result events: enforce client-ID and official-ID uniqueness.
- Existing history behavior regression: run the full persistence suite before and after changes.

## Complexity Tracking

No constitution violations or new architectural components are required.
