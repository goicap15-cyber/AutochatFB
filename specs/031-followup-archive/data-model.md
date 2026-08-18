# Data Model

## threads additions

| Field | Meaning |
|---|---|
| archived_at | Null for Inbox; timestamp for CRM-local archive. |

## conversation_reminders

| Field | Meaning |
|---|---|
| thread_id | One active reminder per thread. |
| due_at | Required future ISO timestamp. |
| note | Optional short staff note. |
| status | active, completed, or cancelled. |

Active reminder is due when due_at is no later than the current time. Incoming customer messages set archived_at to null; outgoing messages do not.
