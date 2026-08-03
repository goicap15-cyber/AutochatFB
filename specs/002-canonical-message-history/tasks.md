# Implementation Tasks: Canonical Message History

**Branch**: `002-canonical-message-history` | **Spec**: [spec.md](file:///home/giang-adsup/dev/autochatbot/specs/002-canonical-message-history/spec.md)

## Overview

This document breaks down the implementation into actionable tasks.

### Phase 1: Foundational P0 Bug Fixes & Test Suite
- [X] T033 Fix missing `existing` or `const` redeclarations in `src/server/server.js` message handler logic.
- [X] T034 Fix backup logic in `src/server/database/db.js` so it backs up properly on first migration.
- [X] T035 Fix SQLite integration tests in `tests/integration/` to use real in-memory tables.

### Phase 2: User Story 1 & 2 - Timestamp Parsing & Label Stripping
**Goal**: Correctly extract canonical time from Facebook DOM labels and strip accessibility text from content.
- [X] T036 [US1] Update `src/extension/background.js` `parseTimeFromLabel` to handle Vietnamese date formats and fallback times more robustly.
- [X] T037 [US2] Update `src/extension/textFilter.js` `cleanMessageText` to strictly strip "Tin nhắn do ... gửi lúc" and return empty strings if no real content exists.

### Phase 3: User Story 3 & 4 - ID Generation, Deduplication, and Sorting
**Goal**: Generate deterministic IDs for history messages and deduplicate perfectly in SQLite.
- [X] T043 [US2] Add a one-time non-destructive cleanup/migration for existing message content polluted with Facebook accessibility labels in src/server/database/db.js.
- [X] T038 [US3] Update `src/extension/background.js` deterministic ID generation to use content hashes rather than DOM position index where possible.
- [X] T039 [US3] Update `src/server/server.js` `NEW_MESSAGE_RECEIVED` fallback real-time ID generator to be deterministic.
- [X] T040 [US4] Update `src/server/repositories/ConversationRepository.js` and `src/server/server.js` `THREAD_MESSAGES_SYNCED` to explicitly sort by `timestamp_ms ASC, id ASC`.

### Phase 4: User Story 1 & 5 - UI Display Logic
**Goal**: Ensure the UI displays messages and dates using `timestamp_ms`, preventing the "Hôm nay" bug.
- [X] T041 [US1] Update `src/client/components/ChatArea.jsx` to group by `timestamp_ms` formatted dates instead of `created_at`.
- [X] T042 [US1] Update `src/client/components/MessageList.jsx` and `App.jsx` to parse and sort completely by `timestamp_ms`.
