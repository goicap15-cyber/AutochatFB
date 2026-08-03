# Research: Reliable CRM-to-Messenger Outbound Messaging

## Decision 1: Treat Facebook's official message ID as the success boundary

**Decision**: `SEND_MESSAGE_RESULT.success` is true only when the Facebook response contains an official message ID and no GraphQL/API errors.

**Rationale**: The current optimistic pending insert proves only that CRM accepted input; it cannot prove recipient delivery.

**Alternatives considered**: Treating HTTP 200 as success was rejected because Facebook can return application errors in a 200 response.

## Decision 2: Keep the existing relay topology

**Decision**: Frontend → Socket.IO → server → account WebSocket → extension → Facebook session.

**Rationale**: The project already has account registration, thread binding, extension routing, and result events. A new transport would increase risk.

**Alternatives considered**: Direct CRM-to-Facebook calls were rejected because browser session tokens and account context belong in the extension.

## Decision 3: Explicit outbound state machine and idempotency

**Decision**: Persist `pending`, then transition once to `sent` or `failed`, keyed by `client_message_id`; reconcile official IDs and DOM events without inserting a second row.

**Rationale**: Delayed acknowledgements, reconnects, and observer duplicates are expected in browser integrations.

**Alternatives considered**: Re-sending every pending row after reload was rejected because it can duplicate messages.

## Decision 4: Diagnose Facebook request compatibility before changing transport

**Decision**: Capture safe response classification and verify token, account, thread ID, and GraphQL operation contract in tests/manual diagnostics before considering a fallback composer flow.

**Rationale**: The current code uses a hard-coded GraphQL document ID; the failure may be an expired token or changed response shape rather than routing.

**Alternatives considered**: Blindly changing the document ID or scraping the composer first was rejected without evidence from the actual response.

## Decision 5: No sensitive diagnostics

**Decision**: Log status, error codes, response keys, and IDs only; never tokens/cookies or full message payloads.

**Rationale**: Outbound debugging must not expose Facebook session credentials.
