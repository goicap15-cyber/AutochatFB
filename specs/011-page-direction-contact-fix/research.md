# Research: Page Messenger Direction Reconciliation & Contact Identity (Phase 0)

## 1. Contact Name & Avatar Location
Based on the full DOM dump of the Business Suite message list (`data/dom_dump_full.html`), the customer's display name and avatar are reliably rendered directly alongside incoming message bubbles.

**Findings:**
- Incoming messages are wrapped in elements containing the `x1q0g3np` class (as discovered in Feature 010).
- When a customer sends a message (or the last message in a group of consecutive messages), their avatar is displayed next to it.
- The avatar is an standard `<img>` tag with the following properties:
  - `alt` attribute contains the customer's exact display name (e.g., `alt="Mang Bảo Khánh"`).
  - `src` attribute contains the URL to the customer's profile picture.
  - `height="32"` and `width="32"` (this distinguishes it from "seen" indicators which are `height="15"` and have "đã xem" in the `alt` text).

**Action:**
We don't need to guess arbitrary header classes that change often. We can reliably extract the `contact_name` and `avatar_url` directly from the message list using the selector:
`.x1q0g3np img[alt]:not([alt*="đã xem"])` or simply `.x1q0g3np img[height="32"]`.
This lookup will be throttled (done once per thread switch) in `page_content.js`.

This concludes Phase 0.
