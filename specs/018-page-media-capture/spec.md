# Feature Specification: Page Media Capture (Emoji, Stickers, Photos)

**Feature Branch**: `018-page-media-capture`
**Created**: 2026-08-07
**Status**: Draft

**Input**: `page_content.js`'s `scanForMessages()` only walks TEXT nodes (`document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, ...)`). Any message bubble whose entire content is non-text (an emoji-picker emoji, a sticker, or a real photo) contains zero text nodes, so `processPotentialMessage()` is never invoked for it — the message is entirely invisible to capture, not merely missing its content. Confirmed live via DevTools across three distinct DOM shapes sent in the same test thread ("Mang Bảo Khánh" Page):

1. **Picker emoji** (e.g. 💩): `<img alt="💩" src="https://static.xx.fbcdn.net/images/emoji.php/v9/.../1f4a9.png">` — `alt` holds the real Unicode character.
2. **Photo or image-based sticker** (indistinguishable by DOM — confirmed both a real uploaded photo and a sticker render identically): `<img alt class="img" src="https://scontent...fbcdn.net/v/t1.15752-9/...">` — empty `alt`, no usable text, only a `src` URL.
3. **CSS-background sticker** (no `<img>` tag at all): `<div role="img" aria-label="Joyful Plans, characters leaning in and rubbing hands together gleefully sticker" style="background-image:url('https://scontent...fbcdn.net/v/t39.1997-6/....webp?...'); ...background-size:120px;height:120px;width:120px;"></div>` — the image is a CSS `background-image`, and `aria-label` is an auto-generated accessibility description, not real message text.

All three live inside the same `[data-message-id]` wrapper structure already used for text messages.

## User Stories

### US1 — A picker emoji is captured as text (P1)
Given a message bubble contains only a picker-emoji `<img alt="...">`, its `alt` value is captured as the message's text content, same as if it had been typed as a literal character.

**Acceptance**: Sending a Page message that is only an emoji-picker emoji results in a `messages` row whose `content` is that emoji character.

### US2 — A photo or image-sticker is captured as media (P1)
Given a message bubble contains an `<img>` with no usable `alt` and a `src` pointing to Facebook's CDN, the message is captured with `media_type`/`media_url` populated (schema already supports this — `media_type`, `media_url`, `local_media_path` columns exist and are already part of the `INSERT` in `server.js:435`, just never populated from the Page DOM path today).

**Acceptance**: Sending a Page message that is a real photo, or a sticker rendered as `<img>`, results in a `messages` row with a non-null `media_url` and `media_type = 'image'`; `content` may be empty or a short placeholder — this feature does not need to distinguish "real photo" from "image sticker" since they are DOM-identical.

### US3 — A CSS-background sticker is captured as media too (P1)
Given a message bubble contains a `div[role="img"]` with a `background-image` CSS `url(...)` and no `<img>` tag, the message is captured with `media_url` extracted from that `url(...)`, and `aria-label` (if present) used as a fallback caption/content.

**Acceptance**: Sending a Page message that is a CSS-background sticker results in a `messages` row with `media_url` populated from the extracted URL.

### US4 — Existing text-message capture is unaffected (P2)
Given a normal text message bubble (with or without emoji mixed in), capture behavior is unchanged from today.

**Acceptance**: `npm run test:persistence` still passes; a plain-text Page message is captured exactly as before.

## Functional Requirements

- **FR-001**: `scanForMessages()` MUST, for every currently-mounted `[data-message-id]` wrapper (the same `messageEls` list it already computes), check for embedded media independently of whether that wrapper produced any TreeWalker text-node hit — a wrapper containing only media MUST still be processed exactly once per new/changed content.
- **FR-002**: An `<img>` whose `alt` is non-empty and looks like a short emoji/character sequence (not a Facebook-generated caption sentence) MUST have its `alt` folded into the message's text content (US1).
- **FR-003**: An `<img>` whose `alt` is empty/missing, with a `src` pointing to a Facebook CDN host, MUST be captured with `media_type: 'image'`, `media_url: <src>` (US2).
- **FR-004**: A `div[role="img"]` with a `background-image: url(...)` in its inline `style` MUST have that URL extracted (regex on the `style` attribute) and captured with `media_type: 'image'`, `media_url: <extracted url>`; its `aria-label`, if present, MAY be used as `content` (US3).
- **FR-005**: Media messages MUST reuse the same identity (`data-message-id` → `fbMessageId`), direction (`isMessageOutgoing`), timestamp (`assignOrderedTimestamps`/backlog fallback), dedup (`processedHashes`), and — once feature 017 lands — pending-ID handling as text messages; this feature only adds *what* gets extracted from a wrapper, not the surrounding identity/dedup/timestamp machinery.
- **FR-006**: The existing text-node TreeWalker path and `processPotentialMessage()`'s behavior for plain text messages MUST NOT change (US4) — media detection is an *additional* pass, not a replacement.
- **FR-007**: Scoped to `page_content.js` (Business Suite) only. `content.js` (personal messenger) has the same `media_type: 'text'`-always gap, confirmed during investigation, but is explicitly out of scope for this feature.

### Key Entities

- **Media Wrapper**: a `[data-message-id]` element whose content resolves to an image URL rather than (or in addition to) text, via one of FR-002/003/004's three DOM shapes.

## Success Criteria

- **SC-001**: All three DOM shapes verified live in this investigation (picker emoji, `<img>` photo/sticker, CSS-background sticker) are captured — either as text (emoji) or as a `messages` row with `media_url` populated (photo/sticker).
- **SC-002**: No regression to plain-text message capture or to feature 017's pending-ID handling.
- **SC-003**: `npm run test:persistence` passes.

## Assumptions

- "Looks like a short emoji/character sequence" (FR-002) can be distinguished from a Facebook-generated caption sentence (as seen in FR-004's `aria-label`, e.g. "Joyful Plans, characters leaning in...") by length/shape (a handful of Unicode codepoints vs. a multi-word English sentence) — exact heuristic to be finalized during implementation, verified against both real samples from this investigation.
- The tiny 15×15 "seen" receipt avatar (`<img alt="Cà Phê Hà Nội - 299 đã xem lúc ..." height="15" width="15">`, visible in the live DOM dumps) is NOT inside a `[data-message-id]` wrapper and is therefore naturally excluded by FR-001's scoping to `messageEls` — needs confirmation during implementation, not assumed blindly.
- Downloading media to `local_media_path` (like the existing avatar-download helper `saveAvatarFromBase64OrUrl`) is NOT required by this feature — storing `media_url` (the live Facebook CDN URL) is sufficient for US2/US3; a local-download pipeline can be a follow-up if CDN URLs expire before the CRM needs to display them.
