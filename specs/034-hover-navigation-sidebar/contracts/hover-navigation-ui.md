# UI Contract: Hover Navigation Sidebar

| Interaction | Expected behavior |
|---|---|
| Pointer enters compact rail | Expanded overlay appears, with CRM identity and all item labels |
| Pointer leaves rail/overlay | Collapse is scheduled after a short delay |
| Pointer returns before delay | Scheduled collapse is cancelled |
| Keyboard focus enters sidebar | Overlay remains expanded while focus stays within |
| Click navigation item | Executes the same action as before; no duplicate action |
| Overlay is compact | Only icons appear; each control retains accessible name and tooltip |
| Touch/no-hover | Compact icon rail remains interactive; no automatic overlay |
| Modal/popover appears | Modal/popover layers remain visually and interactively above navigation overlay |
