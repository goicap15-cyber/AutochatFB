# Quickstart: Campaign Phone Automation

## Prerequisites

1. Start CRM and connect a Page route.
2. Create reusable status Đã có số.
3. Prepare a campaign with at least two recipients and two messages.

## Campaign conversion workflow

1. Open campaign creation and confirm the visible Khi khách gửi số điện thoại card recommends Đã có số and dừng các tin chưa gửi.
2. Save/preview the campaign; reopen it and confirm the same policy/status summary is visible.
3. Start the campaign. From a separate customer identity, send a valid Vietnamese number before that recipient’s next campaign message.
4. Confirm contact phone/provenance appears, the sidebar chip changes to Đã có số, and later campaign work for that recipient follows the chosen action.
5. Open the conversation filter, select Đã có số, and confirm the converted recipient appears without refreshing the browser.
6. Repeat with capture-only; confirm the phone is stored but the status does not change.

## Meta notice hygiene

1. Open/reload a Page conversation containing the Meta automatic-lead-activity notice.
2. Confirm CRM does not add repeated copies to its message history.
3. Send a real incoming id-less test message where the observer permits it; confirm it remains visible and normal capture behavior remains available.

## Automated checks

Run focused presentation/classifier/realtime tests, then npm run test:persistence and npm run build:ui.

Verified on 2026-08-14: focused checks 9/9, `npm run test:persistence` 256/256, and `npm run build:ui` passed. The connected-Page observer walkthrough above remains a manual acceptance check.
