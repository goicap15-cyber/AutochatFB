# Implementation Plan: Persist Chat History

**Branch**: `001-persist-chat-history` | **Date**: 2026-08-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-persist-chat-history/spec.md`

## Summary

Make SQLite the source of truth for conversation display. Persist a newly discovered conversation immediately, backfill available history once in resumable batches, append realtime changes transactionally, and resolve Facebook identifier variants to one stable CRM conversation. Reloading Facebook or CRM must never remove stored users or messages.

## Technical Context

**Language/Version**: Node.js 18+ CommonJS backend and extension; React 19 frontend

**Primary Dependencies**: Express 4, Socket.IO 4, ws 8, better-sqlite3 11, Chrome Extension Manifest V3

**Storage**: SQLite in WAL mode with FTS5

**Testing**: Node built-in `node:test`, temporary SQLite databases, mocked extension WebSocket/Socket.IO flows, manual Facebook E2E validation

**Target Platform**: Electron 31 desktop application with Chrome/Chromium extension

**Project Type**: Desktop app with embedded web service, SPA, and browser extension

**Performance Goals**: Stored conversations render within 2 seconds; unchanged incremental sync performs zero message inserts; message persistence completes before durable UI acknowledgement

**Constraints**: Facebook private DOM/network formats are unstable; history may be paginated or E2EE; existing data must be preserved; no repeated full-history replacement

**Scale/Scope**: Personal one-to-one Messenger conversations across multiple Facebook accounts; current dataset plus growth to at least 1,000 conversations and 1,000,000 messages

## Constitution Check

*Pre-design gate*: `.specify/memory/constitution.md` is an unconfigured placeholder, so no enforceable project constitution exists. The plan applies `PROJECT_RULES.md` instead.

- PASS: Feature has an isolated spec, plan, contracts, tasks, and validation guide.
- PASS: Graphify was queried before planning the affected flow: `handleSync100Threads` → `server.js` persistence → `App.jsx`, and `handleSyncThreadMessages` → message persistence.
- PASS: Migration is non-destructive, requires backup/integrity checks, and preserves existing records.
- PASS: No UI redesign is introduced; any sync indicator must reuse semantic design tokens.
- REQUIRED DURING IMPLEMENTATION: Run `graphify update .` after code and architectural changes.

*Post-design gate*: PASS. The design keeps source changes inside the existing backend, extension, database, and client boundaries and adds only focused persistence/identity services.

## Project Structure

### Documentation (this feature)

```text
specs/001-persist-chat-history/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sync-events.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── database/
│   │   ├── db.js
│   │   └── schema.sql
│   ├── repositories/
│   │   └── ConversationRepository.js
│   ├── services/
│   │   ├── ConversationIdentityResolver.js
│   │   └── HistorySyncManager.js
│   └── server.js
├── extension/
│   ├── background.js
│   ├── content.js
│   └── injected.js
└── client/
    ├── App.jsx
    └── components/

tests/
├── unit/
├── integration/
└── fixtures/
```

**Structure Decision**: Keep the current three-runtime architecture. Extract persistence and identity decisions from the monolithic WebSocket handler into focused backend services; the extension remains responsible only for Facebook discovery/extraction, and the client renders persisted backend state.

## Implementation Phases

### Phase 1 — Persistence foundation (MVP)

- Add a safe SQLite migration and backup/integrity gate.
- Separate conversation metadata from durable messages and synchronization state.
- Stop sidebar sync from resetting workflow state or replacing the stored list.
- Load threads/messages from SQLite first on every CRM start.
- Persist all accepted messages before emitting durable success to the client.

### Phase 2 — Resumable history synchronization

- Replace one-shot history arrays with started/batch/completed/failed events.
- Store every batch transactionally and retain partial progress on reload/disconnect.
- Initial sync scans available history; later sync stops at a known message/checkpoint.
- Use deterministic deduplication for rows without an official Facebook message ID.

### Phase 3 — Stable conversation identity

- Introduce a CRM conversation ID scoped to the Facebook account.
- Resolve URL, E2EE, thread, participant, and network identifiers through aliases.
- Preserve ambiguous identifiers as unresolved instead of auto-merging contacts.
- Migrate existing message/contact ownership without deleting valid records.

### Phase 4 — Consistency, UX, and regression validation

- Add FTS UPDATE/DELETE consistency and rebuild validation.
- Expose local/loading/partial/failed/synced state without hiding stored data.
- Add automated reload, duplicate-delivery, failed-sync, and identity-alias tests.
- Validate with the two real test conversations over 10 reload cycles.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Stable CRM conversation ID plus alias table | Facebook exposes different identifiers for the same conversation across sources and E2EE routes | Using one raw Facebook ID continues to create duplicate/new users |
| Batch sync state | Facebook reloads can interrupt long DOM history extraction | Sending one final array loses all progress on interruption |
| Focused repository/sync services | Current persistence logic is spread across a large WebSocket switch | Adding more inline cases would make identity and transaction rules difficult to test |
