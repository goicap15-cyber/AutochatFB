# Contract: Campaign Phone Automation

## Campaign creation/update input

    {
      "phone_capture_policy": "stop_remaining",
      "phone_capture_status_id": 12,
      "phone_capture_thank_you_text": null
    }

The visible campaign card chooses these existing values. The target status is optional. A campaign with capture-only policy must not change a contact status.

## Realtime contact update

    {
      "thread_id": "100092115712908",
      "phone": "0989861561",
      "phone_source": "message_capture",
      "phone_captured_at": "2026-08-14T08:31:46.000Z",
      "status_id": 12,
      "status_name": "Đã có số",
      "status_color": "#C026D3"
    }

Consumers merge provided fields only. Status fields appear only when an existing campaign policy successfully applies them; otherwise status remains unchanged.

After policy processing, `CONTACT_UPDATED` is emitted again with the complete current phone/provenance and status view. This authoritative final patch lets the active contact panel, sidebar chip and status-filtered list converge without a reload; it never replaces fields that the server did not provide.

## System notice handling

A message positively classified as the Meta automatic-lead-activity notice is not persisted, broadcast as a conversation message, or passed to phone capture. An unclassified incoming message remains eligible even if its Facebook message id is absent.
