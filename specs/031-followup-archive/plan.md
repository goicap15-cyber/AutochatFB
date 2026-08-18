# Implementation Plan: CRM Follow-up Reminder and Archive

## Summary

Add persistent CRM-only follow-up reminders and local thread archive. Backend owns persistence and auto-restores archive on incoming message; frontend offers reminder popover, archive confirmation/restore, badges and archive view.

## Technical Context

- JavaScript/React frontend, Node/Express, SQLite
- Existing threads and socket sync remain authoritative for messages
- New reminder table plus archived_at migration; no Facebook API write
- Tests: node test, persistence suite, Vite build

## Phases

1. Add migration/repository/service/routes and persistence tests.
2. Include reminder/archive state in thread loading and clear archive for incoming messages.
3. Add UI controls to LeadDetailsPanel, archive tab/filter and conversation indicators.
4. Run regression/build/manual keyboard checks.

## Structure

- src/server/database/{schema.sql,db.js}
- src/server/services/FollowupService.js
- src/server/server.js
- src/client/{App.jsx,components/LeadDetailsPanel.jsx,components/ConversationSidebar.jsx,components/ConversationItem.jsx}
- tests/integration/followupArchivePersistence.test.js

## Safety Gates

No delete/Facebook archive call; archive only hides default inbox. Incoming only auto-restores. Reminder failures rollback UI and due reminders survive restart.
