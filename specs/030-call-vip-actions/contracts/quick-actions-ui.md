# UI Contract: VIP Quick Action

## Location

The four existing action cards below the customer profile remain in place. Feature 030 makes only **VIP** interactive; **Gọi**, **Nhắc** and **Lưu** retain their current behaviour.

## VIP action

| Aspect | Contract |
|---|---|
| Label | \`VIP\` |
| Selected state | A contact tag equals \`VIP\` after trimming and case-insensitive comparison. |
| Activation when off | Adds one normalized \`VIP\` tag through the existing contact-save flow. |
| Activation when on | Removes the existing logical VIP tag through the same flow. |
| Saving state | Blocks repeat tag toggles and communicates progress without relying only on colour. |
| Failure state | Restores prior tags and announces a retryable error near the action. |
| Customer switch | A pending response from the previously active contact cannot update the new contact's UI state. |
| Accessibility | Semantic button, keyboard activation, visible focus, dynamic accessible name/state and non-colour selected cue such as check/filled star or text. |

## Compatibility constraints

- The same contract works in the full lead panel and the narrow lead drawer.
- Existing \`PUT /api/contacts/:thread_id\` payload remains authoritative for tags; Feature 030 exposes no new route.
- Existing custom tag editor, Lead Status, address, notes, filters, campaigns and rich messaging remain unchanged.
