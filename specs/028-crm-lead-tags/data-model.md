# Data Model: CRM Lead Tags

## Persisted data

Existing contacts.tags field:
- SQLite type: TEXT
- Default: []
- Wire representation in contact PUT: JSON-compatible array of strings
- Ownership: one contact row per CRM thread
- Ordering: stable array order; append new tags

Canonical UI invariants:
- each tag is a trimmed non-empty string;
- maximum 40 Unicode code units per tag;
- maximum 20 tags per contact;
- duplicate comparison is case-insensitive after trimming;
- invalid legacy payloads are treated as empty for editing, while valid unknown tags are preserved.

## Ephemeral state

- committedTags: string[] — last known persisted selection.
- draftTags: string[] — editor working copy.
- tagEditorOpen: boolean
- tagInput: string
- tagError: string
- tagSaveState: idle | saving | error

Transitions:
1. Contact opens → parse contacts.tags; editor closed.
2. Toggle chip → update committed optimistically and save; rollback on failure.
3. Open editor → copy committed to draft.
4. Add/remove draft → validate and update draft only.
5. Apply → save draft; committed becomes draft on success.
6. Cancel/Escape/contact switch → discard draft/input/error.
