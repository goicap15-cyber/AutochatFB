# Contract: Global Phone Automation

## GET /api/settings/phone-automation

Returns `enabled`, `status_id`, `status_name`, `status_color`, and `updated_at`.

## PUT /api/settings/phone-automation

    { "enabled": true, "status_id": 7 }

Returns HTTP 400 if enabled without a valid status. On success it broadcasts `PHONE_AUTOMATION_SETTINGS_UPDATED`.

## Capture order

1. Genuine inbound text creates phone-capture evidence.
2. Enabled global rule applies its target status.
3. A matching active campaign with its own target status may replace it.
4. CRM emits authoritative `CONTACT_UPDATED` with phone/provenance and final status.
