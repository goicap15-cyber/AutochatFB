# Data Model: Reminder Due Prominence

No persistent data-model or API change is required.

## Existing inputs

| Input | Use |
|---|---|
| Existing active reminder due time and status | Derive due and overdue presentation |
| Current post-filter list order | Preserve relative order within urgency groups |

## Derived presentation state

| Field | Rule |
|---|---|
| Due state | Active reminder has a valid scheduled time at or before now |
| Urgency label | `Đến hạn` near scheduled time, otherwise concise overdue duration |
| Priority | Due items before other visible items; stable within both groups |

This feature writes no reminder data.
