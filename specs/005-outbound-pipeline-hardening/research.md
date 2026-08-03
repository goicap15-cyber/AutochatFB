# Research: Outbound Pipeline Hardening

## Findings

1. Facebook GraphQL can return HTTP 200 with an empty body; HTTP status is not a delivery signal.
2. Messenger exposes an accessible send control, but rendering is asynchronous; immediate lookup is unreliable.
3. Synthetic keyboard events are untrusted and may be ignored; form submit is a bounded fallback, not proof of delivery.
4. DOM confirmation can arrive before or after `SEND_MESSAGE_RESULT`; backend must be order-independent.
5. `fb_message_id` is unique, so attaching an existing ID to a second pending row causes the observed crash.
6. Source extension and built extension can diverge; E2E must record artifact path/hash and require reload.

## Decisions

- Use a state machine and immutable client ID per attempt.
- Poll semantic DOM controls, click once, then Enter/form-submit once after timeout.
- Correlate by official ID first, then pending client/content/time; never overwrite an existing unique ID.
- Record stage diagnostics and fail closed.
