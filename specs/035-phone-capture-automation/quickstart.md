# Quickstart: Phone Capture Automation

## Prerequisites

1. Start the existing CRM and connect a supported Messenger/Page route.
2. Open a contact with no phone number.
3. For policy checks, prepare a multi-message campaign and an existing custom status such as `Đã có số`.

## Capture and provenance

1. Have a customer send `0345 678 901`.
2. Confirm the contact phone is `0345678901`.
3. Confirm contact detail shows the source message and the message acquisition date/time.
4. Repeat with `+84 345 678 901`; confirm no duplicate candidate.
5. Send `0301234567`, `0801234567`, 9 digits, 11 digits, and a valid-looking fragment inside a longer number; confirm none changes contact phone.

## Manual-value protection

1. Save a manual phone number.
2. Receive a different valid mobile number.
3. Confirm the manual value remains and the incoming number appears as a dated candidate.
4. Explicitly accept it; confirm the selected field changes while capture evidence remains.

## Campaign policy

1. With `continue`, receive a valid number before the next campaign message. Confirm capture only.
2. With `stop_remaining` and `Đã có số`, confirm undispatched work is stopped, status changes and timeline explains it.
3. With `thank_then_stop`, confirm exactly one thank-you enters the existing delivery-state flow, even after reload/re-sync.
4. Receive a number after a message was dispatched; confirm the audit never claims that message was recalled.

## Automated checks

Run focused parser, persistence, replay, manual-protection and campaign-race tests; then run the full persistence suite and production UI build.
