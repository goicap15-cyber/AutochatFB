# Data Model: Campaign Phone Automation

## Existing entities reused

### Campaign phone-result policy

| Field | Meaning | Rule |
|---|---|---|
| phone_capture_policy | capture-only, stop remaining, or thank then stop | Stored per campaign; never inferred after save. |
| phone_capture_status_id | optional target customer status | Recommended from a matching Đã có số status in the UI; still an explicit stored choice. |
| phone_capture_thank_you_text | acknowledgement text | Used only by thank-and-stop. |

### Contact conversion update

A live representation, not a new database entity: thread id, selected phone/provenance, status id/name/color and optional campaign outcome. It updates the contact panel and conversation summary in one action.

### Observer system notice fingerprint

Transient only. A recognized Meta system notice may have no stable Facebook identity; its normalized semantic marker plus a short observation window is used only to avoid repeated persistence. It is never saved as a customer message and never applied to arbitrary incoming text.

## State transitions

    valid incoming number + active configured campaign
      → durable capture
      → durable policy action
      → status applied when configured
      → CONTACT_UPDATED with phone + status
      → sidebar chip and status filter reflect the conversion

    valid incoming number outside campaign / capture-only
      → durable capture
      → CONTACT_UPDATED with phone only
      → current status unchanged

## Validation rules

- Suggested status matching compares normalized display names and must not replace an operator-edited target selection.
- A missing/deleted configured status is an audited non-fatal outcome.
- System-notice suppression requires a positive classifier match; missing message ID is insufficient.
