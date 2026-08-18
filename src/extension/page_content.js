// ── Page Content Script for Business Suite Inbox ──────────────────────────────
// Injected into https://business.facebook.com/* via manifest.json

// Prevent running in normal www.facebook.com personal chats
// We only want to run in business.facebook.com OR in an iframe embedded within it.
const isBusiness = window.location.hostname.includes('business.facebook.com')
    || window.location.href.includes('asset_id=')
    || window.location.href.includes('/biz/')
    || (window.top !== window.self && window.location.hostname.includes('facebook.com'));

if (isBusiness) {
    console.log(`[PageContent] Business Suite Inbox DOM observer started in ${window.top === window.self ? 'TOP FRAME' : 'IFRAME'}: ${window.location.href}`);

    class BoundedSet {
        constructor(maxSize) {
            this.maxSize = maxSize;
            this.set = new Set();
            this.queue = [];
        }
        has(val) { return this.set.has(val); }
        add(val) {
            if (!this.set.has(val)) {
                if (this.queue.length >= this.maxSize) {
                    const oldest = this.queue.shift();
                    this.set.delete(oldest);
                }
                this.set.add(val);
                this.queue.push(val);
            }
        }
    }
    let processedHashes = new BoundedSet(1000);

    // Feature 017: a message bubble can be scanned before Facebook attaches its
    // real data-message-id (a genuine render-timing race for just-arrived
    // messages). Forwarding it immediately with fb_message_id=null makes the
    // backend fall back to a content+timestamp fingerprint as its identity;
    // once the real id attaches a tick later, that's a *different* identity,
    // so the same logical message lands as two DB rows. Deferring a bounded
    // number of ticks before forwarding an ID-less bubble gives the real id a
    // chance to attach first, without ever dropping a message that genuinely
    // never gets one (see MAX_PENDING_TICKS fallback below).
    let currentTick = 0;
    let pendingNoIdBubbles = new WeakMap(); // bubbleEl -> { firstSeenTick }
    const MAX_PENDING_TICKS = 2;

    // A hash whose direction never resolves (e.g. a non-message UI element
    // like a Business Suite date separator, which sits outside any real
    // message bubble and so never gets directional geometry) is never added
    // to processedHashes below (gated on isOutgoing !== null) - so it would
    // re-fire as "new" on every 1s scan tick, forever, if it isn't otherwise
    // filtered. Bound how many ticks an unresolved-direction hash is allowed
    // to keep re-forwarding before it's remembered anyway. Real messages
    // resolve their direction (or acquire a real fb_message_id, which keys
    // off a separate stable hash - see dedupKey below) well within this
    // window; anything still unresolved past it is presumed not to be a
    // real message at all.
    let unresolvedHashFirstSeenTick = new Map(); // hash -> firstSeenTick
    const MAX_UNRESOLVED_DIRECTION_TICKS = 5;

    // Verified via live DevTools inspection: Business Suite never exposes a real
    // per-message clock time (no data-timestamp/title/hover label). What DOM order
    // does reliably give us is the true chronological order of whatever is
    // currently mounted (top = oldest, bottom = newest) - that never depends on
    // Facebook's build-specific class names. We turn that ordering into a
    // monotonic synthetic timestamp per fb_message_id, anchored against ids we've
    // already assigned, so relative order stays correct even across virtualization
    // remounts and scroll-back reveals of older history.
    const ORDER_GAP_MS = 1000;
    const MAX_KNOWN_TIMESTAMPS = 3000;
    let knownMessageTimestamps = new Map(); // fbMessageId -> assigned timestamp_ms

    // Fallback only for the rare message with no data-message-id at all (see
    // isLikelyBacklog below): messages first seen within this long of opening a
    // thread are backlog, not new arrivals, so they must not be stamped with "now".
    const THREAD_BACKLOG_WINDOW_MS = 4000;
    let lastKnownThreadId = null;
    let lastThreadSwitchAt = Date.now();
    let currentContactName = null;
    let currentAvatarUrl = null;


    // Use polling to be completely immune to React DOM shuffling
    setInterval(scanForMessages, 1000);

    // Slower, separate cadence: nudge the message list to scroll toward older
    // history so virtualization mounts messages that scanForMessages can then see.
    const SCROLL_INTERVAL_MS = 4000;
    const MAX_SCROLL_ATTEMPTS_PER_THREAD = 15;
    let lastScrollThreadId = null;
    let scrollAttemptsForThread = 0;
    setInterval(scrollBackForHistory, SCROLL_INTERVAL_MS);

    let isScanning = false;

    function resolveCurrentThreadId() {
        const urlParams = new URLSearchParams(window.location.search);
        let threadId = urlParams.get('selected_item_id');

        if (!threadId) {
            const selectors = [
                '[role="navigation"] [aria-selected="true"] a',
                '[role="gridcell"] a[href*="selected_item_id="]',
                'div[role="navigation"] a[aria-current="page"]',
                'a[href*="selected_item_id="]',
                'a[href*="/messages/t/"]'
            ];

            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                    if (el.href) {
                        const match = el.href.match(/selected_item_id=(\d+)/) || el.href.match(/\/messages\/t\/(\d+)/);
                        if (match) {
                            threadId = match[1];
                            break;
                        }
                    }
                }
                if (threadId) break;
            }
        }

        return threadId || 'UNKNOWN_THREAD';
    }

    function isLikelyBacklog(threadId) {
        if (threadId !== lastKnownThreadId) {
            lastKnownThreadId = threadId;
            lastThreadSwitchAt = Date.now();
            currentContactName = null;
            currentAvatarUrl = null;
            return true; // just switched/opened this thread; whatever is already mounted is backlog
        }
        return (Date.now() - lastThreadSwitchAt) < THREAD_BACKLOG_WINDOW_MS;
    }

    // Re-seeds knownMessageTimestamps from the backend's persisted record for
    // this thread when we start observing it. Without this, a content-script
    // restart (tab reload, browser restart, service worker restart) wipes
    // knownMessageTimestamps, and any message that's genuinely new to the
    // backend but discovered with zero surviving anchors falls back to "now" -
    // stamping a message from days ago as if it arrived today. Fire-and-forget:
    // never awaited, never blocks the 1s scan cadence, degrades to today's
    // existing in-memory-only behavior if the backend is unreachable.
    function seedTimestampAnchorsForThread(threadId) {
        if (!threadId || threadId === 'UNKNOWN_THREAD') return;
        chrome.runtime.sendMessage({ type: 'GET_THREAD_TIMESTAMPS', data: { threadId } }, (response) => {
            if (chrome.runtime.lastError) return; // background unreachable - degrade silently
            const timestamps = response && response.timestamps;
            if (!Array.isArray(timestamps)) return;
            for (const entry of timestamps) {
                const id = entry && entry.fb_message_id;
                const ts = entry && entry.timestamp_ms;
                // Never overwrite an anchor this session already set more precisely.
                if (id && typeof ts === 'number' && !knownMessageTimestamps.has(id)) {
                    knownMessageTimestamps.set(id, ts);
                }
            }
        });
    }

    function findScrollableMessageContainer() {
        const anyMessage = document.querySelector('[data-message-id]');
        if (!anyMessage) return null;
        let curr = anyMessage.parentElement;
        let overflowCapableFallback = null;
        while (curr && curr !== document.body) {
            const style = window.getComputedStyle(curr);
            const isOverflowCapable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay';
            if (isOverflowCapable) {
                if (curr.scrollHeight > curr.clientHeight + 20) {
                    return curr; // genuinely scrollable right now - best case, also needed for scroll-back
                }
                // Short conversation that fits without scrolling yet: remember the first
                // overflow-capable ancestor as the real chat pane even though it isn't
                // overflowing today, so direction detection still has correct bounds.
                if (!overflowCapableFallback) overflowCapableFallback = curr;
            }
            curr = curr.parentElement;
        }
        return overflowCapableFallback;
    }

    // Same role="region"/main/grid detection strategy already used by the
    // inChatContainer walk in processPotentialMessage, but returning the actual
    // container element instead of a boolean, so other lookups (contact name /
    // avatar) can be scoped to it instead of querying the whole document - the
    // Business Suite sidebar conversation list has its own avatar thumbnails
    // that must never leak into the currently-open thread's contact info.
    function findMessageListContainer() {
        const anchor = document.querySelector('[data-message-id]');
        if (!anchor) return null;
        let curr = anchor.parentElement;
        while (curr && curr !== document.body) {
            if (curr.getAttribute) {
                const label = (curr.getAttribute('aria-label') || '').toLowerCase();
                const role = curr.getAttribute('role');
                if (role === 'region' && (label.includes('tin nhắn') || label.includes('message') || label.includes('msg'))) {
                    return curr;
                }
                if (role === 'main' || role === 'grid') {
                    return curr;
                }
            }
            curr = curr.parentElement;
        }
        return null;
    }

    // Direction is measured relative to the actual message-list container.
    // A missing/ambiguous layout is deliberately returned as unknown; callers
    // persist it as pending instead of silently treating it as incoming.
    function getDirectionEvidence(messageEl, messageListContainer) {
        const classifier = globalThis.FbCrmPageDirection
            && globalThis.FbCrmPageDirection.classifyByContainerEdges;
        if (!classifier || !messageEl || !messageListContainer) {
            return { direction: null, source: 'unknown', confidence: 'unknown' };
        }
        try {
            return classifier({
                containerRect: messageListContainer.getBoundingClientRect(),
                bubbleRect: messageEl.getBoundingClientRect(),
                tolerancePx: 12
            });
        } catch (error) {
            console.warn('[PageContent] Direction geometry unavailable:', error.message);
            return { direction: null, source: 'unknown', confidence: 'unknown' };
        }
    }

    // Assigns every currently-mounted message a monotonic synthetic timestamp
    // consistent with its DOM position, using previously-assigned values as fixed
    // anchors so already-sent messages never change order. New ids slot in via
    // interpolation between their nearest known neighbors (or extrapolate past the
    // oldest/newest known anchor for scroll-back history / brand new arrivals).
    function assignOrderedTimestamps(orderedIds) {
        let lastKnownIdx = -1;
        let lastKnownTs = null;

        for (let i = 0; i < orderedIds.length; i++) {
            const id = orderedIds[i];
            if (!id) continue;
            if (knownMessageTimestamps.has(id)) {
                lastKnownIdx = i;
                lastKnownTs = knownMessageTimestamps.get(id);
                continue;
            }

            let nextKnownIdx = -1;
            let nextKnownTs = null;
            for (let j = i + 1; j < orderedIds.length; j++) {
                if (orderedIds[j] && knownMessageTimestamps.has(orderedIds[j])) {
                    nextKnownIdx = j;
                    nextKnownTs = knownMessageTimestamps.get(orderedIds[j]);
                    break;
                }
            }

            let assigned;
            if (lastKnownTs !== null && nextKnownTs !== null && nextKnownTs > lastKnownTs) {
                const span = nextKnownIdx - lastKnownIdx;
                const pos = i - lastKnownIdx;
                assigned = Math.round(lastKnownTs + (nextKnownTs - lastKnownTs) * (pos / span));
                if (assigned <= lastKnownTs) assigned = lastKnownTs + 1;
                if (assigned >= nextKnownTs) assigned = nextKnownTs - 1;
            } else if (lastKnownTs !== null) {
                assigned = lastKnownTs + ORDER_GAP_MS * (i - lastKnownIdx);
            } else if (nextKnownTs !== null) {
                assigned = nextKnownTs - ORDER_GAP_MS * (nextKnownIdx - i);
            } else {
                // No anchors anywhere in the currently-mounted list yet (fresh session).
                assigned = Date.now() - ORDER_GAP_MS * (orderedIds.length - i);
            }

            knownMessageTimestamps.set(id, assigned);
            // This new id becomes an anchor for the rest of this pass, so a long
            // run of consecutive unknowns still spaces out monotonically.
            lastKnownIdx = i;
            lastKnownTs = assigned;
        }

        if (knownMessageTimestamps.size > MAX_KNOWN_TIMESTAMPS) knownMessageTimestamps.clear();
    }

    function scrollBackForHistory() {
        const threadId = resolveCurrentThreadId();
        if (threadId !== lastScrollThreadId) {
            lastScrollThreadId = threadId;
            scrollAttemptsForThread = 0;
        }
        if (scrollAttemptsForThread >= MAX_SCROLL_ATTEMPTS_PER_THREAD) return;

        const container = findScrollableMessageContainer();
        if (!container) return;

        if (container.scrollTop > 0) {
            container.scrollTop = Math.max(0, container.scrollTop - container.clientHeight);
            scrollAttemptsForThread++;
            console.log(`[PageContent] Scroll-back for history: attempt ${scrollAttemptsForThread}/${MAX_SCROLL_ATTEMPTS_PER_THREAD}, thread=${threadId}`);
        } else {
            // Reached the top of whatever is currently mounted: either genuinely at
            // the start of history, or Business Suite needs a "load more" click we
            // don't perform yet. Stop trying for this thread either way.
            scrollAttemptsForThread = MAX_SCROLL_ATTEMPTS_PER_THREAD;
        }
    }

    function scanForMessages() {
        if (isScanning) return;
        isScanning = true;
        currentTick++;
        try {
            // Early thread resolution to reset cache if needed, and try to find contact info
            const currentThreadId = resolveCurrentThreadId();
            const threadJustChanged = currentThreadId !== lastKnownThreadId;
            isLikelyBacklog(currentThreadId); // this updates lastKnownThreadId and resets cache if thread changed
            if (threadJustChanged) seedTimestampAnchorsForThread(currentThreadId);

            // Resolved once per tick and threaded through to both passes below
            // (and into processPotentialMessage/walkBubbleAncestors), so every
            // containment check this tick uses the exact same container node.
            const messageListContainer = findMessageListContainer();

            if (!currentContactName || !currentAvatarUrl) {
                const avatarImg = messageListContainer
                    ? messageListContainer.querySelector('.x1q0g3np img[height="32"]')
                    : null;
                if (avatarImg) {
                    const alt = avatarImg.getAttribute('alt');
                    if (alt && !alt.toLowerCase().includes('đã xem')) {
                        currentContactName = alt;
                    }
                    currentAvatarUrl = avatarImg.getAttribute('src');
                }
            }

            const messageEls = Array.from(document.querySelectorAll('[data-message-id]'));

            const orderedIds = messageEls.map(n => n.getAttribute('data-message-id'));
            assignOrderedTimestamps(orderedIds);

            // Only the first text-node fragment of a given message wrapper is
            // processed per tick; the rest of that wrapper's fragments (e.g. emoji
            // splitting a bubble into multiple text nodes) are folded into the full
            // wrapper text instead of being sent/dropped as separate fragments.
            const processedWrappersThisTick = new Set();

            // Feature 023 (FR-002): without a resolved message-list container
            // there is no safe scope to test containment against - skip the
            // whole-document text scan for this tick entirely instead of
            // falling back to unscoped scanning (which is how non-chat UI text
            // used to leak in as fake messages).
            if (messageListContainer) {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    const text = node.nodeValue.trim();
                    if (text.length > 0) {
                        const el = node.parentElement;
                        if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'A' && el.tagName !== 'BUTTON' && !el.closest('a') && !el.closest('button')) {
                            processPotentialMessage(el, text, processedWrappersThisTick, messageListContainer);
                        }
                    }
                }
            }

            // Feature 018: a bubble whose entire content is non-text (a
            // picker emoji, a sticker, or a photo) has zero text nodes inside
            // it, so the TreeWalker above never visits it and
            // processPotentialMessage is never called for it. This second
            // pass catches exactly those wrappers - anything already handled
            // above via a real text node is skipped via the shared
            // processedWrappersThisTick set.
            for (const wrapperEl of messageEls) {
                if (processedWrappersThisTick.has(wrapperEl)) continue;
                processedWrappersThisTick.add(wrapperEl);
                const resolvedContent = resolveMessageContent(wrapperEl);
                if (resolvedContent.kind === 'none') continue;
                const fbMessageId = wrapperEl.getAttribute('data-message-id');
                const { isInsideMessageBubble, inChatContainer } = walkBubbleAncestors(wrapperEl, messageListContainer);
                forwardResolvedMessage(wrapperEl, wrapperEl, fbMessageId, isInsideMessageBubble, inChatContainer, resolvedContent, messageListContainer);
            }
        } finally {
            isScanning = false;
        }
    }

    // Single ancestor walk used by processPotentialMessage for two purposes at
    // once: (a) the pending-id tracking below needs a stable-ish reference to
    // "the bubble" for a message that has no data-message-id yet, using the
    // same dir="auto" ancestor the structural filter already looks for; (b)
    // the existing inChatContainer/isInsideMessageBubble structural filter.
    // Computing both in one pass avoids walking the same ancestor chain twice.
    //
    // Feature 023: inChatContainer used to be decided by this same upward walk
    // independently accepting the first role="main"/role="grid" ancestor it
    // found - but Business Suite reuses those roles for unrelated widgets
    // (confirmed live: the account/page switcher panel can share the exact
    // same broad region as the real message list, whose own aria-label admits
    // it holds "tin nhắn, gợi ý và chỉ báo đăng nhập" - not messages only).
    // inChatContainer is now a direct containment test against the specific
    // container findMessageListContainer() resolved from a real
    // [data-message-id] anchor, passed in by the caller, instead of a second
    // independent guess.
    function walkBubbleAncestors(element, messageListContainer) {
        let bubbleAncestor = null;
        let isInsideMessageBubble = false;
        let currNode = element;

        while (currNode && currNode !== document.body) {
            if (currNode.getAttribute && currNode.getAttribute('dir') === 'auto') {
                isInsideMessageBubble = true;
                if (!bubbleAncestor) bubbleAncestor = currNode;
            }
            currNode = currNode.parentElement;
        }

        const inChatContainer = !!(messageListContainer && messageListContainer.contains(element));

        return { bubbleAncestor, isInsideMessageBubble, inChatContainer };
    }

    // Feature 018: resolves what a [data-message-id] wrapper actually
    // contains when it has no (or no useful) text node for the TreeWalker to
    // find - a picker emoji, a sticker, or a photo. Priority: real text >
    // picker-emoji alt > media (img src or CSS background-image). Verified
    // live against three real samples in the same test thread:
    //   - emoji:  <img alt="💩" src=".../emoji.php/v9/.../1f4a9.png">
    //   - photo/img-sticker (DOM-identical, can't be told apart): <img alt
    //     class="img" src="https://scontent...fbcdn.net/v/t1.15752-9/...">
    //   - CSS-background sticker (no <img> at all): <div role="img"
    //     aria-label="Joyful Plans, characters leaning in and rubbing hands
    //     together gleefully sticker" style="background-image:url('https://
    //     scontent...fbcdn.net/v/t39.1997-6/....webp?...')">
    // The emoji/media split on <img> is by alt shape, not by hostname: an
    // empty alt means "no text to show" (media); a short, letter-free alt is
    // a real Unicode character (emoji), as opposed to the multi-word English
    // caption sentences Facebook auto-generates for aria-label on the
    // CSS-background case, which are never mistaken for emoji text since
    // aria-label is only read on the role="img" div path below.
    function resolveMessageContent(messageIdNode) {
        const fullText = (messageIdNode.innerText || messageIdNode.textContent || '').trim();

        // Spec 040 T020: a message can combine real caption text with an
        // attached image in the SAME [data-message-id] wrapper - confirmed
        // live 2026-08-17/18 for a file-transport image manifest sent with a
        // caption. The old code returned on fullText alone and never even
        // checked for an <img>, so this shape was always reported as
        // kind:'text' with the image silently dropped - the resulting
        // campaign dispatch could never be recognized as media (safe per the
        // false-positive fix elsewhere, but never confirmed 'sent' either,
        // and since QUEUE_CONFIRMATION_TIMEOUT is retryable this meant an
        // already-successful file send would get resent for real). Checking
        // for a real (empty-alt) media image BEFORE the fullText early-return
        // - using fullText as the media's caption when both are present -
        // fixes this while leaving every other shape (pure text, pure
        // emoji/sticker, pure photo) unchanged: forwardResolvedMessage
        // already reads resolvedContent.caption for kind:'media'.
        const imgs = messageIdNode.querySelectorAll('img[src]');
        for (const img of imgs) {
            const alt = (img.getAttribute('alt') || '').trim();
            if (!alt) {
                return { kind: 'media', mediaUrl: img.getAttribute('src'), caption: fullText || null };
            }
        }

        // Moved before the fullText early-return for the same reason as the
        // <img> check above - a file-transport image could plausibly render
        // as a CSS background-image div (this app's own sticker-detection
        // pattern) instead of a real <img> tag when captioned.
        const bgEls = messageIdNode.querySelectorAll('[role="img"]');
        for (const bgEl of bgEls) {
            const style = bgEl.getAttribute('style') || '';
            const match = style.match(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/);
            if (match) {
                return { kind: 'media', mediaUrl: match[2], caption: fullText || bgEl.getAttribute('aria-label') || null };
            }
        }

        // Temporary diagnostic (spec 040 T020, 2026-08-18): a real
        // file-transport image + caption send still isn't being recognized
        // as media even after checking both <img> and CSS-background - ran
        // once live and found imgCount=0 too, so whatever markup Facebook
        // actually uses for this case is still unknown. Dump the wrapper's
        // own outerHTML (truncated) so the real shape can be seen directly
        // instead of guessing a third time. Scoped to this test's own
        // messages (marker text) to avoid dumping real customer content.
        if (fullText && /spec 0[34]0/i.test(fullText) && chrome?.runtime?.id) {
            try {
                // Run 3 (2026-08-18) climbed 3 ancestor levels and found only
                // an unrelated read-receipt avatar <img> (real alt text, a
                // "seen at HH:MM" description) - not the 2 uploaded photos.
                // Search the WHOLE document instead for real content images
                // using this file's own established convention (an empty
                // alt="" marks a real sent/received photo, as opposed to an
                // avatar/emoji which always has descriptive alt text - see
                // the isPhotoMessage comment elsewhere in this file), and
                // report each one's closest [data-message-id] ancestor (or
                // lack of one) to find out where they actually live.
                const emptyAltImgs = document.querySelectorAll('img[src][alt=""]');
                const emptyAltInfo = [...emptyAltImgs].slice(0, 10).map((img) => {
                    const closestId = img.closest('[data-message-id]');
                    return {
                        srcPrefix: (img.getAttribute('src') || '').substring(0, 40),
                        dataMessageId: closestId ? closestId.getAttribute('data-message-id') : null
                    };
                });
                chrome.runtime.sendMessage({
                    type: 'CONTENT_DEBUG',
                    data: {
                        reason: 'test_message_wrapper_dump_v3',
                        fullTextSnippet: fullText.substring(0, 60),
                        thisWrapperId: messageIdNode.getAttribute('data-message-id'),
                        imgCount: imgs.length,
                        bgElCount: bgEls.length,
                        emptyAltImgCountWholeDoc: emptyAltImgs.length,
                        emptyAltImgs: emptyAltInfo
                    }
                });
            } catch (e) { /* best-effort diagnostic only */ }
        }

        if (fullText) {
            return { kind: 'text', text: fullText };
        }

        for (const img of imgs) {
            const alt = (img.getAttribute('alt') || '').trim();
            if (alt && alt.length <= 8 && !/[A-Za-z]/.test(alt)) {
                return { kind: 'emoji_text', text: alt };
            }
        }

        return { kind: 'none' };
    }

    // Shared identity/dedup/forward tail for both entry points: the
    // text-node TreeWalker pass (via processPotentialMessage) and the
    // per-wrapper media pass (in scanForMessages, for wrappers with no text
    // node at all). isInsideMessageBubble/inChatContainer are passed in
    // rather than recomputed here so each entry point only walks the
    // ancestor chain once (see walkBubbleAncestors).
    function forwardResolvedMessage(messageIdNode, anchorElement, fbMessageId, isInsideMessageBubble, inChatContainer, resolvedContent, messageListContainer) {
        if (resolvedContent.kind === 'none') return;

        const directionEvidence = getDirectionEvidence(messageIdNode || anchorElement, messageListContainer);
        const isOutgoing = directionEvidence.direction === true || directionEvidence.direction === false
            ? directionEvidence.direction
            : null;
        const threadId = resolveCurrentThreadId();
        const urlParams = new URLSearchParams(window.location.search);
        const assetId = urlParams.get('asset_id'); // Page ID

        // Timestamp: DOM-order-derived for identified messages (see
        // assignOrderedTimestamps); backlog-aware capture-time fallback otherwise.
        let parsedTs;
        let tsSource;
        if (fbMessageId && knownMessageTimestamps.has(fbMessageId)) {
            parsedTs = knownMessageTimestamps.get(fbMessageId);
            tsSource = 'dom_order';
        } else if (isLikelyBacklog(threadId)) {
            parsedTs = 0;
            tsSource = 'unknown';
        } else {
            parsedTs = Date.now();
            tsSource = 'realtime_fallback';
        }

        const isMedia = resolvedContent.kind === 'media';
        const text = isMedia ? (resolvedContent.caption || '') : resolvedContent.text;

        // Keep identity stable across pending -> confirmed direction updates.
        const dedupKey = fbMessageId || text + '_' + (isOutgoing === null ? 'unknown' : isOutgoing);
        const hash = threadId + '_' + dedupKey;
        if (processedHashes.has(hash)) return;

        // ==========================================
        // ROBUST DOM STRUCTURAL FILTERING (V2)
        // ==========================================
        // Strict enforcement: MUST be inside the chat container
        if (!inChatContainer) {
            return;
        }

        // Also ignore simple UI elements inside the chat container (like date
        // headers, "Seen" receipts). Actual text messages are usually wrapped
        // in dir="auto" - but a media wrapper's dir="auto" node may be a
        // descendant we can't see from an upward-only ancestor walk starting
        // at the wrapper, so this text-shaped heuristic is skipped for media
        // (its identity/container check above already gates it).
        if (!isMedia) {
            const lowerText = text.toLowerCase();
            if (!isInsideMessageBubble) {
                const sysTexts = ['xem thêm', 'đang tải...', 'bắt đầu', 'tin nhắn', 'chưa đọc'];
                if (sysTexts.some(t => lowerText.includes(t))) return;
            }

            // Feature 023: known Business Suite account/page-switcher panel
            // strings, observed leaking in as fake messages. Checked
            // regardless of isInsideMessageBubble (unlike sysTexts above) -
            // live inspection confirmed the switcher panel's text is itself
            // wrapped in dir="auto", the same signal real message bubbles
            // use, so gating this on !isInsideMessageBubble would never catch
            // it. Independent of the inChatContainer containment check above:
            // the real message-list container's own aria-label admits it can
            // hold non-message content too, so containment alone is not
            // guaranteed to exclude this panel.
            const switcherPanelTexts = ['tài sản doanh nghiệp', 'tài khoản của bạn', 'trang quản lý tài sản doanh nghiệp'];
            if (switcherPanelTexts.some(t => lowerText.includes(t))) return;
        }

        // Unknown direction remains eligible for later scans. Once geometry is
        // high-confidence, the stable fb_message_id is marked processed.
        if (isOutgoing !== null) {
            processedHashes.add(hash);
            unresolvedHashFirstSeenTick.delete(hash);
        } else {
            const firstSeen = unresolvedHashFirstSeenTick.get(hash);
            if (firstSeen === undefined) {
                unresolvedHashFirstSeenTick.set(hash, currentTick);
            } else if (currentTick - firstSeen >= MAX_UNRESOLVED_DIRECTION_TICKS) {
                // Direction never resolved within the window - stop re-forwarding.
                processedHashes.add(hash);
                unresolvedHashFirstSeenTick.delete(hash);
            }
        }

        console.log('[PageContent] Detected new message in thread ' + threadId + ': ' + (text || '').substring(0, 30) + ' (Outgoing: ' + (isOutgoing === null ? 'unknown' : isOutgoing) + ', ts=' + tsSource + ', kind=' + resolvedContent.kind + ')');

        const payloadData = {
            thread_id: threadId,
            fb_message_id: fbMessageId,
            content: text,
            // null is a transport-level unknown. The backend stores 0 only as
            // a compatibility placeholder and uses direction_status as truth.
            is_outgoing: isOutgoing,
            direction_status: isOutgoing === null ? 'pending' : 'confirmed',
            direction_source: directionEvidence.source,
            direction_confidence: directionEvidence.confidence,
            page_id: assetId,
            source: 'page_dom_observer',
            timestamp_ms: parsedTs,
            timestamp_source: tsSource
        };
        if (isMedia) {
            payloadData.media_type = 'image';
            payloadData.media_url = resolvedContent.mediaUrl;
        }
        if (currentContactName) payloadData.contact_name = currentContactName;
        if (currentAvatarUrl) payloadData.avatar_url = currentAvatarUrl;

        chrome.runtime.sendMessage({
            type: 'NEW_PAGE_MESSAGE_FROM_DOM',
            data: payloadData
        });
    }

    function processPotentialMessage(element, text, processedWrappersThisTick, messageListContainer) {
        // 1. Identity
        let messageIdNode = element.closest('[data-message-id]');
        let fbMessageId = messageIdNode ? messageIdNode.getAttribute('data-message-id') : null;

        if (messageIdNode) {
            if (processedWrappersThisTick.has(messageIdNode)) return; // already handled this wrapper this tick
            processedWrappersThisTick.add(messageIdNode);
        }

        const { bubbleAncestor, isInsideMessageBubble, inChatContainer } = walkBubbleAncestors(element, messageListContainer);

        // Pending-id handling (feature 017): a bubble with no data-message-id
        // yet might just be caught mid-render - give it up to MAX_PENDING_TICKS
        // scan ticks to get its real id attached before forwarding, so it
        // never lands on the backend twice under two different identities.
        if (!fbMessageId) {
            if (bubbleAncestor) {
                const pending = pendingNoIdBubbles.get(bubbleAncestor);
                if (!pending) {
                    pendingNoIdBubbles.set(bubbleAncestor, { firstSeenTick: currentTick });
                    return; // first sighting without an id - wait for it to attach
                }
                if (currentTick - pending.firstSeenTick < MAX_PENDING_TICKS) {
                    return; // still within the wait window
                }
                pendingNoIdBubbles.delete(bubbleAncestor); // wait expired - fall through, forward with null id as before
            }
            // no bubbleAncestor at all: fall through unchanged (today's behavior)
        } else if (bubbleAncestor && pendingNoIdBubbles.has(bubbleAncestor)) {
            pendingNoIdBubbles.delete(bubbleAncestor); // resolved - the real id showed up
        }

        // 2. Content: the full wrapper's text/emoji/media (feature 018), or
        // the raw text node value when there's no wrapper at all (rare).
        const resolvedContent = messageIdNode ? resolveMessageContent(messageIdNode) : { kind: 'text', text };

        forwardResolvedMessage(messageIdNode, element, fbMessageId, isInsideMessageBubble, inChatContainer, resolvedContent, messageListContainer);
    }
} // End isBusiness block
