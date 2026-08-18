# Implementation Plan: Global Phone Automation

## Technical Context

Node/Express backend, SQLite migration, Socket.io contact updates, Vite/React modal UI, existing phone-capture pipeline.

## Design

1. Persist one opt-in singleton setting with enabled flag and optional lead-status reference.
2. Validate settings server-side; do not let UI enable a rule without a target.
3. Apply the global status after a genuine capture, before the existing campaign policy. Campaign target therefore remains the explicit override.
4. Reuse the established CONTACT_UPDATED event so active panel/sidebar/filter stay synchronized.
5. Expose a compact accessible modal from the expanded CRM navigation.

## Safety

- No status is changed while disabled.
- Existing phone extraction distinguishes incoming from outgoing.
- Phone capture service retains its existing fill-only/manual protection.
- Deleting a target status clears the database reference; the rule then becomes ineffective until reconfigured.
