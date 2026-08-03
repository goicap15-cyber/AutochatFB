// AutoChatbot FB Engine - Service Worker Background Script
let ws = null;
let fb_dtsg = null;
let user_id = null;
let pending_key = null;
let reconnectTimer = null;
let reconnectDelay = 3000;

const WS_URLS = ['ws://127.0.0.1:5050/extension', 'ws://localhost:5050/extension'];
let currentWsIndex = 0;

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const targetWsUrl = WS_URLS[currentWsIndex % WS_URLS.length];
  console.log('[FB Engine] Đang kết nối WebSocket Backend:', targetWsUrl);

  try {
    ws = new WebSocket(targetWsUrl);
  } catch (e) {
    console.error('[FB Engine] Không thể tạo WebSocket:', e.message);
    currentWsIndex++;
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[FB Engine] ✅ WebSocket Backend đã kết nối thành công.');
    console.log('[FB Engine] 🔍 WS readyState:', ws.readyState, '(1=OPEN)');
    console.log('[FB Engine] 🔍 fb_dtsg:', fb_dtsg ? 'có' : 'null', '| user_id:', user_id, '| pending_key:', pending_key);
    reconnectDelay = 3000; // reset delay
    if (fb_dtsg && user_id) {
      console.log('[FB Engine] 📤 Gửi REGISTER_ACCOUNT (qđ tại onopen):', { account_id: user_id, pending_key });
      sendToBackend('REGISTER_ACCOUNT', { account_id: user_id, fb_dtsg, pending_key });
    } else {
      console.log('[FB Engine] ⏸️ Chưa có tokens, sẽ gửi khi nhận từ content script...');
    }
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('[FB Engine] 📩 Nhận từ Backend:', message.type, '| raw:', event.data.substring(0, 300));

      switch (message.type) {
        case 'REGISTER_ACCOUNT_ACK': {
          console.log('[FB Engine] ✅ Backend ACK đăng ký tài khoản thành công:', message.data);
          pending_key = null;
          try {
            if (chrome?.storage?.local) {
              chrome.storage.local.remove(['crm_pending_key']);
            }
            chrome.tabs.query({ url: ['*://*.facebook.com/*', '*://*.messenger.com/*'] }, (tabs) => {
              tabs.forEach(tab => {
                if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_PENDING_KEY' }).catch(() => {});
              });
            });
          } catch (e) {}
          break;
        }
        case 'SEND_MESSAGE':
          await handleSendMessage(message.data);
          break;
        case 'SYNC_THREADS':
          console.log("[FB Engine] 🔄 Đang sync threads sidebar cho account:", message.data);
          await handleSync100Threads(message.data);
          break;
        case 'SYNC_THREAD_MESSAGES':
          console.log("[FB Engine] 🔄 Đang sync lịch sử tin nhắn thread:", message.data);
          await handleSyncThreadMessages(message.data);
          break;
        default:
          console.log('[FB Engine] Không có handler cho message type:', message.type);
          break;
      }
    } catch (err) {
      console.error('[FB Engine] Lỗi xử lý WS message:', err);
    }
  };

  ws.onerror = (err) => {
    console.warn('[FB Engine] ⚠️ WebSocket lỗi kết nối. Đang đổi sang địa chỉ WebSocket dự phòng...');
    currentWsIndex++;
  };

  ws.onclose = (event) => {
    console.log(`[FB Engine] WebSocket đóng (code=${event.code}). Thử lại sau ${reconnectDelay / 1000}s...`);
    ws = null;
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
}

function sendToBackend(type, data) {
  console.log('[FB Engine] 🔍 sendToBackend:', type, '| WS readyState:', ws?.readyState, '| WS null?:', ws === null);
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = JSON.stringify({ type, data });
    console.log('[FB Engine] 📤 Gửi payload:', payload.substring(0, 200));
    ws.send(payload);
    console.log('[FB Engine] ✅ Đã gửi thành công:', type);
    return true;
  } else {
    console.error('[FB Engine] ❌ Chưa kết nối backend, KHÔNG GỬI ĐƯỢC:', type, '| WS readyState:', ws?.readyState);
    return false;
  }
}

// Bắt events từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[FB Engine] 📥 onMessage received from content:', message.type, JSON.stringify(message).substring(0, 300));

  if (message.type === 'FB_TOKENS_EXTRACTED') {
    const newUserId = message.data.user_id;
    const newDtsg = message.data.fb_dtsg;
    const incomingPendingKey = message.data.pending_key;
    if (incomingPendingKey) pending_key = incomingPendingKey;

    if (newUserId !== user_id || newDtsg !== fb_dtsg || incomingPendingKey) {
      fb_dtsg = newDtsg;
      user_id = newUserId;
      console.log('[FB Engine] ✅ Đã lấy tokens cho user:', user_id, '| pending_key:', pending_key);
      console.log('[FB Engine] 📤 Gửi REGISTER_ACCOUNT từ onMessage:', { account_id: user_id, pending_key });
      sendToBackend('REGISTER_ACCOUNT', { account_id: user_id, fb_dtsg, pending_key });
    }
  }

  // Forward tin nhắn Facebook đến backend CRM
  if (message.type === 'NEW_MESSAGE_FROM_FB') {
    const msgData = message.data;
    console.log('[FB Engine] 📨 NEW_MESSAGE_FROM_FB từ content:', JSON.stringify(msgData).substring(0, 300));
    console.log('[FB Engine] 🔍 user_id hiện tại:', user_id);
    // Đính kèm account_id cho backend biết tài khoản nào nhận tin
    sendToBackend('NEW_MESSAGE_RECEIVED', {
      ...msgData,
      account_id: user_id
    });
    console.log(`[FB Engine] 📤 Forward tin nhắn → Backend: "${(msgData.content || '').substring(0, 50)}"`);
  }

  return false;
});

// ── Lấy tab Facebook tương ứng với account_id (khớp c_user cookie) ─────────
async function getFacebookTab(accountId) {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: ['*://*.facebook.com/*', '*://*.messenger.com/*'] }, async (tabs) => {
      if (!tabs || tabs.length === 0) return resolve(null);

      for (const tab of tabs) {
        if (tab.discarded || !tab.id) continue;
        try {
          const res = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.cookie.match(/c_user=(\d+)/)?.[1] || null
          });
          const tabUserId = res?.[0]?.result;
          if (accountId && String(tabUserId) === String(accountId)) {
            return resolve(tab);
          }
        } catch (e) {}
      }

      const active = tabs.find(t => !t.discarded);
      resolve(active || null);
    });
  });
}

// ── Gửi tin nhắn qua Facebook GraphQL API ──────────────────────────────────
async function handleSendMessage({ thread_id, content, text, client_message_id }) {
  const messageText = content ?? text;
  if (!messageText || !messageText.trim()) {
    console.warn('[SEND_MESSAGE] Lỗi: Nội dung tin nhắn trống', { thread_id, client_message_id });
    sendToBackend('SEND_MESSAGE_RESULT', { thread_id, client_message_id, success: false, error: 'Nội dung tin nhắn trống' });
    return;
  }

  console.log(`[SEND_MESSAGE] 📤 Đang gửi tin nhắn: account=${user_id} thread=${thread_id} client_msg_id=${client_message_id}`);

  // Cách 1: Thử gửi trực tiếp qua Service Worker Fetch nếu có token
  if (fb_dtsg) {
    try {
      const formData = new URLSearchParams();
      formData.append('fb_dtsg', fb_dtsg);
      formData.append('queries', JSON.stringify({
        o0: {
          doc_id: '3336396659757871',
          query_params: {
            data: {
              client_mutation_id: client_message_id || Date.now().toString(),
              actor_id: user_id,
              thread_id,
              message: { text: messageText }
            }
          }
        }
      }));

      const response = await fetch('https://www.facebook.com/api/graphql/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      if (response.ok) {
        const resJson = await response.json();
        const hasError = resJson?.errors?.length || resJson?.o0?.errors?.length;
        const messageId = resJson?.o0?.data?.message?.message_id || resJson?.data?.message?.message_id || resJson?.o0?.data?.message_id || resJson?.data?.message_id || resJson?.o0?.data?.send_message?.message?.message_id;

        if (!hasError && messageId) {
          console.log('[SEND_MESSAGE] ✅ ServiceWorker Fetch gửi thành công, message_id:', messageId);
          sendToBackend('SEND_MESSAGE_RESULT', { thread_id, client_message_id, success: true, message_id: messageId, result: resJson });
          return;
        }
      }
    } catch (e) {
      console.warn('[SEND_MESSAGE] ServiceWorker Fetch thất bại, thử lại qua Tab context:', e.message);
    }
  }

  // Cách 2: Fallback gửi tin nhắn trong Tab Context của Facebook (Đảm bảo đầy đủ Session, Cookie và Token dtsg)
  try {
    const tab = await getFacebookTab(user_id);
    if (!tab) {
      sendToBackend('SEND_MESSAGE_RESULT', { thread_id, client_message_id, success: false, error: 'Không tìm thấy Tab Facebook hoạt động' });
      return;
    }

    const tabSendResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (targetThreadId, msgTxt, clientMsgId, fallbackDtsg, actorId) => {
        try {
          const dtsgToken = fallbackDtsg || window.require?.('DTSGInitialData')?.token || document.querySelector('[name="fb_dtsg"]')?.value;
          if (!dtsgToken) return { success: false, error: 'Thiếu fb_dtsg token trong Tab Facebook' };

          const formData = new URLSearchParams();
          formData.append('fb_dtsg', dtsgToken);
          formData.append('queries', JSON.stringify({
            o0: {
              doc_id: '3336396659757871',
              query_params: {
                data: {
                  client_mutation_id: clientMsgId || Date.now().toString(),
                  actor_id: actorId || document.cookie.match(/c_user=(\d+)/)?.[1],
                  thread_id: targetThreadId,
                  message: { text: msgTxt }
                }
              }
            }
          }));

          const res = await fetch('https://www.facebook.com/api/graphql/', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
          });

          const json = await res.json();
          const msgId = json?.o0?.data?.message?.message_id || json?.data?.message?.message_id || json?.o0?.data?.message_id || json?.data?.send_message?.message?.message_id;
          const errMsg = json?.errors?.[0]?.message || json?.o0?.errors?.[0]?.message;

          return { success: !!msgId, message_id: msgId, error: errMsg || (msgId ? null : 'Không nhận được message_id từ Facebook') };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
      args: [thread_id, messageText, client_message_id, fb_dtsg, user_id]
    });

    const tabRes = tabSendResult?.[0]?.result;
    if (tabRes && tabRes.success && tabRes.message_id) {
      console.log('[SEND_MESSAGE] ✅ Tab Context GraphQL gửi thành công, message_id:', tabRes.message_id);
      sendToBackend('SEND_MESSAGE_RESULT', { thread_id, client_message_id, success: true, message_id: tabRes.message_id });
    } else {
      const errMsg = tabRes?.error || 'Gửi tin nhắn qua Tab Facebook thất bại';
      console.error('[SEND_MESSAGE] ❌ Gửi tin nhắn thất bại:', errMsg);
      sendToBackend('SEND_MESSAGE_RESULT', { thread_id, client_message_id, success: false, error: errMsg });
    }
  } catch (err) {
    console.error('[SEND_MESSAGE] ❌ Lỗi ngoại lệ Tab Context:', err.message);
    sendToBackend('SEND_MESSAGE_RESULT', { thread_id, client_message_id, success: false, error: err.message });
  }
}

// ── Đồng bộ danh sách threads từ sidebar Facebook ──────────────────────────
// Yêu cầu content.js scrape DOM sidebar của facebook.com/messages
async function handleSync100Threads({ account_id }) {
  console.log('[FB Engine] 🔄 Đang sync threads sidebar cho account:', account_id);

  const tab = await getFacebookTab(account_id);
  if (!tab) {
    console.warn('[FB Engine] Không tìm thấy tab Facebook nào đang mở. Mở facebook.com/messages trước.');
    sendToBackend('SYNC_THREADS_RESULT', { account_id, threads: [] });
    return;
  }

  // Inject scrape script vào tab Facebook
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeFacebookSidebar,
    });

    const threads = results?.[0]?.result || [];
    console.log(`[FB Engine] ✅ Đã scrape được ${threads.length} threads từ sidebar`);

    const processedThreads = await Promise.all(threads.map(async (t) => {
      let avatarBase64 = t.avatar_base64 || null;
      if (!avatarBase64 && t.avatar_url && t.avatar_url.startsWith('http')) {
        try {
          const res = await fetch(t.avatar_url, { credentials: 'include' });
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binary);
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            avatarBase64 = `data:${contentType};base64,${base64}`;
          }
        } catch (e) {}
      }
      return {
        thread_id: t.thread_id,
        contact_name: t.name,
        last_message: t.last_message,
        is_unread: t.is_unread,
        avatar_url: t.avatar_url,
        avatar_base64: avatarBase64,
        thread_url: t.thread_url || null,
        is_e2ee: !!t.is_e2ee
      };
    }));

    sendToBackend('SYNC_THREADS_RESULT', {
      account_id,
      threads: processedThreads
    });
  } catch (err) {
    console.error('[FB Engine] Lỗi executeScript scrape sidebar:', err.message);
    sendToBackend('SYNC_THREADS_RESULT', { account_id, threads: [] });
  }
}

// ── Hàm scrape sidebar Facebook (chạy trong context trang) ──────────────────
// Hàm này được inject vào tab Facebook qua chrome.scripting.executeScript
function scrapeFacebookSidebar() {
  const threads = [];
  const seen = new Set();

  // Tìm các thread item trong sidebar Messenger (bao gồm cả E2EE /messages/e2ee/t/ và chuẩn /messages/t/)
  const links = document.querySelectorAll('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"], a[href*="/messages/"], div[role="row"] a, div[role="listitem"] a');

  for (const link of links) {
    try {
      const href = link.getAttribute('href') || '';
      const threadIdMatch = href.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/) || href.match(/\/messages\/t\/([^\/?#]+)/);
      if (!threadIdMatch) continue;

      const thread_id = decodeURIComponent(threadIdMatch[1]);
      let thread_url = href;
      try {
        thread_url = new URL(href, window.location.origin).toString();
      } catch (e) {}
      if (!thread_id || thread_id === 't' || thread_id === 'e2ee' || thread_id === 'requests' || thread_id === 'archived') continue;
      if (seen.has(thread_id)) continue;
      seen.add(thread_id);

      // Tìm container row ở đúng phạm vi item (role="row", role="listitem" hoặc link)
      const rowContainer = link.closest('div[role="row"], div[role="listitem"]') || link;

      // 2. Trích xuất Tên (Name) thông minh
      const nameEl = rowContainer.querySelector('h2') ||
        rowContainer.querySelector('[dir="auto"]') ||
        link.querySelector('[dir="auto"]') ||
        rowContainer.querySelector('span[style*="font-weight"]') ||
        rowContainer.querySelector('span');

      let rawName = String(rowContainer.innerText || nameEl?.innerText || nameEl?.textContent || '').split(/\n+/)[0].trim();
      rawName = rawName.replace(/(?:Tin nhắn và cuộc gọi|Em chào chị|Bạn và|Các bạn|được bảo mật|hoạt động|vừa xong).*$/i, '').trim();
      rawName = rawName.replace(/\s*\d+\s*(?:ngày|giờ|phút|năm|s|m|h|d|y)\s*$/i, '').trim();
      
      const PRESENCE_EXACT = /^(?:Đang|Đang hoạt động.*|Hoạt động(?:\s+\d+.*)?|Đã hoạt động.*|Active now|Active recently|Active \d+.*|Online|Offline)$/i;
      let name = rawName.substring(0, 60).trim();
      if (PRESENCE_EXACT.test(name) || name === 'Đang') {
        const lines = String(rowContainer.innerText || '').split(/\n+/);
        name = lines.find(l => l.trim() && !PRESENCE_EXACT.test(l.trim()) && l.trim() !== 'Đang' && l.length > 2) || '';
        name = name.substring(0, 60);
      }
      name = name || ('Khách hàng (' + thread_id.substring(0, 8) + ')');

      // 3. Kiểm tra trạng thái unread
      const hasUnreadDot = rowContainer.querySelector('[data-testid="unread-count"]') || rowContainer.querySelector('.unread') || rowContainer.querySelector('[aria-label*="unread"]') || rowContainer.querySelector('[aria-label*="Chưa đọc"]');

      // 4. Lấy đoạn tin nhắn cuối
      const spans = rowContainer.querySelectorAll('span');
      let last_message = '';
      for (const span of spans) {
        const txt = span.textContent.trim();
        if (txt && txt !== name && !txt.includes(name) && txt.length > 2 && txt.length < 200 && !/^\d+\s*(?:ngày|giờ|phút|năm|s|m|h|d|y)$/i.test(txt)) last_message = txt;
      }

      // 5. Lấy Avatar chuẩn phạm vi row (thẻ img, SVG image, background-image)
      let avatar_url = null;
      let avatar_base64 = null;
      const mediaElements = rowContainer.querySelectorAll('img, image, [style*="background-image"]');
      for (const el of mediaElements) {
        let src = el.currentSrc || el.src || el.getAttribute?.('xlink:href') || el.getAttribute?.('href') || '';
        if (!src && el.style?.backgroundImage) {
          const bgMatch = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
          if (bgMatch) src = bgMatch[1];
        }
        if (src && !/^(?:data:|blob:)/i.test(src) && /(?:fbcdn|scontent|facebook\.com|platform\.facebook\.com)/i.test(src)) {
          avatar_url = src;
          // Vẽ trực tiếp ra canvas trong trang DOM nếu img đã load
          if (el.tagName === 'IMG' && el.complete && el.naturalWidth > 10) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = el.naturalWidth || 56;
              canvas.height = el.naturalHeight || 56;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(el, 0, 0);
              avatar_base64 = canvas.toDataURL('image/jpeg', 0.85);
            } catch (e) {}
          }
          break;
        }
      }

      threads.push({
        thread_id,
        name,
        last_message,
        is_unread: !!hasUnreadDot,
        avatar_url,
        avatar_base64,
        thread_url,
        is_e2ee: /\/messages\/e2ee\/t\//.test(thread_url)
      });

      if (threads.length >= 100) break;
    } catch (e) {
      // Skip lỗi từng item
    }
  }

  return threads;
}

// ── Điều hướng/xác thực tab Facebook trước khi scrape lịch sử ──────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractThreadIdFromMessengerUrl(url) {
  const match = String(url || '').match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function normalizeMessengerUrl(url) {
  if (!url) return null;
  try {
    return new URL(url, 'https://www.facebook.com').toString();
  } catch (e) {
    return null;
  }
}

async function getCurrentThreadIdInTab(tabId) {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const match = location.href.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
        return match ? decodeURIComponent(match[1]) : null;
      }
    });
    return res?.[0]?.result || null;
  } catch (e) {
    return null;
  }
}

async function findThreadUrlInTab(tabId, targetThreadId) {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: (targetId) => {
        const links = Array.from(document.querySelectorAll('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"]'));
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
          if (match && decodeURIComponent(match[1]) === String(targetId)) {
            return new URL(href, location.origin).toString();
          }
        }
        return null;
      },
      args: [String(targetThreadId)]
    });
    return res?.[0]?.result || null;
  } catch (e) {
    return null;
  }
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise(resolve => {
    let done = false;
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !done) {
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    };
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }
    }, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureTabOnThread(tab, targetThreadId, requestedThreadUrl) {
  const targetId = String(targetThreadId);
  const currentFromUrl = extractThreadIdFromMessengerUrl(tab.url);
  const currentFromPage = currentFromUrl || await getCurrentThreadIdInTab(tab.id);
  if (String(currentFromPage) === targetId) return true;

  const discoveredThreadUrl = await findThreadUrlInTab(tab.id, targetId);
  const candidates = [
    requestedThreadUrl,
    discoveredThreadUrl,
    `https://www.facebook.com/messages/t/${encodeURIComponent(targetId)}`,
    `https://www.facebook.com/messages/e2ee/t/${encodeURIComponent(targetId)}`
  ].map(normalizeMessengerUrl).filter(Boolean);

  const seenUrls = new Set();
  for (const url of candidates) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    try {
      const loadPromise = waitForTabComplete(tab.id, 8000);
      await chrome.tabs.update(tab.id, { url });
      await Promise.race([loadPromise, delay(4500)]);
      await delay(1200);
      const currentId = await getCurrentThreadIdInTab(tab.id);
      if (String(currentId) === targetId) return true;
    } catch (e) {
      console.warn('[FB Engine] Không thể chuyển tab sang thread:', targetId, e.message);
    }
  }

  return false;
}

// ── Đồng bộ lịch sử tin nhắn của 1 hội thoại cụ thể ────────────────────────
async function handleSyncThreadMessages({ account_id, thread_id, thread_url, mode = 'initial', cursor = null }) {
  console.log(`[FB Engine] 🔄 Sync lịch sử tin nhắn cho thread: ${thread_id} (account=${account_id || user_id}) mode=${mode}`);
  if (!thread_id) return;

  const targetAcc = account_id || user_id;
  const tab = await getFacebookTab(targetAcc);
  if (!tab) {
    console.warn('[FB Engine] Không có tab Facebook tương ứng để sync thread messages.');
    sendToBackend('THREAD_MESSAGES_SYNCED', { account_id: targetAcc, thread_id, messages: [], mode, cursor });
    return;
  }

  const onTargetThread = await ensureTabOnThread(tab, thread_id, thread_url);
  const currentTabThreadId = await getCurrentThreadIdInTab(tab.id);
  const updatedTab = await chrome.tabs.get(tab.id).catch(() => tab);

  console.log(`[DOM Sync Verification] requested thread: ${thread_id} | current Facebook URL: ${updatedTab?.url || tab.url} | current thread id: ${currentTabThreadId}`);

  if (!onTargetThread || (currentTabThreadId && String(currentTabThreadId) !== String(thread_id))) {
    console.warn(`[DOM Sync Verification] ⚠️ Tab Facebook đang mở thread ${currentTabThreadId || 'khác'}, không khớp thread ${thread_id}. Result count: 0. Hủy sync để tránh ghi nhầm DB.`);
    sendToBackend('THREAD_MESSAGES_SYNCED', {
      account_id: targetAcc,
      thread_id,
      messages: [],
      reason: 'url_mismatch',
      mode,
      cursor
    });
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (targetThreadId, mode, cursor) => {
        // 1. Helper chờ DOM Ready
        async function waitForThreadDomReady(targetThreadId, timeoutMs = 8000) {
          const startTime = Date.now();
          let lastReason = 'timeout';
          
          while (Date.now() - startTime < timeoutMs) {
            // Kiểm tra URL hiện tại
            const currentThreadMatch = location.href.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
            const currentThreadId = currentThreadMatch ? decodeURIComponent(currentThreadMatch[1]) : null;
            if (String(currentThreadId) !== String(targetThreadId)) {
              lastReason = 'url_mismatch';
              await new Promise(r => setTimeout(r, 400));
              continue;
            }

            // Kiểm tra sidebar active nếu có
            const activeSidebarItem = document.querySelector('a[aria-current="page"][href*="/messages/"], a[aria-current="true"][href*="/messages/"]');
            if (activeSidebarItem) {
              const activeUrl = activeSidebarItem.getAttribute('href') || '';
              const activeMatch = activeUrl.match(/\/messages\/(?:e2ee\/)?t\/([^\/?#]+)/);
              const activeId = activeMatch ? decodeURIComponent(activeMatch[1]) : null;
              if (activeId && String(activeId) !== String(targetThreadId)) {
                lastReason = 'sidebar_mismatch';
                await new Promise(r => setTimeout(r, 400));
                continue;
              }
            }

            // Kiểm tra error screen
            const errorNodes = document.querySelectorAll('span[dir="auto"], div[dir="auto"]');
            let isErrorScreen = false;
            for (const node of errorNodes) {
              const txt = node.textContent || '';
              if (txt.includes('Nội dung này hiện không hiển thị') || txt.includes('This content isn\'t available') || txt.includes('hiện không có mặt') || txt.includes('unavailable')) {
                isErrorScreen = true;
                break;
              }
            }
            if (isErrorScreen) return { ok: false, reason: 'error_screen' };

            // Kiểm tra message rows trong main
            const mainContainer = document.querySelector('div[role="main"]');
            if (!mainContainer) {
              lastReason = 'no_main_container';
              await new Promise(r => setTimeout(r, 400));
              continue;
            }
            
            const existingRows = mainContainer.querySelectorAll('div[role="row"], div[data-scope="messages_table"] div[dir="auto"]');
            if (existingRows.length === 0) {
              lastReason = 'no_rows';
              await new Promise(r => setTimeout(r, 400));
              continue;
            }

            // Kiểm tra marker crmThreadId từ content.js
            let markerMismatch = false;
            for (const row of existingRows) {
              const taggedId = row.dataset.crmThreadId;
              if (taggedId && String(taggedId) !== String(targetThreadId)) {
                markerMismatch = true;
                break;
              }
            }
            if (markerMismatch) {
              lastReason = 'marker_mismatch';
              await new Promise(r => setTimeout(r, 400));
              continue;
            }

            return { ok: true, mainContainer };
          }
          return { ok: false, reason: lastReason };
        }

        const domReadyStatus = await waitForThreadDomReady(targetThreadId);
        if (!domReadyStatus.ok) {
          return { _reason: domReadyStatus.reason };
        }
        
        const mainContainer = domReadyStatus.mainContainer;

        // 2. Helper scroll lazy load nhiều vòng
        let boundaryReached = false;
        const boundaryId = mode === 'incremental' ? cursor?.newest_message_id : null;
        async function loadOlderMessages(container, modeStr) {
          let maxRounds = 5;
          if (modeStr === 'incremental') maxRounds = 1;
          if (modeStr === 'backfill') maxRounds = 10;
          
          let prevScrollHeight = 0;
          let roundsWithoutIncrease = 0;
          for (let i = 0; i < maxRounds; i++) {
            const rowsForBoundary = Array.from(container.querySelectorAll('div[role="row"], div[data-scope="messages_table"] div[dir="auto"]'));
            if (boundaryId && rowsForBoundary.some(row => {
              const el = row.querySelector('[data-id], [id^="mid."]') || row;
              return el.getAttribute('data-id') === boundaryId || el.getAttribute('id') === boundaryId;
            })) {
              boundaryReached = true;
              console.log(`[FB LazyLoad] Đã gặp boundary ${boundaryId}; dừng crawl ${modeStr}.`);
              break;
            }
            const currentCount = rowsForBoundary.length;
            const scrollContainer = container.querySelector('div[aria-label*="Messages"], div[aria-label*="Đoạn chat"]') || container;
            const currentScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;
            const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

            console.log(`[FB LazyLoad] Vòng ${i + 1}/${maxRounds} - Rows: ${currentCount} | ScrollHeight: ${currentScrollHeight} | ScrollTop: ${currentScrollTop}`);

            if (currentScrollHeight > prevScrollHeight) {
              roundsWithoutIncrease = 0;
              prevScrollHeight = currentScrollHeight;
            } else if (i > 0) {
              roundsWithoutIncrease++;
            } else {
              prevScrollHeight = currentScrollHeight;
            }
            
            if (roundsWithoutIncrease >= 2) {
              console.log('[FB LazyLoad] Không phát hiện chiều cao scroll tăng sau 2 vòng liên tiếp. Dừng.');
              break;
            }
            
            const spinner = container.querySelector('svg[aria-label="Loading"], div[role="progressbar"]');
            if (spinner) {
              await new Promise(r => setTimeout(r, 1000));
            } else {
              if (scrollContainer) {
                scrollContainer.scrollTop = 0;
              }
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        await loadOlderMessages(mainContainer, mode);

        // Kiểm tra marker lại lần cuối xem có lạc thread không
        const finalRows = mainContainer.querySelectorAll('div[role="row"], div[data-scope="messages_table"] div[dir="auto"]');
        for (const row of finalRows) {
          const taggedId = row.dataset.crmThreadId;
          if (taggedId && String(taggedId) !== String(targetThreadId)) {
            return { _reason: 'marker_mismatch' };
          }
        }

        // Inline text filter helpers
        const SYSTEM_PATTERNS = [
          /Tin nhắn và cuộc gọi (?:đang )?được bảo mật/i,
          /bảo mật bằng tính năng mã hóa/i,
          /bảo mật đầu cuối/i,
          /^Tìm hiểu thêm$/i,
          /^Xem thêm$/i,
          /^Quyền riêng tư/i,
          /^Cookie$/i,
          /^Facebook$/i,
          /^Messenger$/i,
          /^Meta$/i,
          /^Trang chủ$/i,
          /^Khôi phục ngay$/i,
          /^Thiếu lịch sử chat/i,
          /^Bạn đã tạo nhóm này/i,
          /^Chỉ những người tham gia/i,
          /^Bản quyền Meta/i,
          /^(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen)$/i,
/^(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen)\s+\d+\s+(?:giây|phút|giờ|ngày|tuần|tháng|năm)\s+(?:trước|ago)$/i,
          /^(?:Đang hoạt động.*|Hoạt động(?:\s+\d+.*)?|Đã hoạt động.*|Active now|Active recently|Active \d+.*|Online|Offline)$/i,
          /^(?:Typing[.…]*|Đang nhập[.…]*|Đang gửi[.…]*|Sending[.…]*)$/i,
          /^(?:Đang tải|Loading)[.…]*$/i,
          /^(?:Tin nhắn do|Message sent by) .+?(?:gửi lúc|at) .+?:\s*.*$/i,
          /^Nhấn Enter để gửi$/i,
          /^\d{1,2}:\d{2}(?:\s*(?:T[2-7]|CN|AM|PM))?$/i,
          /^(?:T[2-7]|CN)$/i
        ];

        function isSystemText(txt) {
          if (!txt || !txt.trim()) return true;
          const t = txt.trim();
          for (const pat of SYSTEM_PATTERNS) {
            if (pat.test(t)) return true;
          }
          return false;
        }

        function cleanText(raw) {
          if (!raw) return '';
          let t = raw.trim();
          if (!t) return '';
          t = t.replace(/^(?:Nhập,\s*)?Tin nhắn do [^\n]+? gửi lúc [^\n]*:\s*/i, '').trim();
          t = t.replace(/^(?:Nhập,\s*)?Message sent by [^\n]+? at [^\n]*:\s*/i, '').trim();
          t = t.replace(/^Nhập,\s*/i, '').trim();
          t = t.replace(/^[:\s]+/, '').trim();
          const sentEmojiMatch = t.match(/^[^,\n]{1,80}\s+(?:đã gửi|sent),\s*(.+)$/i);
          if (sentEmojiMatch) {
            const payload = sentEmojiMatch[1].trim();
            if (payload && !/[A-Za-zÀ-ỹ0-9]/.test(payload)) t = payload;
          }
          t = t.replace(/(?:\n|\r|\s{2,})(?:Đã gửi|Đã nhận|Đã xem|Sent|Delivered|Seen|Nhấn Enter để gửi)\s*$/i, '').trim();
          t = t.replace(/^\d{1,2}:\d{2}\s*(?:T[2-7]|CN|AM|PM)?\s*$/i, '').replace(/(?:\n|\r)\s*\d{1,2}:\d{2}\s*(?:T[2-7]|CN|AM|PM)?$/i, '').trim();
          t = t.replace(/^[:\s]+/, '').trim();
          if (!t || isSystemText(t)) return '';
          return t;
        }

        function stringHash(str) {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
          }
          return (hash >>> 0).toString(36);
        }

        function parseTimeFromLabel(label, fallbackDate) {
          if (!label) return null;
          const timeMatch = label.match(/\b(\d{1,2}):(\d{2})(?:\s*(AM|PM|SA|CH|SÁNG|CHIỀU|TỐI))?/i);
          if (!timeMatch) return null;
          
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3]?.toUpperCase();
          if (ampm === 'PM' || ampm === 'CH' || ampm === 'CHIỀU' || ampm === 'TỐI') {
            if (hours < 12) hours += 12;
          } else if (ampm === 'AM' || ampm === 'SA' || ampm === 'SÁNG') {
            if (hours === 12) hours = 0;
          }
          
          const now = new Date();
          now.setHours(hours, minutes, 0, 0);

          // Phát hiện ngày trong label (Hôm qua, Thứ Hai, 31 tháng 7, 2026...)
          const lowerLabel = label.toLowerCase();
          const yesterdayMatch = lowerLabel.match(/hôm qua|yesterday/);
          const dateMatch = lowerLabel.match(/(\d{1,2})\s*tháng\s*(\d{1,2})(?:,?\s*(\d{4}))?/i);
          const weekdayMatch = lowerLabel.match(/(thứ hai|thứ ba|thứ tư|thứ năm|thứ sáu|thứ bảy|chủ nhật|t2|t3|t4|t5|t6|t7|cn)/i);

          if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
            now.setFullYear(year, month, day);
          } else if (yesterdayMatch) {
            now.setDate(now.getDate() - 1);
          } else if (weekdayMatch) {
            // Tính ngược về thứ gần nhất
            const daysMap = {
              'chủ nhật': 0, 'cn': 0,
              'thứ hai': 1, 't2': 1,
              'thứ ba': 2, 't3': 2,
              'thứ tư': 3, 't4': 3,
              'thứ năm': 4, 't5': 4,
              'thứ sáu': 5, 't6': 5,
              'thứ bảy': 6, 't7': 6
            };
            const targetDay = daysMap[weekdayMatch[1].toLowerCase()];
            const currentDay = now.getDay();
            let diff = currentDay - targetDay;
            if (diff <= 0) diff += 7; // Trừ lùi về tuần trước
            now.setDate(now.getDate() - diff);
          } else if (fallbackDate) {
            // Dùng ngày của fallbackDate nhưng đè giờ phút mới (vì label chỉ có giờ phút của ngày hôm nay)
            const fallback = new Date(fallbackDate);
            now.setFullYear(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
          }
          
          if (now.getTime() > Date.now() + 60000) {
            now.setDate(now.getDate() - 1);
          }
          return now.getTime();
        }

        const messages = [];
        const boundaryIds = new Set([cursor?.newest_message_id, cursor?.oldest_message_id].filter(Boolean));
        const occurrencesMap = {};
        const seenBubblesInPass = new Set();

        // ── Composer/UI exclusion (tuyệt đối không lấy text từ vùng soạn tin/header/nav) ──
        const COMPOSER_EXCLUDE = 'form, [contenteditable="true"], [role="textbox"], [aria-label="Aa"], [aria-label="Tin nhắn"], [aria-label*="composer"], [aria-label*="Soạn"], [role="contentinfo"], header, nav';

        // ── Chiến lược: Chỉ lấy tin từ message row đã xác minh ──
        const allRows = Array.from(mainContainer.querySelectorAll('div[role="row"]'));
        
        let dom_order = 0;
        let lastFallbackTime = Date.now();

        allRows.forEach((row, idx) => {
          if (row.closest(COMPOSER_EXCLUDE)) return;

          const rowAriaLabel = row.getAttribute('aria-label') || '';
          const childMsgEl = !rowAriaLabel ? row.querySelector('[aria-label*="Tin nhắn do"], [aria-label*="Message sent"]') : null;
          const effectiveLabel = rowAriaLabel || (childMsgEl?.getAttribute('aria-label') || '');

          const hasMessageLabel = /Tin nhắn do .+ gửi lúc|Message sent by/i.test(effectiveLabel);
          const nativeIdEl = row.querySelector('[data-id], [id^="mid."]');
          const hasNativeId = !!nativeIdEl;

          if (!hasMessageLabel && !hasNativeId) return; 

          const bubblesInRow = Array.from(row.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
          const leafBubbles = bubblesInRow.filter(b => {
            if (b.closest(COMPOSER_EXCLUDE)) return false;
            return !b.querySelector('div[dir="auto"], span[dir="auto"]');
          });

          if (leafBubbles.length === 0) return;

          let tsMs = parseTimeFromLabel(effectiveLabel, lastFallbackTime);
          let tsSource = tsMs ? 'facebook_label' : 'fallback';
          
          if (tsMs) {
            lastFallbackTime = tsMs;
          } else {
            tsMs = lastFallbackTime;
          }

          let bubble_idx = 0;
          for (const leafBubble of leafBubbles) {
            if (seenBubblesInPass.has(leafBubble)) continue;
            seenBubblesInPass.add(leafBubble);

            const rawBubbleText = (leafBubble.textContent || '').trim();
            if (!rawBubbleText) { bubble_idx++; continue; }

            let isOutgoing = false;
            let senderName = '';
            if (/do Bạn gửi|Tin nhắn do Bạn gửi lúc|Bạn đã gửi|sent by you|You sent|Message sent by you/i.test(effectiveLabel)) {
              isOutgoing = true;
              senderName = 'Bạn';
            } else {
              const nameMatch = effectiveLabel.match(/Tin nhắn do ([^]+?) gửi lúc/i) || effectiveLabel.match(/Message sent by ([^]+?) at/i);
              if (nameMatch) {
                const rawSender = nameMatch[1].trim();
                if (/^(?:Bạn|You)$/i.test(rawSender)) {
                  isOutgoing = true;
                  senderName = 'Bạn';
                } else {
                  isOutgoing = false;
                  senderName = rawSender;
                }
              }
            }

            const cleaned = cleanText(rawBubbleText);
            if (!cleaned || cleaned.length < 1 || cleaned.length > 1000 || isSystemText(cleaned)) { bubble_idx++; continue; }

            const nativeId = nativeIdEl?.getAttribute('data-id') || nativeIdEl?.getAttribute('id') || row.getAttribute('data-id') || null;

            const dirKey = isOutgoing ? 'out' : 'in';
            const textHash = stringHash(cleaned);
            const comboKey = `${targetThreadId}_${dirKey}_${textHash}`;
            occurrencesMap[comboKey] = (occurrencesMap[comboKey] || 0) + 1;
            const occIndex = occurrencesMap[comboKey];

            const identityKey = `${targetThreadId}|${dirKey}|${textHash}|${tsMs}`;
            const deterministicId = nativeId || `fb_sync_${stringHash(identityKey)}_${occIndex}`;

            if (!messages.some(m => m.fb_message_id === deterministicId)) {
              // Create a microsecond offset based on dom_order to preserve sorting for identical timestamps
              const finalTsMs = tsMs + dom_order;
              
              messages.push({
                fb_message_id: deterministicId,
                thread_id: currentThreadId,
                sender_id: isOutgoing ? 'current_user' : null,
                sender_name: senderName,
                content: cleaned,
                is_outgoing: isOutgoing ? 1 : 0,
                source: 'dom_history_sync',
                timestamp_ms: finalTsMs,
                timestamp_source: tsSource,
                created_at: new Date(finalTsMs).toISOString()
              });
            }
            bubble_idx++;
            dom_order++;
          }
        });

        const filteredMessages = messages.filter(m => !boundaryIds.has(m.fb_message_id));
        return { messages: filteredMessages, skipped_count: messages.length - filteredMessages.length, boundary_reached: boundaryReached };
      },
      args: [thread_id, mode, cursor]
    });

    const parsedResult = results?.[0]?.result;
    const parsedMessages = Array.isArray(parsedResult) ? parsedResult : (parsedResult?.messages || []);
    const parserSkipped = Array.isArray(parsedResult) ? 0 : (parsedResult?.skipped_count || 0);
    
    if (parsedResult && parsedResult._reason) {
      console.warn(`[FB Engine] ⚠️ DOM chưa sẵn sàng. Hủy sync. Lý do: ${parsedResult._reason}`);
      sendToBackend('THREAD_MESSAGES_SYNCED', {
        account_id: targetAcc,
        thread_id,
        messages: [],
        reason: parsedResult._reason,
        mode,
        cursor
      });
      return;
    }

    const messagesArray = Array.isArray(parsedMessages) ? parsedMessages : [];
    console.log(`[FB Engine] ✅ Synced ${messagesArray.length} new history messages for thread ${thread_id}; skipped=${parserSkipped}`);

    // Update cursor using timestamp extrema, not DOM array order.
    let newCursor = { ...(cursor || {}) };
    newCursor.mode = mode;
    if (messagesArray.length > 0) {
      const ordered = [...messagesArray].sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0));
      newCursor.oldest_timestamp_ms = ordered[0].timestamp_ms;
      newCursor.oldest_message_id = ordered[0].fb_message_id;
      newCursor.newest_timestamp_ms = ordered[ordered.length - 1].timestamp_ms;
      newCursor.newest_message_id = ordered[ordered.length - 1].fb_message_id;
    }
    
    sendToBackend('THREAD_MESSAGES_SYNCED', {
      account_id: targetAcc,
      thread_id,
      messages: messagesArray,
      mode,
      checkpoint: newCursor,
      fetched_count: messagesArray.length + parserSkipped,
      skipped_count: parserSkipped
    });
  } catch (err) {
    console.error('[FB Engine] Lỗi sync thread messages:', err.message);
    sendToBackend('THREAD_MESSAGES_SYNCED', { account_id: targetAcc, thread_id, messages: [], reason: 'timeout' });
  }
}

// Khởi chạy kết nối WS khi service worker load
connectWebSocket();

