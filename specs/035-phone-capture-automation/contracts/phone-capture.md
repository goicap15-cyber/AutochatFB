# Contract: Phone Capture and Campaign Response

## Inbound live event

Emit `PHONE_CAPTURED` only after the capture is durably saved. It is additive; existing `LEAD_EXTRACTED` consumers remain compatible.

```json
{
  "thread_id": "thread_123",
  "captures": [{
    "id": "phone_capture_123",
    "normalized_phone": "0345678901",
    "raw_phone": "+84 345 678 901",
    "message_id": "fb_message_123",
    "message_timestamp_ms": 1780000000000,
    "selection_state": "selected"
  }]
}
```

No full message content is included. A replay creates neither a new row nor a second event.

## Contact payload

```json
{
  "phone": "0345678901",
  "phone_source": "message_capture",
  "phone_captured_at": "2026-08-14T08:30:00.000Z",
  "phone_capture": { "id": "phone_capture_123", "message_id": "fb_message_123" },
  "phone_candidates": []
}
```

Candidates differ from the selected current phone and are newest first. Selecting one is an explicit contact update containing the chosen `phone_capture_id`.

## Campaign input

```json
{
  "phone_capture_policy": "continue | stop_remaining | thank_then_stop",
  "phone_capture_thank_you_text": "Cảm ơn bạn, bên mình đã nhận được số điện thoại.",
  "phone_capture_status_id": 12
}
```

- Omitted policy defaults to `continue`.
- Thank-you text is required only for `thank_then_stop`.
- Target status must exist while saving a campaign; later deletion is an audited non-fatal outcome.

## Campaign audit

Record one of `phone_captured`, `phone_capture_stop_applied`, `phone_capture_thank_queued`, `phone_capture_thank_confirmed`, `phone_capture_thank_failed`, or `phone_capture_status_unavailable`. Payloads use IDs and normalized value only when necessary; do not duplicate raw message content.
