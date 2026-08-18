# Tasks: Multi-source Campaign Delivery (Spec 038)

- [x] T001 Database migration & schema updates: add snapshot columns `source_type_snapshot`, `source_external_id_snapshot`, and `source_display_name_snapshot` to `campaign_recipients`.
- [x] T002 Implement `CampaignRouteService` / route capability extraction to inspect thread routes and determine text/image capabilities consistently for Page and Personal Messenger.
- [x] T003 Update `CampaignEligibilityService` and `CampaignRepository` to create and query multi-source recipient snapshots with backward compatibility for legacy Page-only campaigns.
- [x] T004 Update `CampaignRunner`, `CampaignService`, and `enqueueCampaignMessage` to dispatch via the v2 queue envelope with source isolation and fail-closed revalidation.
- [x] T005 Update frontend UI components (`CampaignCreateModal.jsx`, `CampaignRecipientTable.jsx`, `CampaignDetail.jsx`, `CampaignComposer.jsx`) for mixed Page/Personal counters, badges, and route-aware outcome labels.
- [x] T006 Add comprehensive integration tests in `tests/integration/multiSourceCampaign.test.js` covering mixed dispatch, fail-closed isolation, attachment capability gating, retry/recovery, and legacy Page-only campaign compatibility.
- [x] T007 Run full persistence test suite, production UI build, and update knowledge graph via `graphify update .`.

## Verification Checklist

- [x] Focused multi-source campaign integration tests pass (5/5).
- [x] `npm run test:persistence` passes with zero regressions (265/265).
- [x] `npm run build:ui` completes successfully.
- [x] Knowledge graph updated via `graphify update .`.
