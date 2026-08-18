# Research: Page Message Capture Integrity (Phase 0)

## 1. Stable Per-Message Identity Signal
**Finding**: Facebook Business Suite **DOES** inject a stable, unique ID directly into the DOM for every message bubble.
- **Signal**: `data-message-id` attribute on the wrapper `div` of the message.
- **Format**: `mid.$cAAQXQILUZ2SmBzazzGf1fFcMNxMV`
- **Action**: We will extract this attribute and send it as `fb_message_id` (or `dom_message_key`). This completely solves the deduplication issue because `fb_message_id` is globally unique and stable across React re-renders and virtual scrolling.

## 2. Distinguishing Outgoing vs Incoming
**Finding**: The current heuristic (checking inline `text-align` or `flex-end` in the first 5 parents) is entirely incorrect for Business Suite because Meta uses utility classes for layout, not inline styles.
- **Signal for OUTGOING (Page)**: The flex wrapper immediately above the message bubble contains the utility class `x15zctf7` (which corresponds to `justify-content: flex-end`).
- **Signal for INCOMING (Customer)**: The wrapper contains the utility class `x1q0g3np` (or lacks `x15zctf7`).
- **Action**: We will detect outgoing messages by checking `element.closest('.x15zctf7')`. If it matches, the message is outgoing.

## 3. Virtualization and Timestamps
**Finding**:
- **Virtualization**: The DOM does unmount off-screen messages. We must implement a bounded scroll-back or rely on the fact that `data-message-id` allows us to safely process the entire visible list on every tick without duplication.
- **Timestamps**: There is NO exact timestamp (like `data-timestamp` or `title` hover) on individual messages. The only time indicators are the visual headers (e.g., `<span>14:19</span>`).
- **Action**: Since `fb_message_id` is available, we will rely on it for deduplication. For timestamps, we can attempt to parse the nearest visual header (or let the backend rely on insert order since `fb_message_id` deduplication prevents duplicate insert spam). To fix the sorting issue when old messages load, we will pass a `dom_order_index` or a calculated synthetic timestamp based on the nearest date header.

## Conclusion
The presence of `data-message-id` makes Phase 1 completely viable and robust. We will proceed to implement the `page_content.js` modifications.
