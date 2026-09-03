// AutoChatbot FB Engine - Content Script (Unified with Avatar Extraction)
(function () {
  // Facebook sets c_user=0 as a placeholder while a page is mid-login/logged
  // out - a naive \d+ regex treats "0" as a real user id, which registered a
  // bogus "FB Account (0)" the moment an existing profile's session cookie
  // had expired and Facebook was showing a login screen (no actual login
  // action needed to trigger it).
  function sanitizeUserId(rawId) {
    if (!rawId) return null;
    const id = String(rawId).trim();
    return (!id || id === '0') ? null : id;
  }

  let capturedFbDtsg = null;
  let capturedUserId = sanitizeUserId(document.cookie.match(/c_user=(\d+)/)?.[1]);

  // Bắt crm_pending_key từ URL nếu có và lưu vào chrome.storage.local
  const urlParams = new URLSearchParams(window.location.search);
  let pendingKeyFromUrl = urlParams.get('crm_pending_key');
  if (!pendingKeyFromUrl) {
    const nextParam = urlParams.get('next');
    if (nextParam) {
      try {
        const nextUrl = new URL(nextParam, window.location.origin);
        pendingKeyFromUrl = nextUrl.searchParams.get('crm_pending_key');
      } catch (_) {}
    }
  }
  if (pendingKeyFromUrl) {
    try {
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ crm_pending_key: pendingKeyFromUrl });
      }
    } catch (e) { }
  }

  // Keep the interactive login/PIN page lightweight. The document_start
  // pending-key script and background cookie watcher are sufficient during
  // setup; full DOM/message/call observers start after setup completes and
  // the tab is reloaded once without this marker.
  try {
    if (pendingKeyFromUrl || sessionStorage.getItem('crm_pending_account_setup') === '1') {
      console.log('[FB Content] Heavy observers skipped during account setup.');
      return;
    }
  } catch (_) {}

  function findCallButton(action) {
    var targetLabel = action === 'accept' ? 'Chấp nhận' : 'Từ chối';
    // 1. Direct aria-label
    var btn = document.querySelector('[aria-label="' + targetLabel + '"][role="button"]') ||
              document.querySelector('[aria-label="' + targetLabel + '"]');
    // 2. Fallback: English labels (Facebook sometimes uses English)
    if (!btn) {
      var engLabel = action === 'accept' ? 'Accept' : 'Decline';
      btn = document.querySelector('[aria-label="' + engLabel + '"][role="button"]') ||
            document.querySelector('[aria-label*="' + engLabel + '"]');
    }
    // 3. Fallback: text content search
    if (!btn) {
      var allButtons = document.querySelectorAll('[role="button"]');
      for (var i = 0; i < allButtons.length; i++) {
        var txt = (allButtons[i].textContent || '').trim();
        if (txt === targetLabel ||
            (action === 'accept' && (txt.includes('Chấp nhận') || txt.includes('Accept'))) ||
            (action === 'decline' && (txt.includes('Từ chối') || txt.includes('Decline')))) {
          btn = allButtons[i];
          break;
        }
      }
    }
    return btn || null;
  }

  function triggerCallAnswer(action, callback) {
    console.log('[CALL_CONTROL] 🎯 Trying to click Facebook call button:', action);
    var btn = findCallButton(action);
    if (btn) {
      btn.click();
      console.log('[CALL_CONTROL] ✅ Clicked on first attempt:', action);
      if (callback) callback(true);
      return;
    }

    // Button not in DOM yet — retry every 300ms for up to 3s (10 attempts)
    console.warn('[CALL_CONTROL] ⚠️ Button not found, retrying...');
    var attempts = 0;
    var maxAttempts = 10;
    var retryInterval = setInterval(function() {
      attempts++;
      var retryBtn = findCallButton(action);
      if (retryBtn) {
        clearInterval(retryInterval);
        retryBtn.click();
        console.log('[CALL_CONTROL] ✅ Clicked on retry attempt ' + attempts + ':', action);
        if (callback) callback(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(retryInterval);
        console.warn('[CALL_CONTROL] ❌ Could not find button after ' + maxAttempts + ' attempts:', action);
        if (callback) callback(false);
      }
    }, 300);
  }

  function normalizeCallControlText(value) {
    return String(value || '')
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isVisibleCallElement(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden], [inert]')) return false;
    var style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
    if (Number(style.opacity || '1') === 0) return false;
    var rect = el.getBoundingClientRect();
    return !!rect && rect.width > 5 && rect.height > 5;
  }

  function isDisabledCallButton(el) {
    if (!el) return true;
    if (el.disabled) return true;
    var ariaDisabled = normalizeCallControlText(el.getAttribute && el.getAttribute('aria-disabled'));
    return ariaDisabled === 'true';
  }

  function getCallActionTokens(action) {
    return action === 'accept'
      ? ['chấp nhận', 'accept', 'trả lời', 'answer']
      : ['từ chối', 'decline', 'reject', 'bỏ qua', 'kết thúc', 'dismiss', 'tắt'];
  }

  function isIncomingCallSurfaceText(text) {
    return /đang gọi cho bạn|cuộc gọi (?:thoại |video )?đến|incoming (?:audio|video) call|is calling you/i.test(String(text || ''));
  }

  function gatherIncomingCallSurfaceCandidates() {
    var candidates = [];
    var seen = new Set();

    function pushCandidate(el) {
      if (!el || seen.has(el)) return;
      seen.add(el);
      candidates.push(el);
    }

    var roots = document.querySelectorAll('[role="dialog"], [aria-modal="true"], div, section');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (!isVisibleCallElement(root)) continue;
      var text = (root.textContent || '').trim();
      if (text && isIncomingCallSurfaceText(text)) pushCandidate(root);
    }

    var buttons = document.querySelectorAll('[role="button"], button, [tabindex]');
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      if (!isVisibleCallElement(btn) || isDisabledCallButton(btn)) continue;
      var label = normalizeCallControlText((btn.getAttribute && btn.getAttribute('aria-label')) || btn.textContent);
      if (!label) continue;
      if (label.includes('chấp nhận') || label.includes('accept') || label.includes('answer') || label.includes('từ chối') || label.includes('decline') || label.includes('reject') || label.includes('bỏ qua') || label.includes('kết thúc')) {
        pushCandidate(btn.closest('[role="dialog"]'));
        pushCandidate(btn.closest('[aria-modal="true"]'));
        pushCandidate(btn.parentElement);
        pushCandidate(btn.parentElement && btn.parentElement.parentElement);
      }
    }

    pushCandidate(document.body);
    return candidates.filter(Boolean);
  }

  function findCallButtonWithinRoot(root, action) {
    if (!root) return null;
    var tokens = getCallActionTokens(action);
    var elements = root.querySelectorAll('[role="button"], button, [tabindex]');
    var best = null;
    var bestScore = -1;

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!isVisibleCallElement(el) || isDisabledCallButton(el)) continue;
      var label = normalizeCallControlText((el.getAttribute && el.getAttribute('aria-label')) || '');
      var text = normalizeCallControlText(el.textContent || '');
      var combined = (label + ' ' + text).trim();
      if (!combined) continue;

      var matchedToken = '';
      for (var ti = 0; ti < tokens.length; ti++) {
        if (combined.includes(tokens[ti])) {
          matchedToken = tokens[ti];
          break;
        }
      }
      if (!matchedToken) continue;

      var score = 0;
      if (label === matchedToken || text === matchedToken) score += 4;
      if (label.indexOf(matchedToken) !== -1) score += 3;
      if (text.indexOf(matchedToken) !== -1) score += 2;
      if (el.closest('[role="dialog"]')) score += 2;
      if (root !== document.body && isIncomingCallSurfaceText(root.textContent || '')) score += 3;

      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function getIncomingCallSurface() {
    var candidates = gatherIncomingCallSurfaceCandidates();
    var best = null;
    var bestScore = -1;

    for (var i = 0; i < candidates.length; i++) {
      var root = candidates[i];
      if (!root || !isVisibleCallElement(root)) continue;
      var text = (root.textContent || '').trim();
      var accept = findCallButtonWithinRoot(root, 'accept');
      var decline = findCallButtonWithinRoot(root, 'decline');
      var score = 0;
      if (isIncomingCallSurfaceText(text)) score += 5;
      if (accept) score += 2;
      if (decline) score += 2;
      if (root.getAttribute && root.getAttribute('role') === 'dialog') score += 1;
      if (score > bestScore) {
        best = root;
        bestScore = score;
      }
    }

    return best;
  }

  function findCallButton(action) {
    var surface = getIncomingCallSurface();
    if (surface) {
      var scoped = findCallButtonWithinRoot(surface, action);
      if (scoped) return { button: scoped, surface: surface };
    }

    var fallback = findCallButtonWithinRoot(document.body, action);
    return fallback ? { button: fallback, surface: document.body } : null;
  }

  function activateCallButton(targetButton) {
    if (!targetButton) return false;
    var btn = targetButton.closest('[role="button"], button, [tabindex]') || targetButton;
    if (!isVisibleCallElement(btn) || isDisabledCallButton(btn)) return false;

    try { btn.focus(); } catch (_) {}

    // Dispatch Pointer + Mouse Events for React 18
    try {
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true, button: 0, buttons: 1 }));
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true, button: 0, buttons: 0 }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 }));
    } catch (_) {}

    // Dispatch Keyboard Events for role="button" tabindex="0"
    try {
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true }));
      btn.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true }));
    } catch (_) {}

    if (typeof btn.click === 'function') {
      btn.click();
      return true;
    }

    try {
      return btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 }));
    } catch (_) {
      return false;
    }
  }

  function triggerCallAnswer(action, callback) {
    console.log('[CALL_CONTROL] ðŸŽ¯ Trying to click Facebook call button:', action);
    var maxAttempts = 12;
    var attempt = 0;

    function finish(success) {
      if (callback) callback(!!success);
    }

    function waitForSurfaceDismiss(surface, button) {
      var checks = 0;
      var dismissInterval = setInterval(function() {
        checks++;
        var currentSurface = getIncomingCallSurface();
        var buttonStillVisible = button && isVisibleCallElement(button);
        var sameSurfaceStillVisible = surface && isVisibleCallElement(surface) && currentSurface === surface;
        if (!buttonStillVisible || !sameSurfaceStillVisible || !currentSurface) {
          clearInterval(dismissInterval);
          console.log('[CALL_CONTROL] âœ… Incoming call surface closed after action:', action);
          finish(true);
        } else if (checks >= 15) {
          clearInterval(dismissInterval);
          console.warn('[CALL_CONTROL] âŒ Incoming call surface still visible after click:', action);
          finish(false);
        }
      }, 200);
    }

    function tryActivate() {
      attempt++;
      var found = findCallButton(action);
      if (found && activateCallButton(found.button)) {
        console.log('[CALL_CONTROL] âœ… Clicked incoming call control on attempt ' + attempt + ':', action);
        waitForSurfaceDismiss(found.surface, found.button);
        return;
      }

      if (attempt >= maxAttempts) {
        console.warn('[CALL_CONTROL] âŒ Could not find active incoming call control after ' + maxAttempts + ' attempts:', action);
        finish(false);
        return;
      }

      setTimeout(tryActivate, 250);
    }

    tryActivate();
  }

  function getExactCallControlLabels(action) {
    return action === 'accept'
      ? ['Chấp nhận', 'Accept', 'Trả lời', 'Answer', 'Chấp nhận cuộc gọi', 'Accept call']
      : ['Từ chối', 'Decline', 'Bỏ qua', 'Dismiss', 'Tắt', 'Kết thúc', 'Reject', 'Từ chối cuộc gọi', 'Decline call', 'Bỏ qua cuộc gọi'];
  }

  function getCallActionTokens(action) {
    return action === 'accept'
      ? ['chấp nhận', 'accept', 'answer', 'trả lời']
      : ['từ chối', 'decline', 'reject', 'bỏ qua', 'dismiss', 'kết thúc', 'tắt'];
  }

  function isIncomingCallSurfaceText(text) {
    return /\u0111ang g\u1ecdi cho b\u1ea1n|cu\u1ed9c g\u1ecdi (?:tho\u1ea1i |video )?\u0111\u1ebfn|incoming (?:audio|video) call|is calling you/i.test(String(text || ''));
  }

  function findExactCallButtonByLabel(root, action) {
    var labels = getExactCallControlLabels(action);
    for (var i = 0; i < labels.length; i++) {
      var selector = '[role="button"][aria-label="' + labels[i] + '"], button[aria-label="' + labels[i] + '"], [tabindex][aria-label="' + labels[i] + '"]';
      var btn = null;
      if (root && root.matches && root.matches(selector)) {
        btn = root;
      } else if (root && root.querySelector) {
        btn = root.querySelector(selector);
      }
      if (btn && isVisibleCallElement(btn) && !isDisabledCallButton(btn)) return btn;
    }
    return null;
  }

  function matchesCallAction(el, action) {
    if (!el) return false;
    var label = normalizeCallControlText((el.getAttribute && el.getAttribute('aria-label')) || '');
    var text = normalizeCallControlText(el.textContent || '');
    var combined = (label + ' ' + text).trim();
    var tokens = getCallActionTokens(action);
    for (var i = 0; i < tokens.length; i++) {
      if (label === tokens[i] || text === tokens[i] || combined.indexOf(tokens[i]) !== -1) return true;
    }
    return false;
  }

  function getCallButtons(root) {
    var scope = root || document;
    var elements = scope.querySelectorAll('[role="button"][aria-label], button[aria-label], [tabindex][aria-label], [role="button"], button');
    var acceptButtons = [];
    var declineButtons = [];
    if (scope !== document && scope.matches && scope.matches('[role="button"][aria-label], button[aria-label], [tabindex][aria-label], [role="button"], button')) {
      elements = [scope].concat(Array.from(elements));
    }
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!isVisibleCallElement(el) || isDisabledCallButton(el)) continue;
      if (matchesCallAction(el, 'accept')) acceptButtons.push(el);
      if (matchesCallAction(el, 'decline')) declineButtons.push(el);
    }
    return { acceptButtons: acceptButtons, declineButtons: declineButtons };
  }

  function getIncomingCallSurface() {
    var docAccept = findExactCallButtonByLabel(document, 'accept');
    var docDecline = findExactCallButtonByLabel(document, 'decline');
    var buttons = getCallButtons(document);
    var acceptButton = docAccept || buttons.acceptButtons[0] || null;
    var declineButton = docDecline || buttons.declineButtons[0] || null;
    if (!acceptButton && !declineButton) return null;

    var candidates = [];
    var seen = new Set();
    function push(el) {
      if (!el || seen.has(el)) return;
      seen.add(el);
      candidates.push(el);
    }

    var seedButtons = [acceptButton, declineButton].filter(Boolean);
    for (var i = 0; i < seedButtons.length; i++) {
      var current = seedButtons[i];
      var depth = 0;
      while (current && depth < 8) {
        push(current);
        if (current.getAttribute && (current.getAttribute('role') === 'dialog' || current.getAttribute('aria-modal') === 'true')) break;
        current = current.parentElement;
        depth += 1;
      }
    }

    var best = null;
    var bestScore = -1;
    for (var j = 0; j < candidates.length; j++) {
      var root = candidates[j];
      if (!isVisibleCallElement(root)) continue;
      var score = 0;
      var text = normalizeCallControlText(root.textContent || '');
      if (isIncomingCallSurfaceText(text)) score += 5;
      if (acceptButton && root.contains(acceptButton)) score += 3;
      if (declineButton && root.contains(declineButton)) score += 3;
      if (acceptButton && declineButton && root.contains(acceptButton) && root.contains(declineButton)) score += 6;
      if (root.getAttribute && root.getAttribute('role') === 'dialog') score += 2;
      if (score > bestScore) {
        best = root;
        bestScore = score;
      }
    }

    return best;
  }

  function findNearestCallSurface(button) {
    var current = button;
    var depth = 0;
    while (current && depth < 8) {
      if (isVisibleCallElement(current) && isIncomingCallSurfaceText(current.textContent || '')) return current;
      if (current.getAttribute && (current.getAttribute('role') === 'dialog' || current.getAttribute('aria-modal') === 'true')) return current;
      current = current.parentElement;
      depth += 1;
    }
    return button && button.parentElement ? button.parentElement : null;
  }

  function findCallButton(action) {
    var exactDocumentButton = findExactCallButtonByLabel(document, action);
    if (exactDocumentButton) {
      return {
        button: exactDocumentButton,
        surface: findNearestCallSurface(exactDocumentButton)
      };
    }

    var surface = getIncomingCallSurface();
    if (!surface) return null;
    var exact = findExactCallButtonByLabel(surface, action);
    if (exact) return { button: exact, surface: surface };
    var buttons = getCallButtons(surface);
    var matches = action === 'accept' ? buttons.acceptButtons : buttons.declineButtons;
    return matches.length ? { button: matches[0], surface: surface } : null;
  }

  function activateCallButton(targetButton) {
    if (!targetButton) return false;
    var button = targetButton.closest('[role="button"], button, [tabindex]') || targetButton;
    if (!isVisibleCallElement(button) || isDisabledCallButton(button)) return false;
    try { button.focus(); } catch (_) {}
    try {
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 }));
    } catch (_) {}
    if (typeof button.click === 'function') {
      button.click();
      return true;
    }
    try {
      return button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
    } catch (_) {
      return false;
    }
  }

  function triggerCallAnswer(action, callback) {
    console.log('[CALL_CONTROL] Trying to click Facebook call button:', action);
    var attempts = 0;
    var maxAttempts = 12;

    function finish(success) {
      if (callback) callback(!!success);
    }

    function waitForDismiss(surface, button) {
      var checks = 0;
      var timer = setInterval(function() {
        checks += 1;
        var currentSurface = getIncomingCallSurface();
        var surfaceGone = !currentSurface || !surface || !surface.isConnected;
        var buttonGone = !button || !button.isConnected || !isVisibleCallElement(button);
        if (surfaceGone || buttonGone) {
          clearInterval(timer);
          finish(true);
          return;
        }
        if (checks >= 15) {
          clearInterval(timer);
          finish(false);
        }
      }, 200);
    }

    function runAttempt() {
      attempts += 1;
      var found = findCallButton(action);
      if (found && activateCallButton(found.button)) {
        waitForDismiss(found.surface, found.button);
        return;
      }
      if (attempts >= maxAttempts) {
        finish(false);
        return;
      }
      setTimeout(runAttempt, 250);
    }

    runAttempt();
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
          // Use async callback so sendResponse stays open
          triggerCallAnswer(msg.action, function(success) {
            if (sendResponse) {
              try { sendResponse({ success: success }); } catch(e) {}
            }
          });
          return true; // keep message channel open for async response
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
      
      capturedUserId = capturedUserId || sanitizeUserId(document.cookie.match(/c_user=(\d+)/)?.[1]);
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
    if (event.data && event.data.type === 'FB_TOKEN_DISCOVERED') {
      if (event.data.fb_dtsg) {
        capturedFbDtsg = event.data.fb_dtsg;
        capturedUserId = capturedUserId || sanitizeUserId(document.cookie.match(/c_user=(\d+)/)?.[1]);
        if (capturedFbDtsg && capturedUserId) {
          reportTokens(capturedFbDtsg, capturedUserId);
        }
      }
    }
  });

  const processedKeys = new Set();
  const recentNetworkEmits = new Map();
  const recentDomEmits = new Map();

  function reportTokens(fb_dtsg, user_id) {
    if (!user_id) return;
    try {
      if (chrome?.runtime?.id) {
        if (chrome?.storage?.local) {
          chrome.storage.local.get(['crm_pending_key'], (res) => {
            const pending_key = res?.crm_pending_key || pendingKeyFromUrl || null;
            chrome.runtime.sendMessage({ type: 'FB_TOKENS_EXTRACTED', data: { fb_dtsg: fb_dtsg || '', user_id, pending_key } });
          });
        } else {
          chrome.runtime.sendMessage({ type: 'FB_TOKENS_EXTRACTED', data: { fb_dtsg: fb_dtsg || '', user_id, pending_key: pendingKeyFromUrl || null } });
        }
      }
    } catch (e) { }
  }

  function extractFbTokensFromDOM() {
    if (!capturedUserId) {
      capturedUserId = sanitizeUserId(document.cookie.match(/c_user=(\d+)/)?.[1]);
    }
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!capturedUserId) {
        const uMatch = text.match(/"USER_ID":"(\d+)"/) || text.match(/"actorID":"(\d+)"/) || text.match(/"ACCOUNT_ID":"(\d+)"/);
        if (uMatch) capturedUserId = sanitizeUserId(uMatch[1]);
      }
      if (!capturedFbDtsg) {
        if (text.includes('DTSGInitialData') || text.includes('DTSGInitData') || text.includes('fb_dtsg')) {
          const match = text.match(/"token":"([^"]+)"/) || text.match(/"fb_dtsg":"([^"]+)"/) || text.match(/"async_get_token":"([^"]+)"/);
          if (match) capturedFbDtsg = match[1];
        }
      }
    }
    const inputEl = document.querySelector('input[name="fb_dtsg"]');
    if (inputEl?.value) { capturedFbDtsg = inputEl.value; }

    if (capturedUserId) {
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
  // Map<fbMessageId, lastForwardedIsOutgoing> rather than a plain Set: an id is
  // now stable across direction-unstable re-scans of the same message (spec
  // 045), so "already observed" alone can no longer gate resending - a re-scan
  // that disagrees on direction must still reach the server (with the SAME id)
  // so ConversationRepository.reconcileExistingMessage's hysteresis (spec 019)
  // gets a chance to resolve it, instead of being silently dropped forever.
  let lastObservedMessages = new Map();

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
    const COMPOSER_EXCLUDE = 'form, [contenteditable="true"], [role="textbox"], [aria-label="Aa"], [aria-label="Tin nhắn"], [aria-label*="composer"], [aria-label*="Soạn"], [role="contentinfo"], header, nav, [role="complementary"], [aria-label*="Thông tin về đoạn chat"], [aria-label*="Conversation information"], [aria-label*="Chi tiết cuộc trò chuyện"]';

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
    const directRowMatch = node.closest?.('div[role="article"]') || node.closest?.('div[role="row"]');
    if (!directRowMatch) {
      // node isn't itself scoped to a single row - check whether it's a bulk
      // container holding MULTIPLE separate rows (e.g. Facebook mounting a
      // whole thread's worth of content at once on a fresh/cold profile's
      // initial load, or a large virtualization re-render) before falling
      // back to treating the whole thing as one row below. Live evidence
      // (2026-08-20, fresh Chrome-for-Testing profile): a page's intro card
      // (follower count, category tag, "conversation details" link) and
      // several unrelated real messages all got merged into ONE fake "row"
      // this way, sharing the SAME arbitrary native_id and SAME arbitrary
      // direction reading (whichever nested element the querySelector calls
      // below happened to match first) - producing both garbage-as-message
      // rows AND ghost duplicates of already-seen real messages with a
      // flipped direction. Recursing per actual row gives each one its own
      // correctly-scoped native_id/direction lookup instead.
      const nestedRows = node.querySelectorAll('div[role="article"], div[role="row"]');
      if (nestedRows.length > 1) {
        let combined = [];
        for (const row of nestedRows) {
          combined = combined.concat(parseMessagesFromDOMNode(row, isRealtime));
        }
        return combined;
      }
    }
    const messageRow = directRowMatch || node;

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
    // [data-message-id] checked first: live DOM inspection (spec 043) found it's
    // the reliable current-structure marker, set on the row at insertion time -
    // unlike the aria-label above, which React hydrates a beat later. Checking
    // it first means a message row already has a STABLE native_id on the very
    // first (label-not-yet-hydrated) MutationObserver pass, not just the second.
    const nativeIdEl = messageRow.querySelector?.('[data-message-id], [data-id], [id^="mid."]');
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
        const urlMatch = location.href.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
        const contactNameEl = document.querySelector('header h1, header h2, [role="main"] h1, [role="main"] h2, span[aria-level="1"]');
        const contactNameStr = contactNameEl ? contactNameEl.textContent.trim() : '';
        const hasContactAvatar = contactNameStr ? !!(
          Array.from(messageRow.querySelectorAll('img[alt], div[role="img"][aria-label], img[aria-label]')).some(el => {
            const alt = el.getAttribute('alt') || el.getAttribute('aria-label') || '';
            return alt.toLowerCase().includes(contactNameStr.toLowerCase());
          })
        ) : false;
        is_outgoing = !hasContactAvatar;
        sender_name = is_outgoing ? 'Bạn' : contactNameStr;
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
        native_id: nativeIdEl?.getAttribute('data-message-id') || nativeIdEl?.getAttribute('data-id') || nativeIdEl?.getAttribute('id') || messageRow.getAttribute?.('data-message-id') || messageRow.getAttribute?.('data-id') || null,
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
        native_id: nativeIdEl?.getAttribute('data-message-id') || nativeIdEl?.getAttribute('data-id') || nativeIdEl?.getAttribute('id') || messageRow.getAttribute?.('data-message-id') || messageRow.getAttribute?.('data-id') || null,
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
    // Real Facebook native id (data-message-id/data-id/mid.*) is always the
    // most stable identifier when present - use it directly, no hashing.
    if (parsed.native_id) return String(parsed.native_id);
    // Fallback hash for messages with no native id. is_outgoing/sender_name/
    // effective_label are deliberately excluded: all three are derived from
    // the message row's aria-label (see the sender/direction block above),
    // which React can hydrate a beat after MutationObserver's first pass
    // fires. Hashing them in meant a re-scan of the SAME physical message
    // that read a different (still-settling) label produced a DIFFERENT id -
    // so neither this dedup nor the server's UNIQUE(fb_message_id) ever saw
    // it as the same message, and it landed as a ghost duplicate row with a
    // flipped direction (spec 045). Only thread_id+content go into the hash
    // now - content is read straight off the bubble text node, not the
    // label, so it doesn't share this instability.
    let textHash = 0;
    const strToHash = `${thread_id}|${parsed.content}`;
    for (let i = 0; i < strToHash.length; i++) {
      textHash = Math.imul(31, textHash) + strToHash.charCodeAt(i) | 0;
    }
    return `dom_${thread_id}_hash_${Math.abs(textHash)}_${parsed.bubble_idx}`;
  }

  function seedBaseline(thread_id) {
    const existingRows = document.querySelectorAll('div[role="row"], div[role="article"], div[data-scope="messages_table"] div[dir="auto"]');
    existingRows.forEach(row => {
      const parsedMessages = parseMessagesFromDOMNode(row);
      parsedMessages.forEach(p => {
        lastObservedMessages.set(makeDomMessageId(thread_id, p), p.is_outgoing);
      });
    });
    while (lastObservedMessages.size > 2000) lastObservedMessages.delete(lastObservedMessages.keys().next().value);
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
      // Tiếp tục seed sau 1.5s để cover nốt lịch sử load chậm
      setTimeout(() => {
        if (currentBaselineThreadId !== thread_id) return; // Tránh leak timeout sang thread khác nếu user chuyển quá nhanh
        seedBaseline(thread_id);
        observerPaused = false;
      }, 1500);
    }

    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;

      const inMain = node.closest?.('div[role="main"]');
      const inComposerOrHeader = node.closest?.('form, [role="contentinfo"], [aria-label*="composer"], [aria-label*="Soạn"], header, nav');
      if (!inMain || inComposerOrHeader) return;

      const parsedMessages = parseMessagesFromDOMNode(node, true);
      if (parsedMessages.length === 0) return;

      // Baseline rows were already added to lastObservedMessages before the
      // observer was unpaused. Do not suppress incoming bubbles here: the first
      // customer reply often arrives while Messenger is still hydrating after
      // our outgoing bubble, and suppressing all incoming rows in that window
      // made the customer have to send a second message. Stable DOM/native IDs
      // below remain the replay guard for old history.
      const activeParsed = parsedMessages;
      if (activeParsed.length === 0) return;

      const contactAvatar = extractContactAvatarFromNode(node);

      activeParsed.forEach((parsed) => {
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

        // Skip only if THIS exact reading (same id, same direction) was already
        // forwarded - a re-scan that now disagrees on direction is deliberately
        // let through (with the same fbMessageId) so the server's existing
        // reconcile/hysteresis path (spec 019) can settle it, rather than a new
        // duplicate row being created or the correction being silently dropped.
        if (lastObservedMessages.get(fbMessageId) === parsed.is_outgoing) return;
        lastObservedMessages.set(fbMessageId, parsed.is_outgoing);
        if (lastObservedMessages.size > 2000) lastObservedMessages.delete(lastObservedMessages.keys().next().value);

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
                sender_role: parsed.is_outgoing ? 'operator' : 'customer',
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
  var _callPendingDirections = new Map();
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

  function scanCallLogsNow() {
    try {
      var threadId = extractThreadIdFromUrl();
      if (!threadId || !/^\d+$/.test(threadId)) return;

      if (threadId !== _lastScannedThreadId) {
        _lastScannedThreadId = threadId;
        _callSentIds.clear();
        _callSeenCounts.clear();
        _callPendingDirections.clear();
        _callBaselineReady = false;
      }

      // Scan only the active conversation's message log. role="main" also
      // contains the Messenger sidebar, whose conversation previews include
      // call text and unrelated avatars (confirmed against the live DOM).
      var mainContainer = document.querySelector(
        '[role="log"][aria-label*="Tin nh\u1eafn trong cu\u1ed9c tr\u00f2 chuy\u1ec7n"], ' +
        '[role="log"][aria-label*="Messages in the conversation"]'
      ) || document.querySelector('div[role="main"] [role="log"]');
      if (!mainContainer) return;

      var spans = mainContainer.querySelectorAll('span[dir="auto"]');
      var contactHeading = document.querySelector('header h1, header h2, [role="main"] h1, [role="main"] h2, span[aria-level="1"]');
      var expectedContactName = (contactHeading ? contactHeading.textContent : '').replace(/\s+/g, ' ').trim().toLowerCase();
      var scanCounts = new Map();
      var scanCalls = [];
      var seenCallRows = new Set();
      for (var i = 0; i < spans.length; i++) {
        var spanEl = spans[i];
        var txt = (spanEl.textContent || '').trim();
        var lower = txt.toLowerCase();
        if (!txt) continue;
        if (!lower.includes('cuộc gọi') && !lower.includes('nhỡ') && !lower.includes('bỏ lỡ') && !lower.includes('video')) continue;

        var parentEl = spanEl.closest('[role="button"]') || spanEl.closest('div.x78zum5') || spanEl.parentElement;
        if (!parentEl || !mainContainer.contains(parentEl)) continue;
        // A real Messenger bubble is an article. Sidebar previews are not.
        var canonicalCallRow = spanEl.closest('[role="article"]');
        if (!canonicalCallRow || !mainContainer.contains(canonicalCallRow)) continue;
        if (seenCallRows.has(canonicalCallRow)) continue;
        seenCallRows.add(canonicalCallRow);
        var parentText = parentEl ? (parentEl.textContent || '').trim() : '';
        var timeMatch = parentText.match(/(\d{1,2}:\d{2}|\d+\s*(?:giây|phút|giờ|ngày))/i);
        var timeStr = timeMatch ? timeMatch[1].replace(/[:\s]/g, '') : 'notime';
        // Missed is an outcome, not a sender direction. Avatar/position below
        // must decide which side owns the call row.
        lower = lower.replace(/\u0111\u00e3\s+nh\u1ee1|\u0111\u00e3\s+b\u1ecf\s+l\u1ee1|b\u1ecf\s+l\u1ee1/g, '');
        var isOutgoing = false;
        if (lower.includes('của bạn') || lower.includes('bởi bạn') || lower.includes('do bạn')) {
          isOutgoing = true;
        } else if (lower.includes('đã nhỡ') || lower.includes('bỏ lỡ')) {
          isOutgoing = false;
        } else {
          var rowContainer = spanEl.parentElement;
          for (var d = 0; d < 15 && rowContainer; d++) {
            var tag = rowContainer.tagName ? rowContainer.tagName.toLowerCase() : '';
            if (tag === 'article' || rowContainer.getAttribute('role') === 'row' || rowContainer.getAttribute('role') === 'listitem') break;
            rowContainer = rowContainer.parentElement;
          }
          if (rowContainer) {
            var imgs = rowContainer.querySelectorAll('img[alt], img[aria-label]');
            var hasContactAvatar = false;
            for (var ii = 0; ii < imgs.length; ii++) {
              var candidateAlt = (imgs[ii].getAttribute('alt') || imgs[ii].getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
              if (expectedContactName && candidateAlt.includes(expectedContactName)) {
                hasContactAvatar = true;
                break;
              }
              if (expectedContactName) continue;
              var altTxt = (imgs[ii].getAttribute('alt') || imgs[ii].getAttribute('aria-label') || '').trim();
              if (altTxt && !/^(bạn|you)$/i.test(altTxt)) {
                hasContactAvatar = true;
                break;
              }
            }
            if (hasContactAvatar) {
              isOutgoing = false;
            } else {
              var containerEl2 = document.querySelector('div[role="main"]') || document.body;
              var cRect2 = containerEl2.getBoundingClientRect();
              var sRect2 = spanEl.getBoundingClientRect();
              if (cRect2.width > 0 && sRect2.width > 0) {
                isOutgoing = (sRect2.left - cRect2.left) > (cRect2.width * 0.45);
              } else {
                isOutgoing = true;
              }
            }
          }
        }

        var durationMatch = parentText.match(/(\d+\s*(?:giây|phút|giờ))/i);
        // The owner label can be on the article itself, a deep child, or a
        // wrapper above it (Facebook changes this during hydration). Inspect
        // all three instead of querySelector-only, which misses the row itself
        // and caused an A -> B call to be guessed from geometry on B's side.
        var ownershipLabels = [];
        var labelCursor = canonicalCallRow;
        for (var labelDepth = 0; labelDepth < 4 && labelCursor && mainContainer.contains(labelCursor); labelDepth++) {
          var cursorLabel = labelCursor.getAttribute?.('aria-label');
          if (cursorLabel) ownershipLabels.push(cursorLabel);
          labelCursor = labelCursor.parentElement;
        }
        var ownershipNodes = canonicalCallRow.querySelectorAll?.('[aria-label]') || [];
        for (var labelIndex = 0; labelIndex < ownershipNodes.length; labelIndex++) {
          ownershipLabels.push(ownershipNodes[labelIndex].getAttribute('aria-label') || '');
        }
        for (var ownerIndex = 0; ownerIndex < ownershipLabels.length; ownerIndex++) {
          var authoritativeDirection = globalThis.FbCrmCallDirection?.directionFromAccessibilityLabel(ownershipLabels[ownerIndex]);
          if (authoritativeDirection !== null && authoritativeDirection !== undefined) {
            isOutgoing = authoritativeDirection;
            break;
          }
        }

        // Final authority for call bubbles: Messenger renders the contact's
        // avatar only on the contact-owned row. "You" rows have no avatar.
        // Scope this strictly to the canonical call article so header/sidebar
        // avatars cannot flip the result. Do not let aria labels or geometry
        // override this rule.
        var rowAvatarCandidates = canonicalCallRow.querySelectorAll?.('img') || [];
        var hasVisibleRowAvatar = false;
        for (var avatarIndex = 0; avatarIndex < rowAvatarCandidates.length; avatarIndex++) {
          var avatarEl = rowAvatarCandidates[avatarIndex];
          var avatarSrc = avatarEl.currentSrc || avatarEl.src || '';
          if (!avatarSrc || /transparent|blank|emoji|staticxx/i.test(avatarSrc)) continue;
          var avatarRect = avatarEl.getBoundingClientRect?.();
          if (!avatarRect || avatarRect.width < 16 || avatarRect.height < 16) continue;
          if (avatarRect.width > 80 || avatarRect.height > 80) continue;
          var avatarStyle = window.getComputedStyle?.(avatarEl);
          if (avatarStyle && (avatarStyle.display === 'none' || avatarStyle.visibility === 'hidden' || avatarStyle.opacity === '0')) continue;
          hasVisibleRowAvatar = true;
          break;
        }
        isOutgoing = !hasVisibleRowAvatar;

        var displayContent = txt;
        if (durationMatch && !txt.includes(durationMatch[1])) displayContent = txt + ' • ' + durationMatch[1];

        // Direction is deliberately NOT part of identity. Facebook hydrates
        // ownership labels after the call row first appears; including the
        // temporary side here turned one call into two bubbles (first A, then B).
        var signature = threadId + '|' + displayContent.toLowerCase().replace(/\s+/g, ' ').trim() + '|' + timeStr;
        var occurrence = (scanCounts.get(signature) || 0) + 1;
        scanCounts.set(signature, occurrence);
        scanCalls.push({ signature: signature, occurrence: occurrence, displayContent: displayContent, timeStr: timeStr, isOutgoing: isOutgoing, hasRowAvatar: hasVisibleRowAvatar });
      }

      if (!_callBaselineReady) {
        _callPendingDirections.clear();
        _callBaselineReady = true;
      }

      for (var c = 0; c < scanCalls.length; c++) {
        var call = scanCalls[c];
        var previouslySeen = _callSeenCounts.get(call.signature) || 0;
        if (call.occurrence <= previouslySeen) continue;

        // Require four consecutive scans with the same avatar result. This
        // gives a lazy-loaded contact avatar time to mount before committing
        // the row as an avatar-less "You" call.
        var pendingKey = call.signature + '|occ' + call.occurrence;
        var pendingDirection = _callPendingDirections.get(pendingKey);
        if (!pendingDirection || pendingDirection.isOutgoing !== call.isOutgoing) {
          _callPendingDirections.set(pendingKey, { isOutgoing: call.isOutgoing, confirmations: 1 });
          continue;
        }
        pendingDirection.confirmations += 1;
        if (pendingDirection.confirmations < 4) continue;
        _callPendingDirections.delete(pendingKey);
        _callSeenCounts.set(call.signature, call.occurrence);

        // Duration/text are not unique: two separate calls to the same person
        // can both be "Voice call - 2 seconds". Baseline/seen-counts already
        // prevent old DOM rows from being emitted again, so add this detection
        // instant to distinguish genuinely new calls across the same thread.
        var callId = 'call_dom_' + callSignatureHash(call.signature + '|occ' + call.occurrence);
        if (_callSentIds.has(callId)) continue;
        _callSentIds.add(callId);

        console.log('[CALL_SCANNER] Tim thay cuoc goi MOI: "' + call.displayContent + '" (' + call.timeStr + ') | hasRowAvatar=' + call.hasRowAvatar + ' | isOutgoing=' + call.isOutgoing + ' | thread=' + threadId + ' | id=' + callId);
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
                has_row_avatar: call.hasRowAvatar,
                direction_evidence: 'call_article_avatar',
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
  }

  setInterval(scanCallLogsNow, 1200);

  // ── Incoming Call Ringing Scanner ───────────────────────────────────────────
  // Detect the real Facebook controls; incoming-call overlays do not always keep
  // /messages/t/<id> in the active URL, so thread_id is optional for this event.
  //
  // Facebook's own call overlay shows the caller's name twice (once as a
  // heading, once inside "<name> đang gọi cho bạn") plus a "Cuộc gọi đến"
  // label - grabbing dialogRoot.textContent wholesale concatenates all of
  // that with no separators ("Cuộc gọi đếnLê Văn KhangLê Văn Khang đang gọi
  // cho bạn..."). This trims the known leading/trailing labels and collapses
  // an exact-duplicate name back down to one copy.
  function extractCallerNameFromDialogText(rawText) {
    if (!rawText) return '';
    let working = rawText
      .replace(/^Cuộc gọi (?:thoại |video )?đến/i, '')
      .trim();
    const cutIdx = working.search(/đang gọi cho bạn|cuộc gọi (?:thoại|video) đến|incoming (?:audio|video) call/i);
    if (cutIdx !== -1) working = working.slice(0, cutIdx).trim();
    if (working.length > 0 && working.length % 2 === 0) {
      const half = working.length / 2;
      const firstHalf = working.slice(0, half);
      if (firstHalf === working.slice(half)) working = firstHalf;
    }
    return working;
  }

  var _lastRingingKey = null;
  setInterval(function() {
    try {
      var acceptButton = document.querySelector(
        '[role="button"][aria-label="Chấp nhận"], [role="button"][aria-label*="Accept"], [aria-label="Chấp nhận"]'
      );
      var declineButton = document.querySelector(
        '[role="button"][aria-label="Từ chối"], [role="button"][aria-label*="Decline"], [aria-label="Từ chối"]'
      );
      // Require Facebook's two explicit ringing controls together. The more
      // permissive call-control helper also recognizes words such as "Trả
      // lời", which occur on ordinary message reply actions.
      var callDialog = acceptButton && declineButton
        ? (acceptButton.closest('[role="dialog"]') || declineButton.closest('[role="dialog"]') || acceptButton.parentElement)
        : null;
      var callerText = '';

      if (callDialog) {
        callerText = ((callDialog.closest && callDialog.closest('[role="dialog"]')) || callDialog).textContent.trim();
      }

      // Never infer a live call from arbitrary page text. Call-history rows,
      // quoted replies and accessibility containers retain phrases such as
      // "incoming audio call" after a call has ended. Only Facebook's real
      // call surface or its Accept/Decline controls are authoritative.

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
                caller_name: extractCallerNameFromDialogText(callerText).substring(0, 60) || 'Khách hàng',
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

