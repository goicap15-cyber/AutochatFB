# Data Model: Hover Navigation Sidebar

No persistent data or backend model is required.

## Transient presentation state

| Field | Meaning | Lifecycle |
|---|---|---|
| isExpanded | Sidebar currently presents labels and extended surface | Derived from hover/focus and close delay |
| hasPointerInside | Pointer is within the sidebar region | Updated by pointer enter/leave |
| hasKeyboardFocus | Focus is within the sidebar region | Updated by focus enter/leave |
| closeTimer | Pending delayed collapse | Created on pointer leave and cancelled on re-entry/focus |

Existing navigation item data remains the source of truth for labels, icon, active state, modal action and checkpoint indicator.
