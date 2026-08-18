# Quickstart: Validate Advanced Conversation Filters

## Prerequisites

- Inbox includes a mix of sources/accounts, workflow states, customer states, labels, unread/read messages, reminder states and contact details.

## Validation scenarios

1. Filter by multiple sources and one customer state; verify OR inside source and AND across groups.
2. Apply each quick filter: Cần nhắc, Chưa đọc, VIP and Cần xử lý.
3. Combine a quick filter with a tag or activity rule; verify every row meets both.
4. Add a label rule, contact-detail rule and date-range rule; apply, edit, remove and reapply.
5. Try incomplete values and verify Apply explains the problem rather than applying misleading results.
6. Cancel/Escape/click outside after editing; verify the list and active count do not change.
7. Clear all then Apply; verify all custom conditions are removed.
8. Verify existing search, workflow tabs, archive scope, due priority, Alt+Up/Down and campaign selection.
9. Verify desktop, narrow drawer, light/dark themes, keyboard-only use and 200% zoom.

## Automated checks

Add unit tests for normalization, grouped AND/OR matching, rules, invalid inputs, activity-date boundaries, quick filters and sanitization. Run the full suite and UI build.
