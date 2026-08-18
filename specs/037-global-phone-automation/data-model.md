# Data Model

## phone_capture_automation_settings

| Field | Meaning |
|---|---|
| id | Singleton value 1 |
| is_enabled | Operator toggle, false by default |
| status_id | Optional target reusable customer status |
| updated_at | Last settings update |

The table owns no phone values. Contact phone, capture evidence, provenance, and status remain in their existing tables.
