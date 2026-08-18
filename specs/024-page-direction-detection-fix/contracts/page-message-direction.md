# Contract: Page Message Direction Evidence

## Flow

page_content.js -> NEW_PAGE_MESSAGE_FROM_DOM -> background.js -> NEW_MESSAGE_RECEIVED -> server.js -> messages table -> ChatArea

The personal Messenger content.js path is unchanged.

## Payload

The bridge accepts this shape:

{
  "thread_id": "100092115712908",
  "fb_message_id": "mid.$example",
  "content": "ok khong",
  "page_id": "1209772058877160",
  "is_outgoing": true,
  "direction_source": "container_edge",
  "direction_confidence": "high",
  "timestamp_ms": 1786163455148,
  "timestamp_source": "dom_order",
  "source": "page_dom_observer"
}

For unknown geometry:

{
  "thread_id": "100092115712908",
  "fb_message_id": "mid.$example",
  "content": "ok khong",
  "is_outgoing": null,
  "direction_source": "unknown",
  "direction_confidence": "unknown",
  "source": "page_dom_observer"
}

## Semantics

| Payload | Server behavior |
|---|---|
| Boolean is_outgoing with high confidence | Insert confirmed or enter high-confidence reconciliation |
| is_outgoing null or unknown confidence | Persist one pending row when identity/content is available; use is_outgoing=0 only as storage placeholder |
| Existing confirmed row plus weak disagreement | Keep confirmed direction and do not create a flip candidate |
| Existing confirmed row plus high-confidence disagreement | Use the existing two-observation hysteresis, then update by fb_message_id |
| Existing pending row plus high-confidence direction | Update is_outgoing and promote direction_status to confirmed |
| Missing optional fields from old extension | Treat as legacy/low-confidence; do not flip an existing Page row |

## Idempotency

fb_message_id is the preferred key. Repeated delivery updates one row. A direction transition updates the existing row and never creates a second row with the same content.

## UI Contract

The server and Socket.IO payloads expose direction_status. The frontend must render pending rows neutrally and must not use is_outgoing=0 as an incoming signal while direction_status=pending.

## Compatibility

Timestamp reconciliation, outbound queue behavior, and the personal Messenger bridge remain unchanged.
