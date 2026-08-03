# Implementation Plan: Trusted Messenger Send Replacement

## Architecture

Replace the current GraphQL-first/synthetic-key path with a feature-gated browser interaction adapter:

```text
CRM → server pending → extension active tab
  → poll composer → DOM click
  → confirmation?
  → CDP trusted Enter fallback once
  → DOM/network confirmation → server correlation → CRM sent
```

## Phases

1. **Contract and safety**: define feature flag, states, stage codes, and CDP permission policy; add failing tests.
2. **Browser adapter**: poll the active composer, click semantic control, attach CDP only for one Enter fallback, detach in `finally`.
3. **Backend correlation**: preserve pending, handle event ordering and duplicate IDs transactionally, timeout to failed.
4. **UI and rollback**: show stage-aware status and allow disabling the replacement path.
5. **Artifact/E2E**: build exact extension, verify manifest permission, run ten-send and rollback tests, then update Graphify.

## Safety Gates

- No screen-coordinate automation.
- No automatic resend loops.
- No success without confirmation.
- CDP attach must always detach on success, failure, and timeout.
- Existing persistence tests must remain green.
