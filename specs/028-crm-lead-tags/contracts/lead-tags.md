# Contract: CRM Lead Tags

## Existing contact update API

### Request

PUT /api/contacts/:thread_id

The feature uses the existing payload field:
{ "tags": ["Tiềm năng", "Khách VIP"] }

The client should send the complete canonical array for the active contact, alongside existing contact fields where required by the current save callback.

### Behavior

- Empty list is valid and clears all tags.
- Duplicate values after trim/case-fold are not sent.
- Existing unknown valid tags are preserved.
- A failed request leaves the prior committed list authoritative and returns an error to the editor.

## UI component contract

Conceptual component: LeadTagsEditor

- Inputs: value: string[], starterTags: string[], onApply(nextTags), onCancel(), disabled?
- Starter chips are toggle buttons with aria-pressed.
- Add input has an accessible label and Enter-to-add.
- Remove buttons identify the tag by name.
- Cancel/Escape never calls onApply.
- Apply is disabled when the draft is invalid, unchanged, or saving.
- Focus returns to the opener after close.
