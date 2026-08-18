# Data Model: CRM VIP Quick Action

Feature 030 introduces no new persistent entity, database table, migration or endpoint.

## Existing contact fields reused

| Field | Role in Feature 030 | Rules |
|---|---|---|
| \`contacts.tags\` | Stores VIP membership | A case-insensitive \`VIP\` entry means the contact is VIP. Other tag entries remain unchanged. |
| \`contacts.thread_id\` | Contact identity for a tag update | Existing contact-save path remains the sole persistence target and scopes each in-flight action. |

## Derived UI state

| State | Derived from | Transitions |
|---|---|---|
| VIP selected | Current committed tags | Absent → optimistic add → persisted or reverted; present → optimistic remove → persisted or reverted. |
| VIP saving | Existing tag-save lifecycle | Idle → saving → idle. Blocks duplicate tag mutations while saving. |
| VIP error | Failed tag save | Shown contextually; cleared by successful action, contact change or explicit dismissal. |

## Invariants

1. A contact has at most one logical VIP tag, irrespective of capitalization or outer whitespace.
2. Adding/removing VIP never changes unrelated tags.
3. A failed VIP save restores the exact prior committed tag list.
4. A stale save response never mutates state for a different active contact.
