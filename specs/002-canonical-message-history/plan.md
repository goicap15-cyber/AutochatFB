# Implementation Plan: Canonical Message History

**Branch**: `002-canonical-message-history` | **Date**: 2026-08-03 | **Spec**: [spec.md](file:///home/giang-adsup/dev/autochatbot/specs/002-canonical-message-history/spec.md)

**Input**: Feature specification from `specs/002-canonical-message-history/spec.md`

## Summary

Standardize how message timestamps, content, and sort order flow through the system (Extension → Backend → UI) to fix three root-cause bugs: (1) date-grouping uses `created_at` while sorting uses `timestamp_ms`, (2) Facebook accessibility labels leak into stored content, (3) history sync can create duplicates due to non-deterministic IDs.

## Technical Context

**Language/Version**: JavaScript (Node.js 24, ES2022); React 19 (client)

**Primary Dependencies**: better-sqlite3, socket.io, Chrome Extension Manifest V3

**Storage**: SQLite via better-sqlite3 (file: `data/database.db`)

**Testing**: Node.js built-in test runner (`node:test` + `node:assert/strict`)

**Target Platform**: Linux desktop (CRM operator machines); Chrome browser (extension)

**Project Type**: Three-runtime architecture: Chrome extension (content script + background service worker) → Node.js backend (server.js + SQLite) → React SPA (App.jsx + components)

**Performance Goals**: No measurable regression; history sync of 100 messages should complete in < 2 seconds

**Constraints**: Must not alter production database schema (no new columns). Must not break existing real-time message flow.

**Scale/Scope**: Single operator, 1-5 Facebook accounts, ~50 active threads

## Constitution Check

*GATE: Constitution is still template (not filled in). No blocking gates.*

## Project Structure

### Documentation (this feature)

```text
specs/002-canonical-message-history/
├── spec.md              # Feature spec (done)
├── plan.md              # This file
├── research.md          # Root-cause analysis
├── data-model.md        # Entity field definitions
├── quickstart.md        # Validation guide
└── tasks.md             # Task breakdown (speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── extension/
│   ├── background.js        # History DOM parser + parseTimeFromLabel()
│   ├── content.js           # Real-time DOM observer + network interceptors
│   └── textFilter.js        # cleanMessageText() + isSystemOrMetadataText()
├── server/
│   ├── database/
│   │   ├── db.js            # SQLite init + migrations
│   │   └── schema.sql       # Table definitions
│   ├── repositories/
│   │   └── ConversationRepository.js  # upsertThread, saveMessagesTransaction, getMessages
│   └── server.js            # WebSocket handler: NEW_MESSAGE_RECEIVED, THREAD_MESSAGES_SYNCED
└── client/
    ├── App.jsx              # Socket listeners, message state, sort logic
    └── components/
        ├── MessageList.jsx  # formatDate() → date dividers
        ├── ChatArea.jsx     # Date grouping + time display
        └── MessageBubble.jsx  # formatTime() for individual bubbles

tests/
├── helpers/
│   └── testDatabase.js      # In-memory SQLite test factory
└── integration/
    ├── conversationPersistence.test.js
    └── sidebarSyncPersistence.test.js
```

**Structure Decision**: Existing three-runtime structure is preserved. All changes are modifications to existing files — no new source files needed. One new shared utility function (`canonicalTimestamp`) will live in `ConversationRepository.js` or a small shared module.
