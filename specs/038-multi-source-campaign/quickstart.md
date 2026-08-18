# Quickstart: Validate Multi-source Campaign Delivery

## Prerequisites

1. Start the existing CRM backend and UI using the project's normal development commands.
2. Prepare one active connected Page source and one active connected personal Messenger source. Each must have a known test recipient.
3. Prepare one disconnected/inactive personal source or disable its image capability for negative tests.
4. Keep existing Page campaign and personal rich-message test fixtures available; they are regression inputs, not replacements for the new campaign tests.

## Scenario A: Mixed text campaign

1. Select at least two Page and two personal conversations.
2. Open campaign creation and confirm source counts and route badges identify both types.
3. Create/preview a text campaign and verify each recipient snapshot displays the route it will use.
4. Start the campaign.
5. Verify each Page recipient receives from the expected Page and each personal recipient receives from the expected personal account.
6. Verify recipient rows reach a confirmation-backed sent state and audit entries retain their source type.

## Scenario B: Recipient-local failure

1. Include one recipient with a disconnected personal source plus an eligible Page recipient.
2. Start a text campaign.
3. Confirm the personal recipient has a source-specific failed/ineligible reason and no alternate source sends it.
4. Confirm the Page recipient continues under existing ordering/failure rules.

## Scenario C: Mixed campaign image capability

1. Attach a supported JPEG/PNG/WebP image.
2. Include one image-capable Page recipient, one image-capable personal recipient, and one personal recipient without image capability.
3. Validate before start: the unsupported recipient is clearly identified.
4. Start and confirm only capable routes receive the image; no caption-only fallback is emitted for the unsupported route.

## Regression checks

- Run the existing persistence/integration suite and the UI production build.
- Run focused campaign snapshot, execution, attachment, recovery, and personal rich-message routing tests.
- Add and run mixed-source campaign tests for source mismatch, no Page id on personal, Page id required on Page, route-local disconnect, retry/recovery, and legacy Page-only campaign compatibility.
- Manually verify that a personal tab identity or Page tab identity mismatch fails safely rather than changing the outgoing sender.
