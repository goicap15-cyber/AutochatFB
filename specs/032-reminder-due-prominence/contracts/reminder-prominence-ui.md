# UI Contract: Reminder Due Prominence

## Conversation card states

| State | Required presentation |
|---|---|
| Due | Card-level urgency treatment, bell indicator, `CẦN NHẮC`, relative urgency text and accessible label |
| Future reminder | Existing calm reminder indicator only |
| No active reminder | Existing conversation-card presentation |
| Selected and due | Selected state remains clear; urgency label remains available |
| Reduced motion and due | Same text, icon and contrast signals; no continuous pulse |

## Ordering contract

1. Determine visible conversations with current archive mode, search, workflow tab and filters.
2. Keep that exact membership.
3. Show due conversations first.
4. Preserve pre-priority relative order inside both groups.

## Non-goals

- No reminder scheduling, completion, cancellation or persistence change.
- No sound or external notification.
- No change to filter membership or campaign-selection eligibility.
