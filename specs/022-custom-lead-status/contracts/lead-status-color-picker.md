# Contract: Lead Status Color Picker

## POST /api/lead-statuses

Request:

`{ "name": "Đã lấy số", "color": "#176CCD" }`

Successful response: existing endpoint shape, with `color` returned in canonical uppercase six-digit hex.

Validation:

- trim `name`;
- trim and uppercase `color`;
- require `/^#[0-9A-F]{6}$/`;
- malformed, short-hex, keyword, gradient, and alpha values return HTTP 400;
- duplicate-name behavior remains unchanged.

## Component contract

`LeadStatusColorPicker({ value, onApply, onCancel, triggerRef })`

- `value` is the committed canonical hex.
- Internal edits never call `onApply` until the user activates “Áp dụng”.
- Cancel, outside-click, and Escape call `onCancel` without committing.
- On close, focus returns to `triggerRef`.
- The component is not rendered outside the create-status flow.
