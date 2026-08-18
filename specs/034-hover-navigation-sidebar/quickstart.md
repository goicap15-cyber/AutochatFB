# Quickstart: Validate Hover Navigation Sidebar

## Prerequisites

- Run the CRM normally with npm start.
- Open in a desktop viewport and keep a conversation selected.

## Manual validation

1. Hover over the left icon rail and confirm it reveals CRM identity plus labels for every existing navigation item.
2. Move between rail items and then briefly leave/re-enter; confirm there is no flicker and it only collapses after a short delay.
3. Keep a conversation open, hover/open/close sidebar, and confirm the conversation list, chat messages and lead panel do not shift.
4. Click each navigation item and bottom action; confirm all current modal/view actions remain unchanged.
5. Use Tab to enter/leave the rail; confirm it opens while focus is inside and closes after focus leaves.
6. Test active item, checkpoint warning, light/dark theme, 200% zoom and reduced motion preference.
7. Check a narrow/touch-like viewport: rail remains compact, all icon actions remain usable, and no overlay blocks the conversation list.

## Automated validation

- Run npm run build:ui.
- Run npm run test:persistence.
