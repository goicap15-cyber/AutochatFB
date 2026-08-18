# Research

- **Decision**: one active CRM reminder per thread; upsert replaces the pending reminder. **Rationale**: avoids duplicate follow-ups.
- **Decision**: archive is a local nullable timestamp on threads. **Rationale**: preserves all Facebook/CRM data and permits restore.
- **Decision**: incoming messages clear archive in the server persistence path. **Rationale**: works even when CRM UI is closed.
- **Decision**: due is computed from persisted due time at read time; no background scheduler is required for v1. **Rationale**: overdue reminders survive restart and appear on next load.
