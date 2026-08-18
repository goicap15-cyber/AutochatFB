# Data Model: Page Direction Detection Fix

## Captured Page Message

| Field | Type | Meaning |
|---|---|---|
| thread_id | string | Business Suite conversation id |
| fb_message_id | string or null | Stable Facebook id for deduplication and repair |
| content | string | Cleaned text |
| page_id | string or null | Page asset id |
| is_outgoing | boolean or null in transport | Boolean when known; null means direction is unknown before persistence |
| direction_source | enum | identity, container_edge, mixed_geometry, legacy_midpoint, unknown |
| direction_confidence | enum | high, medium, unknown |
| timestamp_ms | integer | Existing ordering value |
| timestamp_source | string | Existing timestamp provenance |
| source | string | page_dom_observer |

## Persisted Message

The SQLite messages table keeps the existing non-null is_outgoing column:

| Field | Type | Rule |
|---|---|---|
| is_outgoing | BOOLEAN NOT NULL | Always 0 or 1 for storage compatibility |
| direction_status | TEXT NOT NULL | confirmed or pending |
| fb_message_id | TEXT UNIQUE | Preferred identity key |
| timestamp_ms | INTEGER | Existing ordering field |
| created_at | DATETIME | Existing receipt/derived time |

For a pending Page message, is_outgoing=0 is only a storage placeholder. direction_status=pending is authoritative for rendering and reconciliation. The UI must never interpret a pending placeholder as confirmed contact-sent direction.

Existing rows receive direction_status=confirmed through the migration default. No existing is_outgoing value is changed by the migration.

## Direction Evidence

The pure helper receives:

- container_left
- container_right
- bubble_left
- bubble_right

It computes left_gap and right_gap:

- Clearly smaller right_gap means outgoing.
- Clearly smaller left_gap means incoming.
- Missing geometry or an ambiguity-tolerance tie means unknown.

## State Transitions

| Current state | Evidence | Next state | Action |
|---|---|---|---|
| no row | high-confidence outgoing/incoming | confirmed | Insert with the detected boolean |
| no row | unknown or ambiguous | pending | Insert with is_outgoing=0 placeholder |
| pending | unknown or low confidence | pending | Update identity/content if needed; do not change direction |
| pending | high-confidence direction | confirmed | Update is_outgoing and status in place |
| confirmed | agreeing high-confidence direction | confirmed | Keep row; clear any flip candidate |
| confirmed | first high-confidence disagreement | confirmed | Store hysteresis candidate only |
| confirmed | second matching high-confidence disagreement | confirmed | Commit direction update in place |
| confirmed | unknown/low confidence disagreement | confirmed | Do not change row |

## Rendering Rule

ChatArea chooses layout from direction_status first:

- confirmed + is_outgoing=1: right/outgoing
- confirmed + is_outgoing=0: left/incoming
- pending: neutral pending layout, not left/incoming

## Retention and Deduplication

A pending row is retained by fb_message_id when available. Repeated observations update the same row and do not create duplicate messages. Unknown messages must remain eligible for later direction evaluation; marking them as permanently processed before confirmation would risk losing the eventual correction.
