# Implementation Plan: Multi-Account Background Messenger Sync

## Architecture

Add a backend scheduler that treats each extension connection as a background inbox worker:

```text
connected account
  → periodic SYNC_THREADS
  → compare sidebar snapshot with DB
  → changed threads enqueue SYNC_THREAD_MESSAGES
  → extension ensures Messenger tab / navigates safely
  → backend persists messages
  → CRM receives THREADS_SYNCED / THREAD_MESSAGES_UPDATED
```

## Design Constraints

- Preserve the trusted-send path from `006-trusted-messenger-send`.
- Prefer additive schema/API changes over destructive primary-key migrations.
- Keep scheduler conservative: short queue, cooldowns, and explicit logs.
- Do not mirror messages from one account to another as synthetic receiver messages.
- Do not rely on operator-visible Messenger interaction.

## Phases

1. **Artifacts and guardrails**: document sync contracts, data model, validation quickstart, and ordered tasks.
2. **Backend scheduler**: add account-level periodic sync and thread-level debounce for message sync.
3. **Changed-thread detection**: compare `SYNC_THREADS_RESULT` snapshots against existing DB before upsert and dispatch targeted message sync.
4. **Extension background tab**: ensure a Facebook/Messenger messages tab exists and is usable for sync.
5. **UI/account isolation hardening**: add backward-compatible `thread_key` in payload/UI keys where safe.
6. **Validation**: syntax checks, persistence tests, manual two-account scenario, and `graphify update .`.

## Safety Gates

- No destructive DB migration.
- No change to composer insertion/send fallback logic unless tests show regression.
- No unbounded intervals or nested sync loops.
- Logs must include account/thread/job reason, but no cookies/tokens/full private response bodies.
