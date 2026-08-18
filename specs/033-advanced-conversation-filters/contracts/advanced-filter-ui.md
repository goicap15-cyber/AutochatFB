# UI Contract: Advanced Conversation Filters

## Filter interaction contract

| Interaction | Required result |
|---|---|
| Open | Draft begins as an independent copy of applied state |
| Quick filter | Adds/removes its defined condition in draft and visibly indicates selection |
| Group multi-select | OR matching inside that group |
| Add manual rule | Shows only compatible operator and value controls |
| Apply | Validate, sanitize unavailable options, commit draft and update list |
| Cancel/Escape/close/outside click | Discard draft and retain applied list |
| Clear all | Reset draft only until Apply |

## Manual field contract

| Field | Operators | Values |
|---|---|---|
| Label | has / does not have | One or more label names |
| Contact details | has / does not have | Phone, email, address |
| Latest activity | before / after / between | Local date or date range |
| Reminder | is | Due, today, future, none |
| Archive | is | Inbox, archived, all |

## Responsive and accessibility contract

- Desktop panel stays anchored to the filter control; narrow layouts switch to a scrollable modal/drawer.
- Every selection has text, focus state and selected state; color is supplementary.
- Apply is disabled with an explanation while a manual rule is incomplete or invalid.
