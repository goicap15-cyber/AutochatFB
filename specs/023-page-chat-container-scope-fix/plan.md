# Implementation Plan: Page Chat Container Scope Fix

## Architecture

Keep the existing feature-010 topology unchanged: `page_content.js` (DOM observer in the Business Suite tab) → `background.js` → Socket.IO → `server.js` → `ConversationRepository`. This fix touches only the *eligibility* gate inside `page_content.js` that decides whether a scanned DOM fragment is allowed to become a message at all — it does not touch identity, timestamp, or direction logic already hardened in feature 010, and does not touch `content.js`, the outbound queue, or `PageMessengerAdapter.js`.

## Phases

0. **Research spike (done — see `research.md`)**: live inspection confirmed the real message-list container (`findMessageListContainer()`'s result) is a genuine, correctly-labeled `role="region"` node ("...danh sách tin nhắn gồm có tin nhắn, gợi ý và chỉ báo đăng nhập"). Could not capture the switcher panel's own ancestor chain live (it unmounts entirely when closed, too transient to catch mid-inspection). Critically, the container's own aria-label admits it holds non-message content too ("gợi ý", "chỉ báo đăng nhập") — so containment alone is not guaranteed to exclude the switcher panel if it renders inside the same region. Decision: ship two independent layers (1 and 1b below), not containment alone.

1. **Tighten containment (extension)**: change `walkBubbleAncestors()` in `src/extension/page_content.js` (~L377) so `inChatContainer` is computed by testing `element.closest(...)` / `container.contains(element)` against the container `findMessageListContainer()` resolves for the current thread, not by independently walking up and accepting the first `role="main"`/`role="grid"` ancestor found. `findMessageListContainer()`'s own resolution logic (region+aria-label OR main/grid, walked up *from an actual `[data-message-id]` node*) stays as-is — it's the anchor-from-a-real-message-id part that makes it trustworthy; only the loose duplicate check in `walkBubbleAncestors` changes.

1b. **Content denylist, independent of containment**: extend the existing `sysTexts` check in `forwardResolvedMessage()` (`src/extension/page_content.js` ~L508) with the specific junk strings already observed in production ("tài sản doanh nghiệp", "tài khoản của bạn", "trang quản lý tài sản doanh nghiệp"). This is a second, independent layer per the research-spike finding above — it does not depend on the switcher panel being outside the resolved container.

2. **No-container fallback**: in `scanForMessages()` (~L302), if `findMessageListContainer()` returns null for the current thread, skip the text-node TreeWalker forwarding pass entirely for that tick (FR-002) instead of letting `walkBubbleAncestors` fall through against the whole document.

3. **Pending-bubble path**: verify `processPotentialMessage()`'s no-`fb_message_id` branch (~L555) still routes through the same tightened `walkBubbleAncestors` result before scheduling/forwarding, so a `dir="auto"` element outside the real container can never accumulate pending ticks and later slip through (FR-003).

4. **Cleanup utility** (done, corrected from original plan): `messages` has no `source` column — `scripts/cleanupJunkPageUiMessages.js` scopes via `JOIN threads ... JOIN inbox_sources WHERE source_type = 'page_messenger' AND fb_message_id IS NULL` instead, then matches content against known switcher-panel strings ("tài sản doanh nghiệp", "Tài khoản của bạn", "Trang quản lý tài sản doanh nghiệp"), scoped per affected thread via `--thread`.

5. **Validation**: manually reproduce the original bug (open the switcher over an open Page thread) before and after the fix to confirm zero new rows; re-run the feature-010 side-by-side comparison on 2-3 threads to confirm no regression to genuine capture; run the cleanup utility in dry-run mode against the current DB and review the report before applying; then `graphify update .`.

## Safety Gates

- No change to `content.js` (personal-messenger capture) behavior.
- No change to identity/timestamp/direction logic already correct for genuine `[data-message-id]` bubbles (feature 010) — this fix only narrows *whether* a fragment is eligible to be forwarded at all.
- The cleanup utility must default to dry-run and require an explicit flag to delete, and must never match on content alone without also requiring `source = 'page_dom_observer'` AND `fb_message_id IS NULL`, so a genuine media/no-id message with coincidentally similar text is never deleted.
- No regression to feature 010's `Success Criteria` (duplicate-free capture, correct order, correct direction) for real messages.
