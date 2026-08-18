# Quickstart: Validate Reminder Due Prominence

## Prerequisites

- CRM is running with a conversation that can receive a follow-up reminder.
- Create one due reminder and one future reminder.

## Validation scenarios

1. In Inbox, confirm the due conversation appears before matching non-due conversations.
2. Confirm its card shows an urgency treatment, bell, `CẦN NHẮC`, and Vietnamese relative time.
3. Confirm a future reminder remains calm and does not receive due priority.
4. Apply search, source/status filters and workflow tabs; confirm membership stays correct and due ordering only applies inside matches.
5. Select the due conversation; confirm selection and urgency remain clear.
6. Open archive view; confirm urgency does not change archive membership.
7. Enable reduced motion and confirm urgency remains clear without pulse.
8. Complete or cancel the reminder; refresh and confirm urgency treatment disappears.

## Automated checks

Add focused tests for due detection, Vietnamese labels, stable ordering and invalid times. Run the full suite and the UI production build.
