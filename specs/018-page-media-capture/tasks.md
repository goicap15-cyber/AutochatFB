# Tasks: Page Media Capture (Emoji, Stickers, Photos)

## Phase 1 — Content resolution helper

- [x] T001 Add `resolveMessageContent(messageIdNode)` in `page_content.js`, implementing the four `kind` outcomes from plan.md phase 1 (`text`, `emoji_text`, `media`, `none`).
- [x] T002 Heuristic (short `alt` with no ASCII letters → emoji; empty `alt` → media) tuned against the three real confirmed samples — hardcoded as literal fixtures in T006's validation script.

## Phase 2 — Shared identity/dedup/forward tail

- [x] T003 Refactored as `forwardResolvedMessage(messageIdNode, anchorElement, fbMessageId, isInsideMessageBubble, inChatContainer, resolvedContent, horizontalMidpoint)`. Feature 017 had already landed first, so its pending-id defer/resolve logic stayed in `processPotentialMessage()` (it only ever applies pre-identity, when `fbMessageId`/`messageIdNode` is still null — a state the new media pass never sees, since it only iterates elements already matching `[data-message-id]`); this refactor only pulled out the *post*-identity tail (direction, timestamp, dedup, structural filter, payload send), which both entry points now share unchanged.
- [x] T004 Payload extended with `media_type: 'image'`/`media_url` when `resolvedContent.kind === 'media'`; `content` uses `resolvedContent.caption || ''` for media, `resolvedContent.text` otherwise.

## Phase 3 — New per-wrapper media pass

- [x] T005 Added in `scanForMessages()`, after the text-node TreeWalker loop (so `processedWrappersThisTick` already reflects that pass's hits before this one runs). Iterates `messageEls`, skips anything already in `processedWrappersThisTick`, resolves content, and routes into `forwardResolvedMessage()`.

## Phase 4 — Validation

- [x] T006 Standalone Node script (`validate_018_media_capture.js`, scratch — not committed) with a minimal hand-rolled element shim (no jsdom in the project). All 3 real samples + 2 controls (plain text, empty wrapper) passed.
- [~] T007 Manual test on the "Mang Bảo Khánh" Page thread: picker emoji (💩 x3) ✅ landed as text; CSS-background sticker ✅ landed with image rendering via `MediaViewer`. Plain `<img>` case (real photo / image-sticker) initially did NOT land — traced to a backend guard dropping empty-content media (see plan.md Addendum, fixed in `server.js:281`). Re-test of the `<img>` case after that fix still pending.
- [ ] T008 Manual test: send a plain-text message; confirm zero change in behavior (no double-forward, same content/timestamp/direction as before). **(requires live browser test — not run by this pass)**
- [x] T009 Ran `npm run test:persistence` (18/18 pass, no regression) and `graphify update .`.

## Dependencies

- Phase 1 blocks Phase 2 and 3.
- Phase 2 blocks Phase 3 (T005 routes into Phase 2's shared tail).
- Phase 4 runs last.
- No hard ordering requirement against feature 017 (see plan.md's Safety Gates) — whichever lands second rebases on the other's tail-section shape.
