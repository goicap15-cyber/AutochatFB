# Implementation Plan: Advanced Conversation Filters

**Branch**: `033-advanced-conversation-filters` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

Expand the conversation filter from source/customer-state selection into a practical CRM filtering workspace. Preserve draft versus applied safety; add quick filters and validated manual rules; evaluate locally from richer loaded thread summaries; preserve the existing search, workflow tab, archive and due-reminder priority pipeline.

## Technical Context

**Language/Version**: JavaScript, Node.js 24, React 19  
**Primary Dependencies**: React hooks, Lucide icons, Tailwind utilities  
**Storage**: Existing SQLite contact/thread/reminder data; no new table or migration  
**Testing**: Node test runner and Vite production build  
**Target Platform**: Local CRM, desktop and constrained/narrow layouts  
**Project Type**: React frontend plus Node/Express backend  
**Performance Goals**: Apply/filter loaded normal inbox sizes without a perceptible delay or extra interaction request  
**Constraints**: Preserve existing search, workflow tabs, archive behavior, due priority, campaign selection and keyboard navigation  
**Scale/Scope**: Session-only filter state; saved views, query language and server-side search are excluded

## Constitution Check

The project constitution is a placeholder. This plan follows active practical gates: use existing data, no unnecessary persistence, pure testable matching logic, accessible responsive controls, full regression tests and no unrelated edits.

**Result**: Pass. Existing data must be enriched in the already-loaded conversation summary, but no new service surface is required.

## Architecture and State Flow

```text
Loaded threads plus contact summary
        │
        ▼
ConversationSidebar appliedFilters
        │ open
        ▼
AdvancedConversationFilter draftFilters
  quick groups + manual rule rows
        │ Apply                    │ Cancel / Escape / close
        ▼                          ▼
sanitize and commit draft       discard draft
        │
        ▼
archive scope → search → workflow tab → grouped filters/rules → due priority
```

## Design Decisions

1. Evolve `conversationFilters.js` to one normalized filter model rather than creating separate predicates in each UI group.
2. Extend the existing `/api/threads` summary query with contact tags and presence fields used by matching; no per-filter request.
3. Retain grouped selectors for common filters, add a manual rule builder for precise fields, and normalize manual values before matching.
4. Fold archive scope into the filter so all visibility choices can be reviewed together; retain the expected Inbox default and preserve due-archive behavior deliberately.
5. Use a responsive filter surface: anchored wide desktop panel, scrollable modal/drawer on constrained width.
6. Keep existing priority ordering from Spec 032 as the last step after all matching.

## Project Structure

```text
src/client/
├── components/
│   ├── ConversationSidebar.jsx                  # state, pipeline, filter trigger
│   ├── ConversationFilterPopover.jsx            # expanded responsive editor
│   └── ConversationFilterRuleBuilder.jsx        # new manual rule rows
└── utils/
    └── conversationFilters.js                   # normalized model, validation and predicate

src/server/
├── services/AssignmentManager.js                # richer thread summary for loaded filtering
└── server.js                                    # sync snapshot has the same summary fields

tests/
├── unit/advancedConversationFilters.test.js
├── unit/conversationFilterRuleBuilderLogic.test.js
└── integration/conversationFilterSummary.test.js

specs/033-advanced-conversation-filters/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/advanced-filter-ui.md
└── quickstart.md
```

**Structure Decision**: Isolate matching/validation as pure client utilities and rule-editor UI as a focused component; backend only supplies fields that are already needed by the loaded list.

## Implementation Steps

1. Define normalized filter state, option/rule validation, quick-filter mappings and pure grouped/manual predicate tests.
2. Enrich normal and sync thread summaries consistently with labels and contact-presence fields; add persistence/query coverage.
3. Build accessible quick-filter and grouped controls with draft state, active summary and clear-all behavior.
4. Build manual field/operator/value rows with validation, add/remove behavior and keyboard support.
5. Integrate responsive surface, archive scope and the final list pipeline without regressing Spec 032 priority.
6. Run focused unit/integration tests, full persistence suite, UI build and [quickstart scenarios](quickstart.md).

## Complexity Tracking

No constitution violations require tracking.
