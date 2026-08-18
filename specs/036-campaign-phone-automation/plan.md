# Implementation Plan: Campaign Phone Automation

**Branch**: 036-campaign-phone-automation | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

Make the existing phone-capture campaign policy understandable and operational at campaign creation: preconfigure the normal sales workflow (valid number → Đã có số → stop remaining outreach), show its consequence before preview, and reconcile the result live into the list and status filter. In the same bounded change, discard known Meta lead-activity UI notices and deduplicate recognised observer-only notices before they pollute CRM history.

## Technical Context

**Language/Version**: JavaScript, Node.js 24, React 19  
**Primary Dependencies**: Express, Socket.IO, better-sqlite3, React, Lucide, Tailwind utilities  
**Storage**: Existing SQLite campaign/contact/status/action tables; no new persistent entity expected  
**Testing**: Node built-in test runner; persistence/integration suite; Vite production build  
**Target Platform**: Local desktop CRM with supported Facebook Page/Messenger extension routes  
**Project Type**: Web application  
**Performance Goals**: Status chip/filter reflects a successful capture during the active CRM session without manual reload; observer notice filtering adds no perceptible delay to normal incoming messages.  
**Constraints**: Never change a status for capture-only/no-policy traffic; preserve phone provenance/manual protection; never suppress real user text just for missing a Facebook message ID; do not alter outbound transport.  
**Scale/Scope**: Bulk campaigns up to existing recipient cap, live contact/sidebar views, Page DOM observer system notices only.

## Constitution Check

The project constitution is a placeholder. Practical gates applied here are: preserve forward-safe data semantics, test status/filter state and observer classification independently, reuse existing campaign policy/action idempotency, and avoid touching Facebook sending mechanics.

**Result: Pass.** No new schema or transport is required. The work is a presentation/defaulting layer over the existing durable policy plus a narrow inbound hygiene guard.

## Research Decisions

1. **Visible, campaign-scoped automation card.** Move phone-result controls out of generic advanced settings. When a normalized reusable status named Đã có số exists, select it as the visible recommendation and preselect stop_remaining; the operator can choose capture-only, thank-and-stop, a different status, or no status before saving. If no matching status exists, keep the safe capture-only default and guide creation/selection.
2. **Persist only existing policy fields.** The current campaign fields and durable capture-action records are sufficient. The recommendation is UI-only; no global rule or schema migration is introduced.
3. **Realtime update is authoritative.** After the existing policy action applies a status, emit one complete contact update containing status id/name/color and capture provenance. Both selected-contact state and conversation rows merge this authoritative patch; the existing status filter therefore needs no manual list refresh.
4. **Known Meta notice suppression first.** Classify the exact automatic-lead-activity message as a Page system notice before persistence. For future recognised observer notices lacking stable IDs, use a bounded fingerprint/time-window guard only after system classification. Do not apply that fallback to ordinary customer text.
5. **Audit language stays user-facing.** Retain raw immutable audit types in payload/details, but display Vietnamese labels and the target status name where present.

## Project Structure

    specs/036-campaign-phone-automation/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    ├── contracts/campaign-phone-automation.md
    └── tasks.md

    src/client/
    ├── App.jsx
    └── components/CampaignCreateModal.jsx, CampaignComposer.jsx, CampaignDetail.jsx,
        ConversationSidebar.jsx and ConversationFilterPopover.jsx

    src/server/
    ├── server.js
    ├── repositories/CampaignRepository.js
    ├── services/CampaignPhoneCaptureService.js
    └── utils/pageSystemNotice.js (new shared classifier)

    src/extension/page_content.js or content.js

    tests/unit/campaignPhoneAutomationPresentation.test.js and pageSystemNotice.test.js
    tests/integration/campaignPhoneAutomationRealtime.test.js

**Structure Decision**: Extend existing campaign, contact and Page-observer boundaries. The only proposed new module is a pure system-notice classifier so extension and backend share the same narrow rule rather than diverging string checks.

## Implementation Steps

1. Add pure default/recommendation and system-notice classification logic with tests.
2. Promote campaign phone-result configuration into a visible, reviewed campaign-creation/edit section and show the policy summary in details.
3. Strengthen the post-capture realtime patch so sidebar status chips and applied filters update together.
4. Suppress known Meta notices before persistence and protect future recognised system notices from re-render duplication.
5. Add integration tests for a multi-recipient campaign conversion/filter flow; run persistence suite, UI build and manual Page verification.

## Complexity Tracking

| Added component | Why needed | Simpler alternative rejected because |
|---|---|---|
| Shared system-notice classifier | Prevents extension/backend disagreement about Meta notices | One inline string check cannot safely serve two inbound paths or be tested independently. |
| Campaign automation presentation helper | Keeps suggested Đã có số default stable without overwriting an operator draft choice | Hardcoding defaults inside multiple components would drift and make edits reset unexpectedly. |
