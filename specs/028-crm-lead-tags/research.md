# Research: CRM Lead Tags

## Decision: keep tags as a per-contact JSON array

The existing schema already has contacts.tags TEXT DEFAULT '[]', and the contact PUT handler accepts tags. A new lead_tags catalog would expand scope into migrations, global CRUD, permissions, and cross-contact filtering that the user did not request. The first increment therefore manages a tag list on the active conversation.

## Decision: one shared inline editor

Use one popover/editor opened by both “+ Thêm” and “Quản lý nhãn”. This prevents two interaction models from drifting and works in the narrow lead drawer. Existing selected tags are shown with remove controls; custom input adds to the same draft list.

## Decision: optimistic commit with rollback

A click should feel immediate, but persistence can fail. Keep a previous committed snapshot, update local UI, call the existing save callback, and restore the snapshot on rejection. Keep the editor open with an accessible error so the user can retry.

## Decision: case-insensitive duplicate handling

Display casing is meaningful to staff, but duplicates that differ only by case are not useful. Compare using trimmed lowercase keys while preserving the first display value and existing order.

## Decision: resilient legacy parsing

Malformed or missing contacts.tags should render as no selected tags without crashing. Valid unknown tags from older data remain visible and removable; starter tags are not a destructive whitelist.

## Alternatives rejected

- New global tag table/API: not needed for current request; deferred until global reuse/filtering is explicitly requested.
- Checkbox-only hidden state: less discoverable than semantic chip buttons with aria-pressed.
- Persist on every keystroke: creates noisy requests and makes Cancel ambiguous.
- Replace all tags with only starter constants: would erase unknown legacy values.
