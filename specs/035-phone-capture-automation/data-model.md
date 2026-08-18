# Data Model: Phone Capture Automation

## Existing entities

### `contacts`

`phone` remains the selected, operator-facing phone used by exports and filters.

| Field | Meaning | Rule |
|---|---|---|
| `phone_source` | `manual`, `message_capture`, or `legacy` | Legacy non-empty values become protected. |
| `phone_capture_id` | Selected capture evidence | Nullable reference to capture. |
| `phone_captured_at` | Original source-message time | Nullable; not the server detection time. |

### `campaigns`

| Field | Meaning | Rule |
|---|---|---|
| `phone_capture_policy` | `continue`, `stop_remaining`, `thank_then_stop` | Defaults to `continue`. |
| `phone_capture_thank_you_text` | Acknowledgement body | Required only for `thank_then_stop`. |
| `phone_capture_status_id` | Optional existing target status | Nullable. |

## New entities

### `contact_phone_captures`

Immutable evidence from an incoming message: `id`, `thread_id`, `normalized_phone`, `raw_phone`, `message_id`, `message_timestamp_ms`, `detected_at`, `rule_version`, and `selection_state` (`selected`, `candidate`, `ignored`).

- Unique `message_id + normalized_phone` prevents replay duplicates.
- Indexed by `thread_id + message_timestamp_ms`.
- Normal manual edits do not delete source evidence.

### `campaign_phone_capture_actions`

One durable response to one capture: `id`, `campaign_id`, `campaign_recipient_id`, `phone_capture_id`, policy snapshot, state, optional acknowledgement message, optional applied status, error detail and timestamps.

- Unique `campaign_recipient_id + phone_capture_id` prevents duplicate stop/thank actions.
- A recipient changes only for work not dispatched; in-flight work follows its existing settlement path.

## Relationships

```text
incoming message ──< contact_phone_capture >── contact
                                      │
                                      └──< campaign_phone_capture_action >── campaign recipient ── campaign
```

1. First-time incoming message creates zero or more captures.
2. A capture selects itself only when the contact phone is empty; otherwise it is a candidate unless duplicate.
3. An operator may select a candidate, updating the current contact phone and provenance.
4. Each matching active campaign may act once per recipient/capture pair.
