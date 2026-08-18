# Quickstart: Bulk Message Campaigns

This guide validates the campaign lifecycle without requiring a production send.

## Prerequisites

- Run the project from `/home/giang-adsup/dev/autochatbot`.
- Use a test database or a disposable account/source.
- Use test conversations where the operator is authorized to send.
- Keep the campaign capped at 5 recipients during validation.

## Validation scenarios

### 1. Reverse-order preview

1. Filter the inbox and select five eligible conversations.
2. Create a draft campaign with one text message.
3. Set start position to `5` and direction to descending.
4. Open the preview.

Expected: the preview shows `5, 4, 3, 2, 1`, with the expected thread/source/account on every row.

### 2. Sequential execution and pause

1. Start the campaign using a test source.
2. Confirm recipient 5 is dispatched first.
3. Pause the campaign while recipient 4 is pending.
4. Wait through one normal polling interval.

Expected: no new recipient is dispatched after pause is acknowledged; the current attempt is either confirmed or recovered according to its persisted state.

### 3. Retry and cancel

1. Make one recipient fail with a deterministic test adapter error.
2. Verify the recipient is `failed` and the campaign records the error.
3. Retry that recipient once.
4. Cancel the campaign with pending recipients remaining.

Expected: retry creates exactly one new attempt; cancelled recipients do not dispatch.

### 4. Restart recovery

1. Start a campaign with at least one pending recipient.
2. Stop and restart the backend before the next dispatch.
3. Reopen the campaign.

Expected: campaign status and recipient counters come from persisted rows; no recipient is dispatched twice automatically.

### 5. Attachment validation

1. Add a supported image under the configured limit.
2. Add an oversized or unsupported file.
3. Preview the campaign.

Expected: the valid attachment is referenced once; the invalid file is rejected with a reason; the campaign cannot start while required content is invalid.

## Automated checks

Run:

```bash
node --check src/server/server.js
npm run test:persistence
npm run build:ui
```

Add campaign unit/integration tests before enabling a live transport. Live tests must use a disposable, authorized source and a small recipient list.

## Feature flags and test-source allowlist

Campaign dispatch is fail-closed and disabled by default. A safe local validation configuration is:

```bash
CAMPAIGN_FEATURE_ENABLED=false
CAMPAIGN_IMAGE_ENABLED=false
CAMPAIGN_TEST_MODE=true
CAMPAIGN_TEST_SOURCE_IDS=source-id-for-authorized-test-page
CAMPAIGN_MAX_RECIPIENTS=5
CAMPAIGN_ACCOUNT_DAILY_CAP=5
CAMPAIGN_MIN_PACING_MS=3000
CAMPAIGN_QUIET_HOURS_START=22:00
CAMPAIGN_QUIET_HOURS_END=07:00
```

- `CAMPAIGN_FEATURE_ENABLED` must remain `false` until the disposable-source validation is explicitly authorized.
- Test mode is an allowlist guard, not a fake transport. It still uses the real Page adapter if the feature is enabled.
- Every source used in test mode must appear in `CAMPAIGN_TEST_SOURCE_IDS`; an empty list blocks start.
- Automated integration tests use an in-memory database and fake queue adapter, so they never send to Facebook.

## Supported attachments

- Enabled types: JPEG, PNG, and WebP images only.
- Maximum size: 8 MiB per image.
- Video, generic files, Personal Messenger, and unverified Page capabilities remain disabled.
- Image dispatch additionally requires `CAMPAIGN_IMAGE_ENABLED=true`.
- The server stores uploads under a generated checksum path and passes bytes through the authenticated extension WebSocket. It does not expose a public attachment URL.
- Missing, unreadable, oversized, signature-mismatched, or unsupported files block preview/start with an attachment-specific result.

## Safe manual validation

No live send is required for the automated checks above. If a manual end-to-end validation is later authorized:

1. Use one disposable Page/source owned by the operator.
2. Put that exact source id in `CAMPAIGN_TEST_SOURCE_IDS`.
3. Keep both recipient and daily caps at 5 or lower.
4. Confirm opt-out and route eligibility in preview.
5. Enable text only first; enable images in a separate test.
6. Disable both feature flags again immediately after the test.
