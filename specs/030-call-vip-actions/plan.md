# Implementation Plan: CRM VIP Quick Action

**Branch**: \`030-call-vip-actions\` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

Activate only the existing VIP quick-action card in \`LeadDetailsPanel\`. VIP toggles the existing contact tag through the current optimistic save/rollback path, while guarding against an old request updating a newly selected customer. Gọi, Nhắc and Lưu remain untouched. No data migration, new endpoint, call provider, reminder, archive, or call history is added.

## Technical Context

- **Language/Version**: JavaScript/JSX; React 19 frontend; Node.js backend
- **Primary Dependencies**: React hooks, lucide-react, existing CSS tokens/Tailwind utilities
- **Storage**: Existing contact \`tags\` field only; no schema change
- **Testing**: Node test runner, existing persistence suite, Vite build, browser manual validation
- **Target Platform**: CRM desktop and narrow lead drawer
- **Project Type**: React frontend + Node/Express backend
- **Performance Goals**: VIP state derives locally and reacts immediately; one existing contact-save request per toggle
- **Constraints**: Preserve active-contact boundaries, existing tag validation/rollback, accessibility and Specs 022/027/028/029; do not alter Gọi/Nhắc/Lưu
- **Scale/Scope**: One quick action in the shared lead panel rendered in desktop and drawer variants

## Constitution Check

The project constitution is an unfilled template and supplies no enforceable project-specific gate. This plan reuses the existing contact persistence contract, isolates the stale-response guard and keeps scope to one action. **Result: PASS.**

## Architecture and State Flow

\`\`\`text
committed contact tags + active contact identity
      │ case-insensitive VIP membership
      ▼
VIP quick action
      │ optimistic toggle; block duplicate mutation
      ▼
existing onSaveContact(tags)
      ├── success for active contact ─► retain selected/unselected state
      ├── failure for active contact ─► restore prior tags + contextual error
      └── response for old contact ───► ignore UI update
\`\`\`

- Reuse \`parseTags\`, \`hasTag\`, \`toggleTag\`, \`areTagsEqual\` and the existing \`handleToggleTag\` persistence/rollback flow rather than implementing a second tag writer.
- Add an operation/contact guard in the panel so asynchronous responses cannot clear saving or restore tags after a contact switch.
- A narrow drawer and desktop panel both instantiate \`LeadDetailsPanel\`, so a single implementation covers both.

## Implementation Phases

### Phase 1 — Test the VIP rules

- Add \`tests/unit/leadVipAction.test.js\` before component work, covering case-insensitive add/remove, other-tag preservation and the maximum-tag failure delegated from the tag helper.
- Extend the pure test coverage for stale operation identity if extracted as a small local helper; otherwise cover this during focused component/manual validation.

### Phase 2 — Wire accessible VIP

- Update \`src/client/components/LeadDetailsPanel.jsx\` so VIP is semantic, keyboard operable, has a visible focus style, \`aria-pressed\`, dynamic accessible copy and a non-colour selected cue.
- Route VIP to the existing toggle transaction. Keep Gọi, Nhắc and Lưu free from new onClick behavior.
- Make tag save errors visible near the quick actions without removing existing editor feedback.
- Bind in-flight tag work to the active contact and ignore stale success/failure/finally updates after switching contact.

### Phase 3 — Regression and validation

- Run \`npm run test:persistence\` and \`npm run build:ui\`.
- Browser-test VIP on/off, legacy \`vip\`, other tags, max tags, failed save, customer switching, keyboard-only operation, zoom 200%, desktop panel and narrow drawer.

## Project Structure

\`\`\`text
src/client/components/
└── LeadDetailsPanel.jsx                # wire VIP and stale-response guard

tests/unit/
├── tags.test.js                        # existing regression coverage
├── leadTagsLogic.test.js               # existing transaction coverage
└── leadVipAction.test.js               # new VIP-specific rules

specs/030-call-vip-actions/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/quick-actions-ui.md
├── quickstart.md
└── tasks.md
\`\`\`

**Structure Decision**: The feature is frontend-only and uses the established contact-save callback. There is no backend source change, migration, or route change.

## Safety Gates

- VIP cannot create a duplicate logical tag and preserves unrelated tags.
- A failed VIP save restores the prior tags and exposes an actionable error.
- A stale request cannot mutate a newly selected customer's UI state.
- Gọi, Nhắc, Lưu, contact form save, custom tags, statuses, filters, campaigns and rich messaging remain unchanged.

## Complexity Tracking

No constitution violations or added complexity requiring justification.
