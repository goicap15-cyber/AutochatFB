# Research: Visual Lead Status Color Picker

## Decision: use react-colorful behind a local wrapper

Use `react-colorful`'s `HexColorPicker` for the color plane and hue interaction, but expose it only through `LeadStatusColorPicker.jsx`. The local wrapper keeps CRM-specific layout, focus behavior, validation, labels, Apply/Cancel semantics, and theme tokens under project control.

Reasons: the package is purpose-built and small, avoids maintaining pointer/keyboard color mathematics in application code, and supports controlled React state. The wrapper prevents vendor-specific behavior from leaking into `LeadDetailsPanel.jsx`.

References:
- https://www.npmjs.com/package/react-colorful
- https://react-colorful.netlify.app/docs/about/

## Decision: transactional draft state

The picker is an editor nested inside the unsaved create-status form. Therefore changes inside the picker stay in `draftColor` until “Áp dụng”. Closing the picker discards the draft; only outer “Tạo” performs the POST. This avoids accidental persistence and gives both Cancel buttons unambiguous scopes.

## Decision: opaque normalized storage

Persist uppercase `#RRGGBB` only. This matches the existing `lead_statuses.color TEXT NOT NULL` model and all current CSS consumers while excluding ambiguous short hex, alpha, gradients, and CSS keywords. Validate on both client and server; the server is authoritative.

## Decision: conditional mounting

The entire picker is rendered only when both the create form and picker are open. This satisfies the user's visibility requirement, reduces hidden interactive DOM, and makes cleanup testable. Closing the parent form always resets child state.

## Alternatives rejected

- Native `<input type="color">`: compact but browser/OS UI varies and does not provide the requested integrated Photoshop-like panel.
- Continue preset dots: cannot choose arbitrary colors and is the behavior being replaced.
- Build the color plane from scratch: unnecessary interaction, accessibility, and cross-browser risk.
- Store HSL/RGBA: current consumers expect hex and transparency is not requested.
