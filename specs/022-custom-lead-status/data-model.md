# Data Model: Visual Lead Status Color Picker

## Persistence

No database migration is required.

Existing entity:

`lead_statuses.color TEXT NOT NULL`

New application invariant:

- canonical format: `#RRGGBB`
- characters: leading `#` plus six hexadecimal digits
- canonical case: uppercase
- alpha: prohibited
- example: `#2684FF`

The POST boundary normalizes accepted lowercase input before persistence and rejects all non-six-digit values. Existing stored colors remain readable; normalization applies whenever a new status is created.

## UI state (ephemeral)

- `showCreateStatus: boolean` — owns the whole create-status form.
- `newStatusColor: string` — committed color within that unsaved form.
- `isColorPickerOpen: boolean` — owns picker mounting.
- `draftColor: string` — temporary picker edit.

Transitions:

1. Open create form → initialize committed/draft defaults; picker closed.
2. Open picker → copy committed to draft.
3. Apply picker → normalize draft into committed; close picker.
4. Cancel picker/outside/Escape → discard draft; close picker.
5. Outer Create → POST committed color; on success reset all create/picker state.
6. Outer Cancel/contact change/unmount → reset all create/picker state without POST.
