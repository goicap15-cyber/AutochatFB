# Implementation Plan: Hover Navigation Sidebar

**Branch**: 034-hover-navigation-sidebar | **Date**: 2026-08-14 | **Spec**: spec.md

## Summary

Transform the compact left icon rail into an overlay navigation surface that expands on desktop hover or keyboard focus. Preserve the existing 48px grid column so the conversation list, chat and lead panel never reflow. Keep all current navigation actions unchanged, add guarded close timing, and retain compact behavior on non-hover layouts.

## Technical Context

**Language/Version**: JavaScript, React 19, Node.js 24  
**Primary Dependencies**: React hooks, Lucide icons, Tailwind utilities  
**Storage**: None; transient client presentation state only  
**Testing**: Node test runner and Vite production build; manual interaction verification  
**Target Platform**: Local desktop CRM; narrow/touch responsive fallback  
**Project Type**: React frontend plus Node/Express backend  
**Performance Goals**: Reveal/collapse perceived within 250 ms; no content reflow  
**Constraints**: Preserve existing navigation, modal actions, tooltips, checkpoint signal, theme control, lead-panel collapse control, z-index hierarchy and reduced-motion preference  
**Scale/Scope**: One left-side navigation component; no persisted setting and no backend work

## Constitution Check

The project constitution is a placeholder. The plan uses existing frontend patterns, introduces no persistence/dependency, and keeps behavior locally testable.

**Result**: Pass.

## Architecture and State Flow

    pointer enter / focus enters AppSidebar
                    │
                    ▼
             cancel pending close
                    │
                    ▼
       expanded overlay (labels visible)
                    │
        pointer/focus leaves sidebar
                    │
                    ▼
          start short delayed collapse
             │                 │
       re-enter/focus      delay finishes
             │                 │
             └──── cancel ─────┘
                               ▼
                       compact icon rail

## Design Decisions

1. Keep the application grid navigation column at 48px. An absolutely positioned overlay inside the sidebar shell grows over adjacent content instead of changing grid columns.
2. Drive open state from pointer and focus events with a close timer, so keyboard navigation is supported and fast pointer movements do not flicker.
3. Keep the actual navigation buttons in one semantic list. Labels animate/reveal; click behavior and active/checkpoint logic are unchanged.
4. On hover-capable desktop, show extended CRM identity, navigation labels and bottom control labels. On no-hover/narrow layouts, keep current compact rail.
5. Preserve z-layering: expanded navigation sits above regular CRM panes but below filters, modals, feedback/toasts and other overlays.
6. Use a CSS reduced-motion media condition to eliminate unnecessary width/opacity transition.

## Project Structure

    src/client/
    ├── components/
    │   └── AppSidebar.jsx                  # hover/focus state, semantic nav rendering
    ├── utils/
    │   └── appSidebarPresentation.js       # pure delayed-open/close state helpers
    └── index.css                           # overlay geometry, responsive and motion rules

    tests/unit/
    └── appSidebarPresentation.test.js      # pure interaction-state behavior

    specs/034-hover-navigation-sidebar/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── contracts/hover-navigation-ui.md
    ├── quickstart.md
    └── tasks.md

**Structure Decision**: UI stays in the existing AppSidebar; only timing/state logic is isolated for regression testing. No service, endpoint or migration is needed.

## Implementation Steps

1. Add pure state helpers and tests for close scheduling/cancellation and focus retention.
2. Refactor AppSidebar into a fixed compact shell plus expanded overlay, preserving its public props and current item actions.
3. Add CSS tokens/rules for expanded width, label reveal, active styling, pointer capability, z-index and reduced motion.
4. Verify no-layout-shift behavior and all action/keyboard/touch cases in quickstart.

## Complexity Tracking

No constitution violations require tracking.
