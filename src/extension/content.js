// AutoChatbot FB Engine - Content Script (Unified with Avatar Extraction)
(function () {
  let capturedFbDtsg = null;
  let capturedUserId = document.cookie.match(/c_user=(\d+)/)?.[1] || null;

  // Bắt crm_pending_key từ URL nếu có và lưu vào chrome.storage.local
  const urlParams = new URLSearchParams(window.location.search);
  const pendingKeyFromUrl = urlParams.get('crm_pending_key');
  if (pendingKeyFromUrl) {
    try {
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ crm_pending_key: pendingKeyFromUrl });
      }
    } catch (e) { }
  }

  function triggerCallAnswer(action) {
    console.log('[CALL_CONTROL] 🎯 Dynamically clicking Facebook call button:', action);
    var targetLabel = action === 'accept' ? 'Chấp nhận' : 'Từ chối';
    
    // 1. Direct query by aria-label
    var btn = document.querySelector('[aria-label="' + targetLabel + '"][role="button"]') ||
              document.querySelector('[aria-label="' + targetLabel + '"]');
    
    // 2. Fallback: text search in role="button"
    if (!btn) {
      var allButtons = document.querySelectorAll('[role="button"]');
      for (var i = 0; i < allButtons.length; i++) {
        var txt = (allButtons[i].textContent || '').trim();
        if (txt === targetLabel || (action === 'accept' && txt.includes('Chấp nhận')) || (action === 'decline' && txt.includes('Từ chối'))) {
          btn = allButtons[i];
          break;
        }
      }
    }

    if (btn) {
      btn.click();
      console.log('[CALL_CONTROL] ✅ Successfully clicked ' + targetLabel + ' button on Facebook!');
      return true;
    } else {
      console.warn('[CALL_CONTROL] ⚠️ Button ' + targetLabel + ' not found in Facebook DOM');
      return false;
    }
  }

  try {
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'CLEAR_PENDING_KEY') {
          try {
            if (chrome?.storage?.local) {
              chrome.storage.local.remove(['crm_pending_key']);
            }
          } catch (e) {}
        }
        if (msg.type === 'ANSWER_INCOMING_CALL') {
          var success = triggerCallAnswer(msg.action);
          if (sendResponse) sendResponse({ success: success });
        }
      });
    }
  } catch (e) {}

  function normalizeTimestampMs(ts) {
    if (!ts) return null;
    let numericTs = Number(ts);
    if (isNaN(numericTs)) return null;
    // Nếu timestamp < 10000000000 (10 digits), nó là giây -> nhân 1000 ra mili giây
    if (numericTs > 0 && numericTs < 10000000000) {
      numericTs *= 1000;
    }
    return numericTs;
  }

  // Lắng nghe tin nhắn từ injected.js (MAIN World Interceptor)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FB_NETWORK_MESSAGE') {
      const netMsg = event.data.data;
      if (!netMsg || !netMsg.thread_id || !netMsg.content) return;
      
      capturedUserId = capturedUserId || document.cookie.match(/c_user=(\d+)/)?.[1] || null;
      let sender_id = netMsg.sender_id || (netMsg.is_outgoing ? capturedUserId : null);
      let is_outgoing = netMsg.is_outgoing || false;
      
      if (sender_id && capturedUserId && String(sender_id) === String(capturedUserId)) {
        is_outgoing = true;
      }

      const finalTsMs = normalizeTimestampMs(netMsg.timestamp_ms);

      try {
        if (chrome?.runtime?.id) {
          recentNetworkEmits.set(`${netMsg.thread_id}:${netMsg.content}`, Date.now());
          chrome.runtime.sendMessage({
            type: 'NEW_MESSAGE_FROM_FB',
            data: {
              thread_id: netMsg.thread_id,
              fb_message_id: netMsg.fb_message_id || null,
              sender_id: sender_id,
              sender_name: netMsg.sender_name || (is_outgoing ? 'Bạn' : ''),
              content: netMsg.content,
              is_outgoing: is_outgoing,
              source: 'network_interceptor',
              timestamp_ms: finalTsMs || null,
              timestamp_source: finalTsMs ? 'facebook_payload' : 'realtime_fallback',
              created_at: finalTsMs ? new Date(finalTsMs).toISOString() : (netMsg.created_at || new Date().toISOString())
            }
          });
        }
      } catch (e) {}
    }
  });

  const processedKeys = new Set();
  const recentNetworkEmits = new Map();
  const recentDomEmits = new Map();

  function reportTokens(fb_dtsg, user_id) {
    if (!fb_dtsg || !user_id) return;
    try {
      if (chrome?.runtime?.id) {
        if (chrome?.storage?.local) {
          chrome.storage.local.get(['crm_pending_key'], (res) => {
            const pending_key = res?.crm_pending_key || pendingKeyFromUrl || null;
            chrome.runtime.sendMessage({ type: 'FB_TOKENS_EXTRACTED', data: { fb_dtsg, user_id, pending_key } });
          });
        } else {
          chrome.runtime.sendMessage({ type: 'FB_TOKENS_EXTRACTED', data: { fb_dtsg, user_id, pending_key: pendingKeyFromUrl || null } });
        }
      }
    } catch (e) { }
  }

  function extractFbTokensFromDOM() {
    if (!capturedUserId) {
      capturedUserId = document.cookie.match(/c_user=(\d+)/)?.[1] || null;
    }
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!capturedUserId) {
        const uMatch = text.match(/"USER_ID":"(\d+)"/) || text.match(/"actorID":"(\d+)"/) || text.match(/"ACCOUNT_ID":"(\d+)"/);
        if (uMatch) capturedUserId = uMatch[1];
      }
      if (!capturedFbDtsg) {
        if (text.includes('DTSGInitialData') || text.includes('fb_dtsg') || text.includes('token')) {
          const match = text.match(/"token":"([^"]+)"/) || text.match(/"fb_dtsg":"([^"]+)"/) || text.match(/"async_get_token":"([^"]+)"/);
          if (match) capturedFbDtsg = match[1];
        }
      }
    }
    const inputEl = document.querySelector('input[name="fb_dtsg"]');
    if (inputEl?.value) { capturedFbDtsg = inputEl.value; }

    if (capturedFbDtsg && capturedUserId) {
      reportTokens(capturedFbDtsg, capturedUserId);
    }
  }


  // WebSocket interceptor
  function patchWebSocket() {
    if (window._fb_ws_patched) return; window._fb_ws_patched = true;
    const origWebSocket = window.WebSocket;
    window.WebSocket = function (url, ...args) {
      const ws = new origWebSocket(url, args);
      ws.addEventListener('message', function (e) {
        const data = e.data;
        if (typeof data !== 'string') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.actions) parsed.actions.forEach(action => {
            if ((action.type === 'chat' || action.body) && action.body) {
              const thread_id = action.thread_fbid || action.thread_id;
              const sender_id = action.actor_fbid || action.sender_fbid || action.sender_user_id;
              const content = action.body;
              const timestampMs = normalizeTimestampMs(action.timestamp || Date.now());
              const cacheKey = `${thread_id}:${content}:${timestampMs}`;
              if (processedKeys.has(cacheKey)) return; processedKeys.add(cacheKey);
              if (processedKeys.size > 1000) processedKeys.delete(processedKeys.values().next().value);
              recentNetworkEmits.set(`${thread_id}:${content}`, Date.now());
              if (recentNetworkEmits.size > 500) recentNetworkEmits.delete(recentNetworkEmits.keys().next().value);
              if (chrome?.runtime?.id) {
                try {
                  capturedUserId = capturedUserId || document.cookie.match(/c_user=(\d+)/)?.[1] || null;
                  const is_outgoing = !!(sender_id && capturedUserId && String(sender_id) === String(capturedUserId));
                  const fbMsgId = 'ws_' + thread_id + '_' + timestampMs;
                  chrome.runtime.sendMessage({
                    type: 'NEW_MESSAGE_FROM_FB',
                    data: {
                      thread_id,
                      sender_id,
                      content,
                      is_outgoing,
                      fb_message_id: fbMsgId,
                      media_type: 'text',
                      timestamp_ms: timestampMs || null,
                      timestamp_source: action.timestamp ? 'facebook_payload' : 'realtime_fallback',
                      created_at: new Date(timestampMs).toISOString(),
                      source: 'websocket'
                    }
                  });
                } catch (err) { }
              }
            }
          });
          if (parsed.payload_push?.mutations) parsed.payload_push.mutations.forEach(mut => {
            if (mut.path?.thread_key?.fbid2 || mut.path?.thread_key?.second_fbid) {
              const thread_id = mut.path.thread_key.fbid2 || mut.path.thread_key.second_fbid;
              if (mut.args?.[0]?.body) {
                const content = mut.args[0].body;
                const sender_id = mut.args[0].actor_fbid || mut.args[0].sender_fbid;
                const tsMs = normalizeTimestampMs(mut.args[0].timestamp || Date.now());
                const cacheKey = `${thread_id}:${content}:${tsMs}`;
                if (!processedKeys.has(cacheKey)) {
                  processedKeys.add(cacheKey); 
                  recentNetworkEmits.set(`${thread_id}:${content}`, Date.now());
                  if (recentNetworkEmits.size > 500) recentNetworkEmits.delete(recentNetworkEmits.keys().next().value);
                  try {
                    if (chrome?.runtime?.id) {
                      capturedUserId = capturedUserId || document.cookie.match(/c_user=(\d+)/)?.[1] || null;
                      const is_outgoing = !!(sender_id && capturedUserId && String(sender_id) === String(capturedUserId));
                      console.log(`[Content Interceptor] mercury mutation intercepted message: thread_id=${thread_id} | content="${content.substring(0, 40)}"`);
                      chrome.runtime.sendMessage({
                        type: 'NEW_MESSAGE_FROM_FB',
                        data: {
                          thread_id,
                          sender_id,
                          content,
                          is_outgoing: is_outgoing,
                          fb_message_id: `mercury_${thread_id}_${Date.now()}`,
                          media_type: 'text',
                          timestamp_ms: mut.args[0].timestamp ? tsMs : null,
                          timestamp_source: mut.args[0].timestamp ? 'facebook_payload' : 'realtime_fallback',
                          created_at: new Date(tsMs).toISOString(),
                          source: 'mercury'
                        }
                      });
                    }
                  } catch (err) { }
                }
              }
            }
          });
        } catch (err) { }
      });
      return ws;
    };
  }

  // XHR interceptor
  function patchXHR() {
    if (window._fb_xhr_patched) return; window._fb_xhr_patched = true;
    const origXHROpen = XMLHttpRequest.prototype.open, origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...args) { this._fbUrl = url; return origXHROpen.call(this, method, url, ...args); };
    XMLHttpRequest.prototype.send = function (...args) {
      const urlStr = this._fbUrl?.toString?.() || '';
      if (urlStr.includes('/api/graphql/') || urlStr.includes('graphql')) tryExtractDtsgFromBody(args[0]);
      this.addEventListener('load', function () { try { if (urlStr.includes('/api/graphql/') || urlStr.includes('ajax/mercury/')) tryParseMessages(this.responseText); } catch (e) { } });
      return origXHRSend.call(this, ...args);
    };
  }

  function tryExtractDtsgFromBody(body) {
    if (!body || typeof body !== 'string') return;
    const match = body.match(/fb_dtsg=([^&\s]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded && decoded !== capturedFbDtsg) {
        capturedFbDtsg = decoded; capturedUserId = document.cookie.match(/c_user=(\d+)/)?.[1] || capturedUserId; reportTokens(capturedFbDtsg, capturedUserId);
      }
    }
  }

  // Fetch interceptor
  function patchFetch() {
    if (window._fb_fetch_patched) return; window._fb_fetch_patched = true;
    const origFetch = window.fetch;
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/graphql/') || url.includes('graphql')) {
        const body = init?.body; if (typeof body === 'string') tryExtractDtsgFromBody(body);
      }
      const response = await origFetch.call(this, input, init);
      try { if (url.includes('/api/graphql/') || url.includes('ajax/mercury/')) response.clone().text().then(text => { tryParseMessages(text); }).catch(() => { }); } catch (e) { }; return response;
    };
  }

  // Parse messages from XHR/Fetch response
  function tryParseMessages(text) {
    try {
      const bodyRegex = /"body":"((?:[^"\\]|\\.)*)"/g;
      const threadRegex = /"thread_fbid":"?(\d+)"?|"threadFbId":"?(\d+)"?/;
      const senderRegex = /"actorFbId":"?(\d+)"?|"sender_fbid":"?(\d+)"?/;
      const timestampRegex = /"timestamp":"?(\d+)"?|"timestamp_precise":"?(\d+)"?/;
      const threadMatch = text.match(threadRegex); if (!threadMatch) return;
      const thread_id = threadMatch[1] || threadMatch[2];
      const senderMatch = text.match(senderRegex);
      const sender_id = senderMatch ? (senderMatch[1] || senderMatch[2]) : null;
      const tsMatch = text.match(timestampRegex);
      const timestampMs = tsMatch ? normalizeTimestampMs(tsMatch[1] || tsMatch[2]) : null;
      let match, bodies = [];
      while ((match = bodyRegex.exec(text)) !== null) {
        const msgText = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (msgText && msgText.length > 0 && msgText.length < 5000) bodies.push(msgText);
      }
      if (bodies.length === 0) return;
      const content = bodies[bodies.length - 1];
      const cacheKey = `${thread_id}:${content}:${timestampMs || Date.now()}`;
      if (processedKeys.has(cacheKey)) return;
      processedKeys.add(cacheKey);
      if (processedKeys.size > 500) processedKeys.delete(processedKeys.values().next().value);
      recentNetworkEmits.set(`${thread_id}:${content}`, Date.now());
      if (recentNetworkEmits.size > 500) recentNetworkEmits.delete(recentNetworkEmits.keys().next().value);
      capturedUserId = capturedUserId || document.cookie.match(/c_user=(\d+)/)?.[1] || null;
      const is_outgoing = !!(sender_id && capturedUserId && String(sender_id) === String(capturedUserId));
      try {
        if (chrome?.runtime?.id) {
          console.log(`[Content Interceptor] network_xhr intercepted message: thread_id=${thread_id} | content="${content.substring(0, 40)}"`);
          chrome.runtime.sendMessage({
            type: 'NEW_MESSAGE_FROM_FB',
            data: {
              thread_id,
              sender_id,
              content,
              is_outgoing,
              fb_message_id: `xhr_${thread_id}_${Date.now()}`,
              media_type: 'text',
              timestamp_ms: timestampMs,
              timestamp_source: timestampMs ? 'facebook_payload' : 'realtime_fallback',
              created_at: new Date(timestampMs || Date.now()).toISOString(),
              source: 'network_xhr'
            }
          });
        }
      } catch (e) { }
    } catch (e) { }
  }

  // ── DOM Observer with Avatar Extraction ──────────────────────────────────────
  let lastObservedMessages = new Set();

  function extractThreadIdFromUrl() {
    const match = document.location.href.match(/\/messages\/(?:e2ee\/)?t\/(\d+)/) || 
                  document.location.href.match(/\/messages\/t\/(\d+)/);
    if (match && /^\d+$/.test(match[1])) {
      return match[1];
    }
    return null;
  }

  const EXCLUDED_PATTERNS = [
    /Messenger/i,
    /Cuộc gọi video/i,
    /Cuộc gọi thoại/i,
    /Bạn đã bỏ lỡ cuộc gọi/i,
    /Meta/i,
    /Trang chủ/i,
    /Watch/i,
    /Marketplace/i,
    /Nhóm$/i,
    /Thông báo$/i,
  ];

  // Shared bubble-text cleanup, extracted so both the per-bubble text loop
  // and the image-caption extraction below use the exact same rules.
  function cleanBubbleText(rawText) {
    let cleanText = (rawText || '').trim();
    if (!cleanText) return '';
    const filter = globalThis.FbCrmTextFilter;
    if (filter?.cleanMessageText) {
      cleanText = filter.cleanMessageText(cleanText);
    } else {
      cleanText = cleanText.replace(/^(?:Nhập,\s*)?Tin nhắn do [\s\S]+? gửi lúc [^\n]*?(?:ch:|\b\d{1,2}:\d{2}(?:ch)?:|\b\d{1,2}:\d{2}(?:ch)?\s+)\s*/i, '').trim();
      cleanText = cleanText.replace(/^Nhập,\s*/i, '').trim();
      cleanText = cleanText.replace(/^[:\s]+/, '').trim();
      const sentEmojiMatch = cleanText.match(/^[^,\n]{1,80}\s+(?:đã gửi|sent),\s*(.+)$/i);
      if (sentEmojiMatch) {
        const payload = sentEmojiMatch[1].trim();
        if (payload && !/[A-Za-zÀ-ỹ0-9]/.test(payload)) cleanText = payload;
      }
      cleanText = cleanText.replace(/(?:\n|\r|\s{2,})(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen|Nhấn Enter để gửi)\s*$/i, '').trim();
      cleanText = cleanText.replace(/^\d{1,2}:\d{2}\s*(?:T[2-7]|CN|AM|PM)?\s*$/i, '').replace(/(?:\n|\r)\s*\d{1,2}:\d{2}\s*(?:T[2-7]|CN|AM|PM)?$/i, '').trim();
      cleanText = cleanText.replace(/^[:\s]+/, '').trim();
    }
    return cleanText;
  }

  function parseMessagesFromDOMNode(node, isRealtime = false) {
    if (!node || node.nodeType !== 1) return [];

    // ── Composer/UI exclusion tuyệt đối ──
    const COMPOSER_EXCLUDE = 'form, [contenteditable="true"], [role="textbox"], [aria-label="Aa"], [aria-label="Tin nhắn"], [aria-label*="composer"], [aria-label*="Soạn"], [role="contentinfo"], header, nav';

    // Đảm bảo node nằm trong vùng chat trung tâm main, không nằm trong composer/header/nav
    const inMain = node.closest?.('div[role="main"]');
    const inComposer = node.closest?.(COMPOSER_EXCLUDE);
    if (!inMain || inComposer) return [];

    // ── Xác minh node thuộc hoặc chứa message row thật ──
    // Facebook đã chuyển message container từ role="row" sang role="article"
    // (xác nhận qua live DOM inspection 2026-08-13) - một tin ảnh có caption
    // hiển thị caption và <img> dưới dạng 2 node con riêng biệt của cùng 1
    // article; MutationObserver chỉ báo node vừa thêm (thường là node caption
    // nhỏ), nên phải leo lên article mới thấy được cả <img> anh em của nó.
    const messageRow = node.closest?.('div[role="article"]') || node.closest?.('div[role="row"]') || node;

    // ── STALE DOM GUARD (Self-Tagging Marker) ──
    if (messageRow && messageRow.dataset) {
      const currentUrlThreadId = extractThreadIdFromUrl();
      const existingThreadId = messageRow.dataset.crmThreadId;
      if (existingThreadId && currentUrlThreadId && existingThreadId !== currentUrlThreadId) {
        return []; // Bỏ qua vì đây là DOM của thread cũ!
      }
      if (currentUrlThreadId) {
        messageRow.dataset.crmThreadId = currentUrlThreadId;
      }
    }

    // ── Media detection (ảnh gửi/nhận trên Messenger cá nhân) ──
    // Live DOM inspection (2026-08-13, real sent-photo message) found the
    // photo <img>'s alt is always the fixed UI action label "Mở ảnh" ("Open
    // photo") - not empty, and not a description. An avatar/read-receipt
    // <img> next to a bubble always carries the contact's real name instead
    // (e.g. alt="Thu Oanh Nguyen" or "Thu Oanh Nguyen đã xem lúc..."), so
    // matching on this fixed label (rather than "alt is empty", which does
    // NOT hold here) reliably tells a sent/received photo apart from an
    // avatar without ever matching a real name. The <img> src for a
    // just-sent photo is often an inline `data:image/...;base64,...`
    // thumbnail rather than a real fbcdn/scontent URL - only forward src as
    // media_url when it's a real CDN link (an unusable, multi-KB data: URI
    // has no value to the backend, which never uses this value for
    // confirmation matching - only media_type - and would just waste a
    // failed download attempt in MediaDownloader).
    //
    // Checked BEFORE the aria-label-based hasMessageLabel gate below and
    // used to bypass it entirely when a photo is found: live testing showed
    // an image-only row's accessibility label (the "Tin nhắn do ... gửi
    // lúc" helper text) is not always present yet at the exact moment
    // MutationObserver's callback fires - React appears to hydrate it a
    // beat after inserting the <img> itself - so gating on that label made
    // every real-time photo detection silently miss (return []) while the
    // *separate*, later-arriving caption-only row (which has its own label
    // already attached) went through fine. The <img alt="Mở ảnh"> itself is
    // static markup set at creation time, not hydrated later, so it doesn't
    // have this race and is sufficient proof on its own that this is a real
    // message row, not composer/avatar/unrelated UI.
    const OPEN_PHOTO_ALT_PATTERN = /^(?:Mở ảnh|Xem ảnh|Open photo|View photo)$/i;
    let isPhotoMessage = false;
    let mediaUrl = null;
    const rowImgs = messageRow.querySelectorAll?.('img[src]') || [];
    for (const img of rowImgs) {
      if (img.closest(COMPOSER_EXCLUDE)) continue;
      const src = img.getAttribute('src') || '';
      const alt = (img.getAttribute('alt') || '').trim();
      if (src && OPEN_PHOTO_ALT_PATTERN.test(alt)) {
        isPhotoMessage = true;
        mediaUrl = /^https?:\/\/.*(?:fbcdn\.net|scontent)/i.test(src) ? src : null;
        break;
      }
    }

    const rowAriaLabel = messageRow.getAttribute?.('aria-label') || '';
    const childMsgEl = !rowAriaLabel ? messageRow.querySelector?.('[aria-label*="Tin nhắn do"], [aria-label*="Message sent"]') : null;
    const effectiveLabel = rowAriaLabel || (childMsgEl?.getAttribute?.('aria-label') || '');

    const hasMessageLabel = /Tin nhắn do .+ gửi lúc|Message sent by/i.test(effectiveLabel);
    const nativeIdEl = messageRow.querySelector?.('[data-id], [id^="mid."]');
    const hasNativeId = !!nativeIdEl;

    if (!hasMessageLabel && !hasNativeId && !isPhotoMessage) return []; // Không phải message row

    const rawText = (node.textContent || '').trim();
    if (!isPhotoMessage) {
      if (!rawText) return [];

      for (const pat of EXCLUDED_PATTERNS) {
        if (pat.test(rawText)) return [];
      }
    }

    // ── Tìm tất cả leaf bubbles ──
    const searchRoot = isRealtime ? node : messageRow;
    const allBubbles = searchRoot.querySelectorAll?.('div[dir="auto"], span[dir="auto"]');
    const leafBubbles = [];
    if (allBubbles && allBubbles.length > 0) {
      for (const b of allBubbles) {
        if (b.closest(COMPOSER_EXCLUDE)) continue;
        if (!b.querySelector('div[dir="auto"], span[dir="auto"]')) {
          leafBubbles.push(b);
        }
      }
    }

    if (leafBubbles.length === 0) {
      if (searchRoot.matches?.('div[dir="auto"], span[dir="auto"]') && !searchRoot.querySelector('div[dir="auto"], span[dir="auto"]')) {
        if (!searchRoot.closest(COMPOSER_EXCLUDE)) {
          leafBubbles.push(searchRoot);
        }
      }
    }

    let finalBubbles = leafBubbles;
    if (isRealtime) {
      // Filter visual bubbles to avoid clones, hidden texts, or accessibility wrappers
      finalBubbles = leafBubbles.filter(b => {
        const rects = b.getClientRects();
        if (!rects || rects.length === 0) return false;
        const rect = b.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        // Kiểm tra xem có bị ẩn qua CSS không
        const style = window.getComputedStyle(b);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return true;
      });
    }

    if (finalBubbles.length === 0 && !isPhotoMessage) return [];

    let sender_name = '';
    let is_outgoing = false;

    // Phân tích sender từ accessibility label
    if (/do Bạn gửi|Tin nhắn do Bạn gửi lúc|Bạn đã gửi|sent by you|You sent|Message sent by you/i.test(effectiveLabel)) {
      is_outgoing = true;
      sender_name = 'Bạn';
    } else {
      const nameMatch = effectiveLabel.match(/Tin nhắn do ([^]+?) gửi lúc/i) || effectiveLabel.match(/Message sent by ([^]+?) at/i);
      if (nameMatch) {
        const rawSender = nameMatch[1].trim();
        if (/^(?:Bạn|You)$/i.test(rawSender)) {
          is_outgoing = true;
          sender_name = 'Bạn';
        } else {
          is_outgoing = false;
          sender_name = rawSender;
        }
      } else {
        is_outgoing = false;
        sender_name = '';
      }
    }

    const filter = globalThis.FbCrmTextFilter;

    // ── Ảnh: trả về đúng 1 kết quả duy nhất cho cả row ──
    // Live DOM inspection found Facebook renders a sent photo+caption pair
    // as two SEPARATE message articles (an image-only one with no text
    // bubble, immediately followed by a text-only one for the caption) -
    // not one combined bubble. This branch only ever fires for the
    // image-only article (finalBubbles is empty there), so caption always
    // comes back '' here; the caption's own article runs through the normal
    // per-bubble loop below as its own independent text event, unaffected.
    if (isPhotoMessage) {
      let caption = '';
      for (const bubble of finalBubbles) {
        const cleaned = cleanBubbleText(bubble.textContent);
        if (!cleaned || cleaned.length > 1000) continue;
        if (filter?.isSystemOrMetadataText && filter.isSystemOrMetadataText(cleaned)) continue;
        caption = cleaned;
        break;
      }
      return [{
        sender_name: sender_name || (is_outgoing ? 'Bạn' : ''),
        content: caption,
        is_outgoing,
        native_id: nativeIdEl?.getAttribute('data-id') || nativeIdEl?.getAttribute('id') || messageRow.getAttribute?.('data-id') || null,
        effective_label: effectiveLabel,
        is_valid: true,
        bubble_idx: 0,
        media_type: 'image',
        media_url: mediaUrl
      }];
    }

    const results = [];
    let bubble_idx = 0;
    for (const bubble of leafBubbles) {
      const cleanText = cleanBubbleText(bubble.textContent);

      if (!cleanText || cleanText.length < 1 || cleanText.length > 1000) {
        bubble_idx++;
        continue;
      }
      if (filter?.isSystemOrMetadataText && filter.isSystemOrMetadataText(cleanText)) {
        bubble_idx++;
        continue;
      }

      const PRESENCE_EXACT = /^(?:Đang hoạt động.*|Hoạt động(?:\s+\d+.*)?|Đã hoạt động.*|Active now|Active recently|Active \d+.*|Online|Offline|Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen|Typing|Đã gửi\s+\d+\s+(?:giây|phút|giờ|ngày|tuần|tháng|năm)\s+trước[.…]*|Đang nhập[.…]*|Đang gửi[.…]*|Đang tải[.…]*|Loading[.…]*|Sending[.…]*)$/i;
      if (PRESENCE_EXACT.test(cleanText)) {
        bubble_idx++;
        continue;
      }

      results.push({
        sender_name: sender_name || (is_outgoing ? 'Bạn' : ''),
        content: cleanText,
        is_outgoing,
        native_id: nativeIdEl?.getAttribute('data-id') || nativeIdEl?.getAttribute('id') || messageRow.getAttribute?.('data-id') || null,
        effective_label: effectiveLabel,
        is_valid: true,
        bubble_idx
      });
      bubble_idx++;
    }

    return results;
  }

  // Avatar extractor - search up to 8 levels up for profile pic img
  function extractContactAvatarFromNode(node) {
    let current = node, depth = 0;
    while (current && current !== document.body && depth < 8) {
      depth++;
      const allImgs = current.querySelectorAll?.('img');
      if (allImgs) {
        for (const img of allImgs) {
          const src = img.currentSrc || img.src || '';
          if (src && !src.includes('transparent') && !src.includes('blank') && (src.includes('fbcdn.net') || src.includes('scontent') || src.includes('platform.facebook.com')) && src.length > 50) return src;
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  let currentBaselineThreadId = null;
  let observerPaused = false;

  function makeDomMessageId(thread_id, parsed) {
    let textHash = 0;
    const strToHash = `${thread_id}|${parsed.is_outgoing}|${parsed.sender_name}|${parsed.content}|${parsed.effective_label}`;
    for (let i = 0; i < strToHash.length; i++) {
      textHash = Math.imul(31, textHash) + strToHash.charCodeAt(i) | 0;
    }
    const stableId = parsed.native_id || `hash_${Math.abs(textHash)}`;
    return `dom_${thread_id}_${stableId}_${parsed.bubble_idx}`;
  }

  function seedBaseline(thread_id) {
    const existingRows = document.querySelectorAll('div[role="row"], div[data-scope="messages_table"] div[dir="auto"]');
    existingRows.forEach(row => {
      const parsedMessages = parseMessagesFromDOMNode(row);
      parsedMessages.forEach(p => {
        lastObservedMessages.add(makeDomMessageId(thread_id, p));
      });
    });
    while (lastObservedMessages.size > 2000) lastObservedMessages.delete(lastObservedMessages.values().next().value);
  }

  const chatObserver = new MutationObserver((mutations) => {
    const thread_id = extractThreadIdFromUrl();
    if (!thread_id || !/^\d+$/.test(thread_id)) return;

    // Kiểm tra DOM stale (URL update nhưng sidebar chưa update)
    const activeSidebarItem = document.querySelector('a[aria-current="page"][href*="/messages/"], a[aria-current="true"][href*="/messages/"]');
    if (activeSidebarItem) {
      const activeUrl = activeSidebarItem.getAttribute('href') || '';
      const activeMatch = activeUrl.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
      const activeId = activeMatch ? decodeURIComponent(activeMatch[1]) : null;
      if (activeId && String(activeId) !== String(thread_id)) return; // Bỏ qua toàn bộ mutation vì DOM chưa đồng bộ với URL
    }

    // Phát hiện đổi thread NGAY TRONG TICK của MutationObserver, không dùng setInterval để tránh trễ
    if (thread_id !== currentBaselineThreadId) {
      currentBaselineThreadId = thread_id;
      observerPaused = true;
      // Seed lần đầu với các node đang có sẵn
      seedBaseline(thread_id);
      // Tiếp tục seed sau 2.5s để cover nốt lịch sử load chậm
      setTimeout(() => {
        if (currentBaselineThreadId !== thread_id) return; // Tránh leak timeout sang thread khác nếu user chuyển quá nhanh
        seedBaseline(thread_id);
        observerPaused = false;
      }, 2500);
      return; // Bỏ qua toàn bộ mutations trong tick chuyển thread này (do chúng là lịch sử)
    }

    if (observerPaused) return;

    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;

      const inMain = node.closest?.('div[role="main"]');
      const inComposerOrHeader = node.closest?.('form, [role="contentinfo"], [aria-label*="composer"], [aria-label*="Soạn"], header, nav');
      if (!inMain || inComposerOrHeader) return;

      const parsedMessages = parseMessagesFromDOMNode(node, true);
      if (parsedMessages.length === 0) return;

      const contactAvatar = extractContactAvatarFromNode(node);

      parsedMessages.forEach((parsed) => {
        // Ưu tiên network: nếu tin nhắn này đã được bắt bởi network trong 2 giây qua, bỏ qua DOM observer
        const networkTime = recentNetworkEmits.get(`${thread_id}:${parsed.content}`);
        if (networkTime && Date.now() - networkTime < 2000) return;

        // Dedupe DOM ngắn hạn (800ms) để chặn clone node bắn cùng lúc
        const domDedupeKey = `${thread_id}:${parsed.content}:${parsed.is_outgoing}`;
        const lastDomTime = recentDomEmits.get(domDedupeKey);
        if (lastDomTime && Date.now() - lastDomTime < 800) return;
        recentDomEmits.set(domDedupeKey, Date.now());
        if (recentDomEmits.size > 500) recentDomEmits.delete(recentDomEmits.keys().next().value);

        const fbMessageId = makeDomMessageId(thread_id, parsed);

        if (lastObservedMessages.has(fbMessageId)) return;
        lastObservedMessages.add(fbMessageId);
        if (lastObservedMessages.size > 2000) lastObservedMessages.delete(lastObservedMessages.values().next().value);

        let tsMs = null;
        let tsSource = 'realtime_fallback';
        if (parsed.effective_label) {
          // Parse: "Tin nhắn do Bạn gửi lúc 15:20" hoặc "15:20"
          const timeMatch = parsed.effective_label.match(/\b(\d{1,2}):(\d{2})(?:\s*(AM|PM|SA|CH))?/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const ampm = timeMatch[3]?.toUpperCase();
            if (ampm === 'PM' || ampm === 'CH') {
              if (hours < 12) hours += 12;
            } else if (ampm === 'AM' || ampm === 'SA') {
              if (hours === 12) hours = 0;
            }
            
            const now = new Date();
            // Assuming current day. If label has specific day, it gets complex.
            now.setHours(hours, minutes, 0, 0);
            
            // If the parsed time is slightly in the future (e.g. timezone mismatch), subtract 1 day
            if (now.getTime() > Date.now() + 60000) {
              now.setDate(now.getDate() - 1);
            }
            
            tsMs = now.getTime();
            tsSource = 'facebook_label';
          }
        }

        try {
          if (chrome?.runtime?.id) {
            console.log(`[DOM Observer] matched message: thread_id=${thread_id} | id=${fbMessageId} | media_type=${parsed.media_type || 'text'} | content="${parsed.content.substring(0, 40)}" | tsMs=${tsMs}`);
            chrome.runtime.sendMessage({
              type: 'NEW_MESSAGE_FROM_FB',
              data: {
                thread_id: thread_id,
                sender_id: parsed.is_outgoing ? capturedUserId : null,
                sender_name: parsed.sender_name,
                content: parsed.content,
                is_outgoing: parsed.is_outgoing,
                fb_message_id: fbMessageId,
                media_type: parsed.media_type || 'text',
                media_url: parsed.media_url || null,
                timestamp_ms: tsMs,
                timestamp_source: tsSource,
                created_at: new Date(tsMs || Date.now()).toISOString(),
                source: 'dom_observer',
                contact_avatar: contactAvatar || ''
              }
            });
          }
        } catch (err) {}
      });
    }));
  });

  // Initialize everything
  patchXHR(); patchFetch(); patchWebSocket();
  extractFbTokensFromDOM(); setInterval(extractFbTokensFromDOM, 3000);

  // Observer starts paused to avoid replaying old history on page load/reload
  observerPaused = true;
  setTimeout(() => {
    const initialThreadId = extractThreadIdFromUrl();
    if (initialThreadId && /^\d+$/.test(initialThreadId)) {
      currentBaselineThreadId = initialThreadId;
      // First seed: capture whatever DOM rows exist now
      seedBaseline(initialThreadId);
    }
    // Start observing, but mutations are ignored while observerPaused === true
    chatObserver.observe(document.body, { childList: true, subtree: true });

    // Second seed after 3s to cover late-rendered history, then unpause
    setTimeout(() => {
      const threadIdNow = extractThreadIdFromUrl();
      if (threadIdNow && /^\d+$/.test(threadIdNow)) {
        if (threadIdNow !== currentBaselineThreadId) {
          // Thread changed during startup window; reset baseline for new thread
          currentBaselineThreadId = threadIdNow;
          lastObservedMessages.clear();
        }
        seedBaseline(threadIdNow);
      }
      observerPaused = false;
    }, 3000);
  }, 1000);

  // ── Call Log Scanner ────────────────────────────────────────────────────────
  // Quét span[dir="auto"] chứa text cuộc gọi mỗi 2 giây.
  // Facebook Messenger (www.facebook.com) dùng cấu trúc:
  //   <span dir="auto">Cuộc gọi thoại</span>
  //   <span dir="auto">Đã nhỡ cuộc gọi thoại</span>
  //   <span dir="auto">Cuộc gọi video</span>
  var _callSentIds = new Set();
  var _callSeenCounts = new Map();
  var _lastScannedThreadId = null;
  var _callBaselineReady = false;

  function callSignatureHash(value) {
    var hash = 0;
    var input = String(value || '');
    for (var index = 0; index < input.length; index++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  setInterval(function() {
    try {
      var threadId = extractThreadIdFromUrl();
      if (!threadId || !/^\d+$/.test(threadId)) return;

      if (threadId !== _lastScannedThreadId) {
        _lastScannedThreadId = threadId;
        _callSentIds.clear();
        _callSeenCounts.clear();
        _callBaselineReady = false;
      }

      var mainContainer = document.querySelector('div[role="main"]') || document.querySelector('div[role="log"]');
      if (!mainContainer) return;

      var spans = mainContainer.querySelectorAll('span[dir="auto"]');
      var scanCounts = new Map();
      var scanCalls = [];
      for (var i = 0; i < spans.length; i++) {
        var spanEl = spans[i];
        var txt = (spanEl.textContent || '').trim();
        var lower = txt.toLowerCase();
        if (!txt) continue;
        if (!lower.includes('cuộc gọi') && !lower.includes('nhỡ') && !lower.includes('bỏ lỡ') && !lower.includes('video')) continue;

        var parentEl = spanEl.closest('[role="button"]') || spanEl.closest('div.x78zum5') || spanEl.parentElement;
        if (!parentEl || !mainContainer.contains(parentEl)) continue;
        var parentText = parentEl ? (parentEl.textContent || '').trim() : '';
        var timeMatch = parentText.match(/(\d{1,2}:\d{2}|\d+\s*(?:giây|phút|giờ|ngày))/i);
        var timeStr = timeMatch ? timeMatch[1].replace(/[:\s]/g, '') : 'notime';
        var isOutgoing = false;
        if (lower.includes('của bạn') || lower.includes('bởi bạn') || lower.includes('do bạn')) {
          isOutgoing = true;
        } else if (lower.includes('đã nhỡ')) {
          isOutgoing = false;
        } else {
          var mainContainer = document.querySelector('div[role="main"]') || document.body;
          var mainRect = mainContainer.getBoundingClientRect();
          var spanRect = spanEl.getBoundingClientRect();
          if (mainRect.width > 0 && spanRect.width > 0) {
            var relativeLeft = spanRect.left - mainRect.left;
            if (relativeLeft > (mainRect.width * 0.4)) isOutgoing = true;
          }
        }

        var durationMatch = parentText.match(/(\d+\s*(?:giây|phút|giờ))/i);
        var displayContent = txt;
        if (durationMatch && !txt.includes(durationMatch[1])) displayContent = txt + ' • ' + durationMatch[1];

        // Stable identity: count occurrences among equivalent call rows, rather than
        // using the global span position (which changes whenever a text message arrives).
        var signature = threadId + '|' + displayContent.toLowerCase().replace(/\s+/g, ' ').trim() + '|' + timeStr + '|' + (isOutgoing ? 'out' : 'in');
        var occurrence = (scanCounts.get(signature) || 0) + 1;
        scanCounts.set(signature, occurrence);
        scanCalls.push({ signature: signature, occurrence: occurrence, displayContent: displayContent, timeStr: timeStr, isOutgoing: isOutgoing });
      }

      // First pass only records the calls already visible in Messenger. Without
      // this baseline, reloading the extension would import all historical calls.
      if (!_callBaselineReady) {
        scanCounts.forEach(function(count, signature) { _callSeenCounts.set(signature, count); });
        _callBaselineReady = true;
        return;
      }

      for (var c = 0; c < scanCalls.length; c++) {
        var call = scanCalls[c];
        var previouslySeen = _callSeenCounts.get(call.signature) || 0;
        if (call.occurrence <= previouslySeen) continue;
        _callSeenCounts.set(call.signature, call.occurrence);

        var callId = 'call_' + callSignatureHash(call.signature) + '_occ' + call.occurrence;
        if (_callSentIds.has(callId)) continue;
        _callSentIds.add(callId);

        console.log('[CALL_SCANNER] Tim thay cuoc goi MOI: "' + call.displayContent + '" (' + call.timeStr + ') | isOutgoing=' + call.isOutgoing + ' | thread=' + threadId + ' | id=' + callId);
        try {
          if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
              type: 'NEW_MESSAGE_FROM_FB',
              data: {
                thread_id: threadId,
                fb_message_id: callId,
                sender_id: call.isOutgoing ? capturedUserId : null,
                sender_name: call.isOutgoing ? 'Bạn' : '',
                content: call.displayContent,
                is_outgoing: call.isOutgoing,
                media_type: 'text',
                source: 'dom_observer',
                timestamp_ms: Date.now(),
                timestamp_source: 'realtime_fallback',
                created_at: new Date().toISOString()
              }
            });
          }
        } catch(e) {}
      }
    } catch(e) {}
  }, 2000);

  // ── Incoming Call Ringing Scanner ───────────────────────────────────────────
  // Detect the real Facebook controls; incoming-call overlays do not always keep
  // /messages/t/<id> in the active URL, so thread_id is optional for this event.
  var _lastRingingKey = null;
  setInterval(function() {
    try {
      var acceptButton = document.querySelector(
        '[role="button"][aria-label="Chấp nhận"], [role="button"][aria-label*="Accept"], [aria-label="Chấp nhận"]'
      );
      var declineButton = document.querySelector(
        '[role="button"][aria-label="Từ chối"], [role="button"][aria-label*="Decline"], [aria-label="Từ chối"]'
      );
      var callDialog = acceptButton || declineButton;
      var callerText = '';

      if (callDialog) {
        var dialogRoot = callDialog.closest('[role="dialog"]') || callDialog.parentElement?.parentElement?.parentElement || callDialog;
        callerText = (dialogRoot.textContent || '').trim();
      } else {
        var allSpans = document.querySelectorAll('span, div');
        for (var i = 0; i < allSpans.length; i++) {
          var t = (allSpans[i].textContent || '').trim();
          var lowerT = t.toLowerCase();
          if (
            lowerT.includes('đang gọi cho bạn') ||
            lowerT.includes('cuộc gọi thoại đến') ||
            lowerT.includes('cuộc gọi video đến') ||
            lowerT.includes('incoming audio call') ||
            lowerT.includes('incoming video call')
          ) {
            callDialog = allSpans[i];
            callerText = t;
            break;
          }
        }
      }

      if (callDialog) {
        var threadId = extractThreadIdFromUrl();
        var ringingKey = (threadId || 'unknown') + '|' + callerText.substring(0, 80);
        if (_lastRingingKey !== ringingKey) {
          _lastRingingKey = ringingKey;
          console.log('[CALL_RINGING] 📞 Phát hiện cuộc gọi ĐANG REO trên Facebook: thread=' + (threadId || 'unknown'));
          if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
              type: 'INCOMING_CALL_RINGING',
              data: {
                thread_id: threadId || null,
                caller_name: callerText.substring(0, 60) || 'Khách hàng',
                timestamp: Date.now()
              }
            });
          }
        }
      } else {
        if (_lastRingingKey !== null) {
          console.log('[CALL_RINGING] 📴 Cuộc gọi đã ngừng reo trên Facebook.');
          if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
              type: 'INCOMING_CALL_ENDED',
              data: { timestamp: Date.now() }
            });
          }
        }
        _lastRingingKey = null;
      }
    } catch(e) {
      console.warn('[CALL_RINGING] Detector error:', e);
    }
  }, 750);
  // ── End Call Log Scanner ────────────────────────────────────────────────────
})();

