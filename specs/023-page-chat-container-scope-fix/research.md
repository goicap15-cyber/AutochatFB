# Research: Page Chat Container Scope Fix

## T001/T002 — Live DOM inspection (Business Suite, thread `Mang Bảo Khánh`, page `1209772058877160`)

**Attempted**: search the live DOM (including currently-unmounted state) for text matching known junk strings ("tài sản doanh nghiệp", "Tài khoản của bạn", "Trang quản lý tài sản doanh nghiệp") via a `TreeWalker` over `document.body`, both while the account/page-switcher panel was open and after.

**Finding**: the switcher panel is **not kept mounted while closed** (unlike a CSS-hidden dropdown) — once closed, `0` matching text nodes are found anywhere in the DOM. It is only present in the DOM for the brief window it's actually open, which proved too transient to reliably catch mid-inspection across a manual DevTools workflow. We were not able to capture the switcher panel's own ancestor chain (role/aria-label) live.

**Confirmed instead**: the real message-list container, resolved by `findMessageListContainer()` from an actual `[data-message-id]` anchor, is a real DOM node with:

```html
<div aria-label="Vùng chứa danh sách tin nhắn gồm có tin nhắn, gợi ý và chỉ báo đăng nhập"
     role="region" tabindex="0" class="x2atdfe xb57i2i x1q594ok x51xg6s x78zum5 xdt5ytf x1n2onr6 x1ja2u2z xw2csxc x1odjw0f xh8yej3 x5yr21d">
```

`findMessageListContainer()`'s region+label check (`label.includes('tin nhắn')`) correctly matches this node — confirmed no regression risk to genuine-message capture from tightening containment around this container.

**Risk identified**: the container's own `aria-label` explicitly states it holds "tin nhắn, **gợi ý** và **chỉ báo đăng nhập**" (messages, suggestions, and sign-in/account indicators) — not messages exclusively. This means Facebook may legitimately render account/login-related UI (plausibly including the account/page switcher) *inside* this same region. If so, a containment-only fix (FR-001, "only forward what's inside the real message-list container") would **not** exclude the switcher panel, since it would still test as contained.

**Decision**: do not rely on containment alone. Add a second, independent layer: extend the existing content-based denylist (`sysTexts` in `forwardResolvedMessage`, `src/extension/page_content.js` ~L508) with the specific junk strings already observed in production (see spec.md Input) — "tài sản doanh nghiệp", "tài khoản của bạn", "trang quản lý tài sản doanh nghiệp". This does not depend on knowing the switcher panel's exact container/role, and catches it even if containment alone would not.

## T002 (continued) — container always resolves before any message is forwarded

Not exhaustively re-verified across multiple threads live (time-boxed), but structurally guaranteed by existing code: `forwardResolvedMessage()` already requires `inChatContainer === true` (computed by walking up from the scanned node to find the region/main/grid ancestor) before forwarding anything (`src/extension/page_content.js` ~L496-498). A message can only be forwarded once its wrapper is scanned, which only happens once real `[data-message-id]` bubbles exist in the DOM for `findMessageListContainer()` to anchor from. No case was found where a message forwards with no container resolvable.

## Addendum — cleanup utility (Phase 4) correction

The original plan assumed junk rows have `fb_message_id IS NULL`. Direct inspection of `data/database.db` for thread `100092115712908` disproved this: junk rows instead carry a synthetic ID like `history_<hash>` — the fallback fingerprint `ConversationRepository.fingerprint()` (~L251) stamps on any message with no real Facebook ID. `messages` also has no `source` column at all (contrary to the plan's assumed `source = 'page_dom_observer'` filter); scoping instead requires `JOIN threads ... JOIN inbox_sources WHERE source_type = 'page_messenger'`.

Checked system-wide: every `fb_message_id LIKE 'history_%'` row in the current database (11/11, across all threads) is one of these switcher-panel junk items — none are genuine messages. This is a heuristic based on current data, not a proven-forever invariant, so `scripts/cleanupJunkPageUiMessages.js` treats it as one detection signal among two (content-pattern match OR `history_%` prefix) and always requires a dry-run review before `--apply`.

Also noted: the switcher panel renders dynamic content (Page names, contact names, BM handles - "Cà Phê Hà Nội - 299", "Mai Nguyen Ngoc", "Bm14126.adsup13") that a fixed content-string denylist can never fully enumerate. The `history_%` identity signal catches these where content matching cannot - confirmed by dry-run finding all 11 known-junk rows for the affected thread, including the dynamic-name ones the content denylist alone misses.

## Conclusion for Phase 1

Proceed with both layers:
1. Tighten `walkBubbleAncestors()`'s `inChatContainer` computation to test containment against the specific node `findMessageListContainer()` resolves, instead of an independent upward walk that accepts any `role="main"`/`role="grid"` ancestor (still valuable — catches anything genuinely outside the chat pane, e.g. sidebar/global nav).
2. Extend the `sysTexts` content denylist with the observed switcher-panel strings as a second, containment-independent layer, since the region container's own scope (confirmed above) may include non-message content that containment alone would not exclude.
