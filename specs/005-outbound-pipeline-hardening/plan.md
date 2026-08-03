# Implementation Plan: Outbound Pipeline Hardening

## Architecture

Keep the existing CRM → Socket.IO → server → extension WebSocket → Facebook topology. Harden each boundary with an explicit attempt state and idempotent transitions.

## Phases

1. **Contract/state**: define attempt states, stage/error codes, and event contracts; add tests first.
2. **Extension**: normalize GraphQL empty responses; poll semantic composer; click once; verify composer; fallback Enter/form submit once; return stage diagnostics.
3. **Backend**: persist pending before dispatch; make DOM/result ordering-independent; handle unique-ID collisions transactionally; emit one final state.
4. **UI**: render stage-aware pending/failed state and retry with a new client ID.
5. **Artifact/E2E**: build `dist/extension`, verify loaded artifact, run deterministic one-send and ten-send tests, then Graphify.

## Safety Gates

- No migration that deletes message rows.
- No coordinate automation.
- No success without confirmation.
- No automatic resend after reload.
- Full existing persistence suite must remain green.
