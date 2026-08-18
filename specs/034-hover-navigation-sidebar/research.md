# Research: Hover Navigation Sidebar

## Decision: Use an overlay, not a changing grid column

**Rationale**: The existing application grid has a fixed first column for navigation. Expanding that grid column would push the conversation list and chat area, violating the no-layout-shift requirement. The expanded navigation surface will overlay adjacent content while the compact grid column remains fixed.

**Alternatives considered**: Resizing the grid column was rejected because it makes the chat jump. A permanently wide sidebar was rejected because it removes useful workspace.

## Decision: Open on hover and keyboard focus, close with a guarded delay

**Rationale**: Hover provides the requested quick reveal. Focus-within supplies an equivalent path for keyboard users. A short close delay prevents flicker when crossing from the rail to a label or between menu items; re-entry cancels the pending close.

**Alternatives considered**: CSS hover alone was rejected because it cannot reliably preserve the open state during keyboard navigation or coordinate the close delay. A click-to-pin control is excluded from v1.

## Decision: Keep compact behavior for non-hover/touch environments

**Rationale**: A hover interaction cannot be assumed on touch. The current icon rail remains usable without unexpectedly covering the viewport.

## Decision: Respect existing hierarchy and motion preferences

**Rationale**: Existing modal/popover layers must remain above the navigation overlay, and animation is supplemental. Reduced-motion users get an immediate/minimal transition.
