# Data Model: Advanced Conversation Filters

## Persistent data

No new persistent data is required. The existing thread/contact/reminder data is read only.

## Filter state

| Field | Meaning |
|---|---|
| Source keys | Source type and specific account/Page choices |
| Workflow states | Chưa xử lý, Đang xử lý, Đã chốt selections |
| Customer state ids | Existing custom lead-status selections |
| Label names | Existing and manually entered labels, normalized for matching |
| Unread/reminder/contact/archive choices | Explicit grouped states |
| Activity range | Preset or inclusive local-date boundaries |
| Manual rules | Field, operator and validated value |

## Filterable conversation summary

| Existing data to expose | Purpose |
|---|---|
| Tags and contact-presence fields | Label and completeness conditions |
| Thread activity, unread, archive and workflow fields | Activity, unread, archive and workflow conditions |
| Active reminder summary | Reminder-state conditions |
| Source and custom lead status | Existing source/account and customer-state conditions |

## Matching order

1. Current archive scope, search and workflow tab determine baseline membership.
2. Grouped choices and valid manual rules constrain membership.
3. Spec 032 due-reminder priority orders the final matching list without altering membership.
