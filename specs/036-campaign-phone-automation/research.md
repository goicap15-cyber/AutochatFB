# Research: Campaign Phone Automation

## Decision 1: Make conversion automation visible and recommended

**Decision**: Present Khi khách gửi số điện thoại as a dedicated campaign card. If an existing status normalizes to Đã có số, select it and recommend dừng các tin chưa gửi; otherwise start capture-only and show a clear empty-state hint.

**Rationale**: The requested workflow is campaign-level automation for many recipients. Keeping it under generic advanced controls makes a valid configuration too easy to miss; a visible reviewable default provides automation without adding a hidden global rule.

**Alternatives considered**: Retain capture-only as the UI default (safer but repeats the confusing result); add a global always-change-status rule (would affect non-campaign traffic).

## Decision 2: Reuse durable policy and action records

**Decision**: Use existing campaign policy/status fields and capture-action records, without a migration.

**Rationale**: They already retain policy, target status, safe stop and audit result. This feature corrects discovery/defaulting/realtime visibility, not persistence capability.

## Decision 3: Publish full contact state after a successful policy action

**Decision**: Realtime contact updates contain thread id, status id/name/color, selected phone and provenance; all cached representations merge it.

**Rationale**: The status filter operates on conversation summaries, so updating only the details panel would leave the conversion list stale until refresh.

## Decision 4: Suppress only classified Meta system messages

**Decision**: Create a pure classifier for the known automatic-lead-activity notice and use it before normal message persistence. Apply a short fingerprint dedupe only to classified system notices with no stable message id.

**Rationale**: Logs show the repeated notice arrives with no Facebook id, so generic id-less dedupe could discard a real customer reply. Exact classification fixes the real issue safely.
