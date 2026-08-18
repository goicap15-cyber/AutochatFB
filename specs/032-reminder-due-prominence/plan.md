# Implementation Plan: Reminder Due Prominence

**Branch**: `032-reminder-due-prominence` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

Make due follow-up reminders unmistakable in the CRM list without changing reminder data or overriding the operator’s current view. Derive due state from existing active reminder data, apply stable due-first ordering after visibility checks, and layer accessible urgency cues.

## Technical Context

**Language/Version**: JavaScript, Node.js 24, React 19  
**Primary Dependencies**: React, Lucide icons, Tailwind CSS utilities  
**Storage**: Existing reminder data only; no schema or migration change  
**Testing**: Node built-in test runner and Vite production build  
**Target Platform**: Local desktop CRM in modern Chromium browser  
**Project Type**: Web application  
**Performance Goals**: No perceptible delay when deriving or ordering normal inbox sizes  
**Constraints**: Preserve filter/tab/search/archive membership and relative order within groups; honor reduced motion  
**Scale/Scope**: Conversation-list presentation only; no backend, reminder lifecycle or notification change

## Constitution Check

The project constitution is a placeholder. This plan follows the active practical gates: no duplicate persisted state, localized accessible UI, focused test coverage, production build verification, and no unrelated worktree changes.

**Result**: Pass. No new storage or external integration is required.

## Design Decisions

1. Add a pure client presentation utility for safe date parsing, due detection, Vietnamese relative labels and stable due-first ordering.
2. In the sidebar, retain archive mode, filters, tabs and search first; only then apply priority ordering.
3. In each item, layer subtle urgency background and left edge, an avatar bell, bold `CẦN NHẮC` and relative urgency wording. Selected state is compatible, not replaced.
4. Use pulse only as enhancement; disable it for reduced motion while retaining icon, contrast and text.
5. Do not change any server route, database table, archive behavior, reminder lifecycle or campaign-selection eligibility.

## Project Structure

```text
src/client/
├── components/
│   ├── ConversationSidebar.jsx       # due-first ordering after visibility rules
│   └── ConversationItem.jsx          # urgency treatment and accessible labels
├── utils/
│   └── reminderPresentation.js       # new pure helper
└── index.css                         # reduced-motion animation guard if needed

tests/unit/
└── reminderPresentation.test.js      # due detection, labels, stable ordering

specs/032-reminder-due-prominence/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/reminder-prominence-ui.md
└── quickstart.md
```

**Structure Decision**: Keep presentation logic in a client utility so sidebar and card share one due definition and it can be tested without rendering the CRM.

## Implementation Steps

1. Create helper functions for safe due detection, Vietnamese urgency labels and stable ordering.
2. Add unit coverage for future/current/past/invalid reminder values, label boundaries and stable ordering.
3. Update sidebar ordering after all existing visibility checks, retaining campaign-selection behavior.
4. Update conversation item visual and semantic due treatment, including compatible selected styling.
5. Add reduced-motion guard for optional bell pulse.
6. Run focused tests, full persistence suite, UI build and all [quickstart scenarios](quickstart.md).

## Complexity Tracking

No constitution violations or additional complexity require tracking.
