# Research: Campaign File Transport

**Status (2026-08-17)**: the decisions below are the target design. Verified against code this session: none of the manifest/ZIP/route-capability-for-files decisions are implemented yet except the route-capability split (see `plan.md` "Current State" and `tasks.md` for exact status per task).

## Decisions

### ZIP library

No ZIP-creation dependency exists in this repo yet. Recommend `yazl` (zero runtime dependencies, streaming ZIP writer) over `archiver` (heavier, more transitive dependencies) to match this repo's otherwise lean `package.json`. Not yet added — do this as part of implementing T005/folder packaging, not before.

### Manifest and folder handling

Use one attachment manifest per campaign message. Multiple selected files remain in the manifest; a selected folder is packaged as one ZIP while preserving relative paths. Facebook receives files, not native folders.

### Shared validation

Reuse Spec 027's `attachmentValidation.js`, safe filename/path handling, checksum verification, storage lifecycle, and retention rules. Do not create a campaign-only validator.

### Route capability

Evaluate file capability independently for each saved Page/personal route. Personal arbitrary-file delivery remains feature-flagged off until live verification of its attachment control, upload, send, and confirmation flow.

### Confirmation

Composer dispatch is not delivery confirmation. Queue/message/attempt become sent only after a matching Facebook file observation for the same thread, route, manifest, and attempt.

## Safeguards

- Reject empty files/folders, traversal, absolute paths, symlinks, unsafe archive entries, and size overflow.
- Recalculate the payload checksum immediately before dispatch.
- Keep campaign queue idempotency separate from rich-message outbound attempt idempotency.
