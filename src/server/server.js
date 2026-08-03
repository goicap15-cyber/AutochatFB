const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { Server: SocketIOServer } = require('socket.io');
const db = require('./database/db');
const processManager = require('./services/ProcessManager');
const mediaDownloader = require('./services/MediaDownloader');
const assignmentManager = require('./services/AssignmentManager');
const searchService = require('./services/SearchService');
const exportService = require('./services/ExportService');
const autoReplyEngine = require('./services/AutoReplyEngine');
const broadcastEngine = require('./services/BroadcastEngine');
const aiMediator = require('./services/AIMediator');
const { extractLeadInfo } = require('./utils/leadExtractor');
const { downloadAvatar, saveAvatarFromBase64OrUrl, serveAvatar } = require('./utils/avatarManager');
const { isSystemOrMetadataText, cleanMessageText } = require('./utils/textFilter');
const ConversationRepository = require('./repositories/ConversationRepository');

const app = express();
app.use(express.json());

// Static: React Dashboard UI & Media files
app.use(express.static(path.join(__dirname, '../../../dist/client'), { 
  setHeaders: (res, path) => {
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
  } 
}));
const clientDistPath = path.join(__dirname, '../../dist/client');
app.use(express.static(clientDistPath));
app.use('/data/media', express.static(path.join(__dirname, '../../data/media')));
app.use('/data/exports', express.static(path.join(__dirname, '../../data/exports')));

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
const wss = new WebSocket.Server({ noServer: true });
const extensionConnections = new Map();

// Router HTTP Upgrade: phân định Socket.io vs Chrome Extension WebSocket
// Extension kết nối tại: ws://127.0.0.1:5050/extension
// Socket.IO kết nối tại: ws://localhost:5050/socket.io/...
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname.startsWith('/socket.io')) {
    // Socket.io tự xử lý upgrade của mình
    return;
  }

  // Chấp nhận /extension (Chrome Extension) hoặc / (legacy)
  if (pathname === '/extension' || pathname === '/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Từ chối các path không xác định
    socket.destroy();
  }
});

// ── Helper: gửi tin nhắn qua Extension WebSocket ──────────────────────────
async function sendViaExtension(thread_id, text, client_message_id = null) {
  // Tìm account_id của thread
  const thread = db.prepare('SELECT account_id FROM threads WHERE id = ?').get(thread_id);
  if (!thread) throw new Error(`Thread ${thread_id} không tồn tại`);

  const extWs = extensionConnections.get(thread.account_id);
  if (!extWs || extWs.readyState !== WebSocket.OPEN) {
    throw new Error(`Extension cho tài khoản ${thread.account_id} không kết nối`);
  }

  const clientMsgId = client_message_id || `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const pendingFbId = `pending_${clientMsgId}`;

  extWs.send(JSON.stringify({ type: 'SEND_MESSAGE', data: { thread_id, content: text, client_message_id: clientMsgId } }));

  // Lưu tin nhắn outgoing dạng pending vào CSDL
  const result = db.prepare(`
    INSERT INTO messages (thread_id, fb_message_id, client_message_id, sender_id, content, is_outgoing)
    VALUES (?, ?, ?, 'SYSTEM', ?, 1)
  `).run(thread_id, pendingFbId, clientMsgId, text);

  db.prepare(`
    UPDATE threads SET last_message = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?
  `).run(text, thread_id);

  io.emit('NEW_MESSAGE', {
    id: result.lastInsertRowid,
    thread_id,
    content: text,
    is_outgoing: true,
    created_at: new Date().toISOString(),
    client_message_id: clientMsgId
  });
}

// ────────────────────────────────────────────────
// Extension WebSocket Handler
// ────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log('[WS] Extension connected from:', req.socket.remoteAddress);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log('[WS] 📨 Nhận message:', msg.type, '| WS ID:', req.socket.remoteAddress);

      switch (msg.type) {
        case 'REGISTER_ACCOUNT': {
          const { account_id, name, pending_key } = msg.data;
          extensionConnections.set(account_id, ws);
          ws.accountId = account_id;

          let profileDir = `data/profiles/${account_id}`;
          if (pending_key) {
            profileDir = `data/profiles/${pending_key}`;
            if (processManager.processes.has(pending_key)) {
              const procData = processManager.processes.get(pending_key);
              processManager.processes.set(account_id, procData);
            }
          }

          const accName = name || `FB Account (${account_id})`;

          db.prepare(`
            INSERT INTO accounts (id, name, profile_dir, status)
            VALUES (?, ?, ?, 'ACTIVE')
            ON CONFLICT(id) DO UPDATE SET
              name = COALESCE(excluded.name, accounts.name),
              profile_dir = COALESCE(excluded.profile_dir, accounts.profile_dir),
              status = 'ACTIVE',
              last_broadcast_date = DATE('now')
          `).run(account_id, accName, profileDir);

          console.log(`[WS] REGISTER_ACCOUNT thành công: account_id=${account_id}, profile_dir=${profileDir}`);
          io.emit('ACCOUNT_STATUS_CHANGED', { account_id, status: 'ACTIVE' });
          io.emit('EXTENSION_CONNECTION_CHANGED', { account_id, is_connected: true });

          // Gửi ACK về Extension xác nhận đăng ký thành công
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'REGISTER_ACCOUNT_ACK',
              data: { account_id, status: 'SUCCESS', pending_key }
            }));
          }

          // Trigger đồng bộ threads ngay sau khi extension đăng ký
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'SYNC_THREADS', data: { account_id } }));
              console.log(`[WS] Gửi SYNC_THREADS đến extension tài khoản: ${account_id}`);
            }
          }, 1500);
          break;
        }

        case 'SEND_MESSAGE_RESULT': {
          const { thread_id, client_message_id, success, error, message_id, result: fbRes } = msg.data;
          const officialFbId = message_id || fbRes?.o0?.data?.message?.message_id || fbRes?.o0?.data?.message_id || fbRes?.data?.message_id;
          
          console.log(`[WS] SEND_MESSAGE_RESULT: thread=${thread_id} client_msg_id=${client_message_id} success=${success} fb_msg_id=${officialFbId}`);
          
          if (success && officialFbId) {
            db.prepare(`
              UPDATE messages 
              SET fb_message_id = ? 
              WHERE client_message_id = ? OR fb_message_id = ?
            `).run(officialFbId, client_message_id, `pending_${client_message_id}`);

            io.emit('MESSAGE_SENT', { thread_id, client_message_id, success: true, fb_message_id: officialFbId });
          } else {
            console.error('[WS] ❌ SEND_MESSAGE_RESULT failed or missing fb_msg_id:', {
              thread_id,
              client_message_id,
              success,
              error,
              fbRes: JSON.stringify(fbRes)?.substring(0, 500)
            });

            // Nếu gửi thất bại hoặc không có message_id chính thức từ Facebook, dọn dẹp bản ghi pending
            db.prepare(`
              DELETE FROM messages 
              WHERE (client_message_id = ? OR fb_message_id = ?) AND is_outgoing = 1
            `).run(client_message_id, `pending_${client_message_id}`);

            const lastValid = db.prepare(`
              SELECT content FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1
            `).get(thread_id);

            db.prepare(`
              UPDATE threads SET last_message = ? WHERE id = ?
            `).run(lastValid?.content || 'Chưa có tin nhắn', thread_id);

            io.emit('MESSAGE_SEND_FAILED', { thread_id, client_message_id, success: false, error: error || 'Facebook không xác nhận message_id' });
          }
          break;
        }

        case 'CHECKPOINT_DETECTED': {
          const { account_id } = msg.data;
          db.prepare("UPDATE accounts SET status='CHECKPOINT' WHERE id=?").run(account_id);
          processManager.unhideWindow(account_id);
          io.emit('ACCOUNT_STATUS_CHANGED', { account_id, status: 'CHECKPOINT' });
          break;
        }

        case 'NEW_MESSAGE_RECEIVED': {
          const m = msg.data;
          const threadId = String(m.thread_id || '');
          console.log(`[WS] 📩 Nhận NEW_MESSAGE_RECEIVED | Source: ${m.source || 'unknown'} | Thread: ${threadId} | FB Message ID: ${m.fb_message_id} | Content: "${(m.content || '').substring(0, 80)}"`);
          if (!threadId || threadId === 'unknown_dom' || !/^\d+$/.test(threadId)) {
            console.warn(`[WS] ⚠️ Bỏ qua tin nhắn từ Thread ID không hợp lệ: "${threadId}"`);
            break;
          }

          // Lọc tin nhắn hệ thống, accessibility text & timestamps bằng textFilter
          const cleanedContent = cleanMessageText(m.content);
          if (!cleanedContent || isSystemOrMetadataText(cleanedContent)) {
            console.log(`[WS] ℹ️ Backend Guard: Bỏ qua tin nhắn rác/hệ thống: "${(m.content || '').substring(0, 40)}" từ thread ${threadId}`);
            break;
          }

          // Nếu raw content chứa chuỗi quá lớn (scrap rộng), reject ở backend
          if ((m.content || '').split('\n').length > 8 && isSystemOrMetadataText(m.content)) {
            console.log(`[WS] ℹ️ Backend Guard: Bỏ qua cụm text scrap rộng từ thread ${threadId}`);
            break;
          }

          m.content = cleanedContent;

          // 3. Fix backend fallback is_outgoing
          let finalIsOutgoing = 0;
          const targetAccountId = m.account_id || ws.accountId || null;
          let threadAccountId = targetAccountId;

          // Lấy account_id của thread nếu có
          const existingThreadForAcct = db.prepare('SELECT account_id FROM threads WHERE id=?').get(threadId);
          if (existingThreadForAcct && existingThreadForAcct.account_id) {
            threadAccountId = existingThreadForAcct.account_id;
          }

          if (m.is_outgoing === true || m.is_outgoing === 1) {
            finalIsOutgoing = 1;
          } else if (m.sender_name === 'Bạn') {
            finalIsOutgoing = 1;
          } else if (m.sender_id && targetAccountId && String(m.sender_id) === String(targetAccountId)) {
            finalIsOutgoing = 1;
          } else if (m.sender_id && threadAccountId && String(m.sender_id) === String(threadAccountId)) {
            finalIsOutgoing = 1;
          }

          // 2. Bổ sung log backend
          console.log(`[WS] 🔍 Debug Outgoing | Thread: ${threadId} | Source: ${m.source} | account_id: ${targetAccountId} | thread_account_id: ${threadAccountId} | sender_id: ${m.sender_id} | sender_name: ${m.sender_name} | raw is_outgoing: ${m.is_outgoing} | final is_outgoing: ${finalIsOutgoing}`);

          const isOutgoing = finalIsOutgoing;

          // Tải media về local nếu tin mới có đính kèm
          if (m.media_url && m.media_type && m.media_type !== 'text') {
            const localPath = await mediaDownloader.downloadNewMessageMedia(m.thread_id, m.media_url, m.media_type);
            if (localPath) m.local_media_path = localPath;
          }

          // FIX FOREIGN KEY: Đảm bảo thread tồn tại/được upsert TRƯỚC KHI insert message
          ConversationRepository.upsertThread({
            id: m.thread_id,
            account_id: targetAccountId,
            contact_name: m.contact_name || 'Khách hàng',
            last_message: m.content,
            is_unread: true
          });

          const tsMs = m.timestamp_ms || 0;
          const tsSource = m.timestamp_source || 'unknown';
          const createdAt = (m.created_at && !isNaN(Date.parse(m.created_at))) ? m.created_at : new Date().toISOString();

          const safeSenderId = m.sender_id || (isOutgoing ? String(targetAccountId) : 'CONTACT');
          // Lưu tin nhắn vào bảng messages
          const stableMessageId = m.fb_message_id || m.client_message_id || ConversationRepository.fingerprint(m.thread_id, m);
          const insertMsgResult = db.prepare(`
            INSERT OR IGNORE INTO messages
              (thread_id, fb_message_id, sender_id, content, media_type, media_url, local_media_path, is_outgoing, timestamp_ms, timestamp_source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(m.thread_id, stableMessageId, safeSenderId, m.content,
            m.media_type || 'text', m.media_url, m.local_media_path, isOutgoing, tsMs, tsSource, createdAt);

          let wasNewMessage = insertMsgResult.changes > 0;

          if (!wasNewMessage) {
            // Tin đã tồn tại, kiểm tra rank timestamp để quyết định có upgrade không
            const existingMsg = db.prepare(`SELECT timestamp_source FROM messages WHERE fb_message_id = ?`).get(stableMessageId);
            if (existingMsg) {
              const ranks = {
                'facebook_payload': 6,
                'facebook_label': 5,
                'facebook_dom': 4,
                'realtime_fallback': 3,
                'fallback': 2,
                'unknown': 1
              };
              const oldRank = ranks[existingMsg.timestamp_source] || 1;
              const newRank = ranks[tsSource] || 1;

              if (newRank > oldRank) {
                console.log(`[WS] ⏳ Nâng cấp Timestamp Rank cho fb_message_id ${m.fb_message_id}: ${existingMsg.timestamp_source} -> ${tsSource}`);
                db.prepare(`
                  UPDATE messages
                  SET timestamp_ms = ?, timestamp_source = ?, created_at = ?
                  WHERE fb_message_id = ?
                `).run(tsMs, tsSource, createdAt, stableMessageId);
                // Không break ở đây vì vẫn muốn emit để update lại UI (nếu cần), nhưng wasNewMessage vẫn false (không bắn auto-reply)
              } else {
                console.log(`[WS] Bỏ qua tin nhắn đã tồn tại (fb_message_id: ${m.fb_message_id})`);
                break;
              }
            } else {
              break; // Duplicate vì client_message_id hoặc lý do khác
            }
          }

          if (!wasNewMessage) break; // Nếu chỉ là nâng cấp giờ thì dừng xử lý AutoReply và bump Thread
          ConversationRepository.touchThread(m.thread_id, m.content);

          // Auto Lead Extraction
          if (m.content && !isOutgoing) {
            const { phones, emails } = extractLeadInfo(m.content);
            let localAvatarPath = null;
            const avatarData = m.avatar_base64 || m.avatar_url || m.contact_avatar || '';
            if (avatarData) {
              try {
                localAvatarPath = await saveAvatarFromBase64OrUrl(avatarData, m.thread_id);
                if (localAvatarPath) {
                  db.prepare('UPDATE contacts SET avatar_url = ? WHERE thread_id = ?').run(localAvatarPath, m.thread_id);
                  io.emit('CONTACT_UPDATED', { thread_id: m.thread_id, avatar_url: localAvatarPath });
                }
              } catch (err) {
                console.warn('[WS] Avatar save failed:', err.message);
              }
            }

            if (phones.length > 0 || emails.length > 0) {
              db.prepare(`
                INSERT INTO contacts (thread_id, name, phone, email, avatar_url)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET
                  phone = COALESCE(NULLIF(excluded.phone,''), contacts.phone),
                  email = COALESCE(NULLIF(excluded.email,''), contacts.email),
                  avatar_url = COALESCE(excluded.avatar_url, contacts.avatar_url)
              `).run(m.thread_id, m.contact_name || 'Khách hàng', phones[0] || null, emails[0] || null, localAvatarPath || null);
              io.emit('LEAD_EXTRACTED', { thread_id: m.thread_id, phones, emails });
            }
          }

          // Emit payload đầy đủ lên frontend
          const msgPayload = {
            ...m,
            timestamp_ms: tsMs,
            timestamp_source: tsSource,
            created_at: createdAt,
            is_outgoing: !!isOutgoing
          };
          console.log(`[WS] Emitting NEW_MESSAGE to Socket.io clients:`, JSON.stringify(msgPayload).substring(0, 200));
          io.emit('NEW_MESSAGE', msgPayload);

          // Auto-Reply & AI
          if (!isOutgoing) {
            const replied = await autoReplyEngine.processIncoming(m, sendViaExtension);
            if (!replied) {
              await aiMediator.processIncoming(m, sendViaExtension);
            }
          }
          break;
        }

        case 'SYNC_THREADS_RESULT': {
          const { account_id, threads } = msg.data;
          console.log(`[WS] Nhận ${threads?.length || 0} threads từ extension tài khoản: ${account_id}`);
          if (threads?.length) {
            const txn = db.transaction((account_id, threads) => {
              for (const t of threads) {
                const threadId = String(t.thread_id);
                let name = t.name || t.contact_name || null;
                
                const PRESENCE_EXACT = /^(?:Đang|Đang hoạt động.*|Hoạt động(?:\s+\d+.*)?|Đã hoạt động.*|Active now|Active recently|Active \d+.*|Online|Offline)$/i;
                if (name && PRESENCE_EXACT.test(name.trim())) {
                  const existing = db.prepare('SELECT contact_name FROM threads WHERE id = ?').get(threadId);
                  let existingName = existing?.contact_name;
                  if (existingName && PRESENCE_EXACT.test(existingName.trim())) existingName = null;
                  name = existingName || 'Khách hàng';
                }
                
                // Double check để loại bỏ trường hợp 'Đang' tuyệt đối
                if (name === 'Đang') name = 'Khách hàng';
                let cleanLastMsg = cleanMessageText(t.last_message);
                if (!cleanLastMsg || isSystemOrMetadataText(cleanLastMsg) || cleanLastMsg === 'Đang tải...') {
                  const dbMsgs = db.prepare(`
                    SELECT content FROM messages 
                    WHERE thread_id = ? 
                    ORDER BY timestamp_ms DESC, created_at DESC, id DESC 
                    LIMIT 10
                  `).all(threadId);

                  const validInDb = dbMsgs.find(m => {
                    const c = cleanMessageText(m.content);
                    return c && !isSystemOrMetadataText(c) && c !== 'Đang tải...';
                  });

                  cleanLastMsg = validInDb ? cleanMessageText(validInDb.content) : 'Chưa có tin nhắn';
                }

                ConversationRepository.upsertThread({
                  id: threadId,
                  account_id: account_id,
                  thread_url: t.thread_url || null,
                  contact_name: name,
                  last_message: cleanLastMsg,
                  is_unread: t.is_unread
                });
                
                const currentContact = db.prepare('SELECT avatar_url FROM contacts WHERE thread_id = ?').get(threadId);
                let initialAvatar = currentContact?.avatar_url || null;
                if (t.avatar_url && !t.avatar_url.startsWith('http')) {
                  initialAvatar = t.avatar_url;
                }
                db.prepare(`
                  INSERT INTO contacts (thread_id, name, avatar_url)
                  VALUES (?, ?, ?)
                  ON CONFLICT(thread_id) DO UPDATE SET
                    name = excluded.name,
                    avatar_url = COALESCE(excluded.avatar_url, contacts.avatar_url)
                `).run(threadId, name, initialAvatar);
              }
            });
            txn(account_id, threads);

            for (const t of threads) {
              const threadId = String(t.thread_id);
              const avatarData = t.avatar_base64 || t.avatar_url;
              if (avatarData) {
                saveAvatarFromBase64OrUrl(avatarData, threadId).then(localFilename => {
                  if (localFilename) {
                    db.prepare('UPDATE contacts SET avatar_url = ? WHERE thread_id = ?').run(localFilename, threadId);
                    io.emit('CONTACT_UPDATED', { thread_id: threadId, avatar_url: localFilename });
                  }
                }).catch(() => {});
              }
            }
          }
          const allThreads = db.prepare(`
            SELECT t.*, c.phone, c.email, c.lead_captured, c.avatar_url
            FROM threads t
            LEFT JOIN contacts c ON c.thread_id = t.id
            WHERE t.account_id = ?
            ORDER BY t.last_activity DESC
          `).all(account_id);
          io.emit('THREADS_SYNCED', { account_id, threads: allThreads });
          console.log(`[WS] Đã emit THREADS_SYNCED lên frontend: ${allThreads.length} threads`);
          break;
        }

        case 'THREAD_MESSAGES_SYNCED': {
          const { account_id, thread_id, messages, reason, mode, checkpoint, fetched_count } = msg.data;
          console.log(`[WS] THREAD_MESSAGES_SYNCED: thread=${thread_id} mode=${mode||'full'} count=${messages?.length || 0}${reason ? ` reason=${reason}` : ''}`);

          if (reason) {
            const temporaryReasons = ['url_mismatch', 'sidebar_mismatch', 'marker_mismatch', 'no_rows', 'no_main_container', 'loading', 'timeout'];
            if (temporaryReasons.includes(reason)) {
              if (!global.syncRetries) global.syncRetries = {};
              if (!global.syncRetries[thread_id]) global.syncRetries[thread_id] = 0;
              
              if (global.syncRetries[thread_id] < 2) {
                global.syncRetries[thread_id]++;
                console.log(`[WS] 🔄 Retry sync thread ${thread_id} (Lần ${global.syncRetries[thread_id]}) sau 2s...`);
                setTimeout(() => {
                  const extWs = extensionConnections.get(account_id);
                  if (extWs && extWs.readyState === 1 /* WebSocket.OPEN */) {
                    const threadRow = db.prepare('SELECT thread_url FROM threads WHERE id = ?').get(thread_id);
                    const retryThreadUrl = msg.data.thread_url || (threadRow ? threadRow.thread_url : null);
                    // Pass the old checkpoint back if available
                    const HistorySyncManager = require('./services/HistorySyncManager');
                    const syncState = HistorySyncManager.getSyncState(thread_id);
                    extWs.send(JSON.stringify({
                      type: 'SYNC_THREAD_MESSAGES',
                      data: { account_id, thread_id, thread_url: retryThreadUrl, mode: syncState?.sync_cursor?.mode || 'initial', cursor: syncState?.sync_cursor }
                    }));
                  }
                }, 2000);
              } else {
                console.log(`[WS] ❌ Hủy sync thread ${thread_id} sau 2 lần retry thất bại (reason=${reason})`);
                global.syncRetries[thread_id] = 0;
                const HistorySyncManager = require('./services/HistorySyncManager');
                HistorySyncManager.updateSyncStatus(thread_id, 'FAILED', null, reason);
              }
            } else {
              const HistorySyncManager = require('./services/HistorySyncManager');
              HistorySyncManager.updateSyncStatus(thread_id, 'FAILED', null, reason);
            }
            return; // Không ghi đè hoặc emit UI
          }

          if (global.syncRetries && global.syncRetries[thread_id]) {
            global.syncRetries[thread_id] = 0;
          }

          const HistorySyncManager = require('./services/HistorySyncManager');
          
          if (Array.isArray(messages) && messages.length > 0) {
            const validMessages = messages.map(m => ({ ...m, content: cleanMessageText(m.content) }))
              .filter(m => String(m.thread_id || thread_id) === String(thread_id)
                && m.content && !isSystemOrMetadataText(m.content));

            const threadRow = db.prepare('SELECT id, account_id FROM threads WHERE id = ?').get(thread_id);
            if (!threadRow) {
              ConversationRepository.upsertThread({
                id: String(thread_id),
                account_id,
                contact_name: 'Khách hàng',
                is_unread: false
              });
            }
            
            const persistence = ConversationRepository.saveMessagesTransaction(thread_id, validMessages.map(m => ({
              ...m,
              account_id,
              timestamp_source: m.timestamp_source || 'fallback'
            })));
            const deltaIds = [...persistence.insertedIds, ...persistence.updatedIds];
            const fetchedTotal = Number.isFinite(Number(fetched_count)) ? Number(fetched_count) : messages.length;
            const skippedTotal = Math.max(0, fetchedTotal - deltaIds.length);
            console.log(`[WS] Diagnostics thread=${thread_id}: fetched=${fetchedTotal} inserted=${persistence.insertedIds.length} updated=${persistence.updatedIds.length} skipped=${skippedTotal}`);

            if (checkpoint) {
              HistorySyncManager.updateSyncStatus(thread_id, 'SYNCED', checkpoint);
            }

            const latest = validMessages[validMessages.length - 1];
            if (latest) ConversationRepository.touchThread(thread_id, latest.content);

            if (deltaIds.length === 0) break;
            const placeholders = deltaIds.map(() => '?').join(',');
            const deltaMsgsRows = db.prepare(`
              SELECT * FROM messages WHERE fb_message_id IN (${placeholders}) ORDER BY timestamp_ms ASC, created_at ASC, id ASC
            `).all(...deltaIds);
            const cleanMsgs = deltaMsgsRows.map(m => {
              const cleaned = cleanMessageText(m.content);
              return { ...m, cleaned };
            }).filter(m => m.cleaned && !isSystemOrMetadataText(m.cleaned) && m.cleaned !== 'Đang tải...').map(m => ({
              ...m,
              content: m.cleaned
            }));

            io.emit('THREAD_MESSAGES_UPDATED', { thread_id, messages: cleanMsgs });
          } else {
             // Empty messages list but no error means we might have reached the end or just no new messages
             if (checkpoint) {
               HistorySyncManager.updateSyncStatus(thread_id, 'SYNCED', checkpoint);
             }
          }
          break;
        }

        case 'MSG_UNSEND': {
          const { fb_message_id } = msg.data;
          db.prepare("UPDATE messages SET is_unsent=1 WHERE fb_message_id=?").run(fb_message_id);
          io.emit('MESSAGE_UNSENT', { fb_message_id });
          break;
        }

        default: break;
      }
    } catch (err) {
      console.error('[WS] Error:', err.message);
    }
  });

  ws.on('close', () => {
    if (ws.accountId) {
      extensionConnections.delete(ws.accountId);
      db.prepare("UPDATE accounts SET status='DISCONNECTED' WHERE id=?").run(ws.accountId);
      io.emit('ACCOUNT_STATUS_CHANGED', { account_id: ws.accountId, status: 'DISCONNECTED' });
      io.emit('EXTENSION_CONNECTION_CHANGED', { account_id: ws.accountId, is_connected: false });
    }
  });
});

// ────────────────────────────────────────────────
// Socket.io: Nhân viên gửi tin nhắn → AI auto-pause 30 phút
// ────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('REQUEST_SYNC_THREADS', ({ account_id }) => {
    if (!account_id) return;
    const extWs = extensionConnections.get(account_id);
    if (extWs && extWs.readyState === WebSocket.OPEN) {
      console.log(`[Socket.io] Nhận yêu cầu đồng bộ lại hội thoại cho account: ${account_id}`);
      extWs.send(JSON.stringify({ type: 'SYNC_THREADS', data: { account_id } }));
    } else {
      console.warn(`[Socket.io] Extension cho account ${account_id} chưa sẵn sàng WebSocket.`);
    }
  });

  socket.on('REQUEST_SYNC_THREAD_MESSAGES', ({ account_id, thread_id, thread_url }) => {
    let targetAccId = account_id;
    if (!targetAccId && extensionConnections.size > 0) {
      targetAccId = extensionConnections.keys().next().value;
    }
    if (!targetAccId || !thread_id) return;

    const extWs = extensionConnections.get(targetAccId);
    if (extWs && extWs.readyState === WebSocket.OPEN) {
      const HistorySyncManager = require('./services/HistorySyncManager');
      const syncState = HistorySyncManager.getSyncState(thread_id);
      let mode = 'incremental';
      if (!syncState || !syncState.sync_cursor) {
        mode = 'initial';
      }
      
      console.log(`[Socket.io] Yêu cầu sync tin nhắn cho thread ${thread_id} (account ${targetAccId}) mode=${mode}`);
      extWs.send(JSON.stringify({
        type: 'SYNC_THREAD_MESSAGES',
        data: { account_id: targetAccId, thread_id, thread_url, mode, cursor: syncState?.sync_cursor || null }
      }));
    }
  });

  socket.on('SEND_MESSAGE', async ({ thread_id, content, client_message_id }) => {
    // Nhân viên gõ tay → tạm dừng AI 30 phút
    const pauseResult = aiMediator.pauseForThread(thread_id);
    io.emit('AI_PAUSED', { thread_id, until: pauseResult.until });

    try {
      await sendViaExtension(thread_id, content, client_message_id);
    } catch (err) {
      console.error('[Socket] Lỗi gửi tin nhắn:', err.message);
      socket.emit('SEND_ERROR', { error: err.message, client_message_id });
      io.emit('MESSAGE_SEND_FAILED', { thread_id, client_message_id, success: false, error: err.message });
    }
  });
});

// ────────────────────────────────────────────────
// REST API
// ────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({
  status: 'OK', uptime: process.uptime(),
  db: 'SQLite WAL Mode', activeExtensions: extensionConnections.size
}));

// Accounts
app.get('/api/accounts', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts').all();
  const result = accounts.map(acc => ({
    ...acc,
    is_extension_connected: extensionConnections.has(acc.id) && extensionConnections.get(acc.id).readyState === WebSocket.OPEN
  }));
  res.json(result);
});
app.post('/api/accounts/:id/start', (req, res) => {
  res.json({ success: processManager.startAccountProcess(req.params.id) });
});
app.post('/api/accounts/new-session', (req, res) => {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
  const randomStr = Math.random().toString(36).substring(2, 7);
  const pendingKey = `pending_${dateStr}_${randomStr}`;

  console.log(`[API] Tạo phiên đăng ký tài khoản Facebook mới: ${pendingKey}`);
  const success = processManager.startNewAccountProcess(pendingKey);
  res.json({ success, pending_key: pendingKey });
});

// Threads
app.get('/api/threads', (req, res) => {
  const { user_id = 1, role = 'ADMIN', tab = 'ALL' } = req.query;
  const threads = assignmentManager.getThreadsByFilter(Number(user_id), role, tab);
  res.json(threads);
});

app.post('/api/threads/:id/assign', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Thiếu user_id' });
  const result = assignmentManager.assignThread(req.params.id, user_id);
  if (result.success) io.emit('THREAD_ASSIGNED', { thread_id: req.params.id, user_id });
  res.json(result);
});

app.post('/api/threads/:id/complete', (req, res) => {
  const result = assignmentManager.completeThread(req.params.id);
  io.emit('THREAD_COMPLETED', { thread_id: req.params.id });
  res.json(result);
});



// Contacts / Leads
app.get('/api/contacts/:thread_id', (req, res) => {
  res.json(db.prepare('SELECT * FROM contacts WHERE thread_id=?').get(req.params.thread_id) || {});
});

app.put('/api/contacts/:thread_id', (req, res) => {
  const { name, phone, email, notes, tags, lead_captured, avatar_url } = req.body;
  db.prepare(`
    INSERT INTO contacts (thread_id, name, phone, email, notes, tags, lead_captured, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(thread_id) DO UPDATE SET
      name = COALESCE(excluded.name, contacts.name),
      phone = COALESCE(excluded.phone, contacts.phone),
      email = COALESCE(excluded.email, contacts.email),
      notes = excluded.notes, tags = excluded.tags,
      lead_captured = excluded.lead_captured,
      avatar_url = COALESCE(excluded.avatar_url, contacts.avatar_url)
  `).run(req.params.thread_id, name||null, phone||null, email||null,
    notes||null, JSON.stringify(tags||[]), lead_captured ? 1 : 0, avatar_url||null);
  io.emit('CONTACT_UPDATED', { thread_id: req.params.thread_id });
  res.json({ success: true });
});

// Avatar serving - serves local avatar files
app.get('/api/avatars/:filename', serveAvatar);

// Search
app.get('/api/search', (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'Thiếu query q' });
  res.json(searchService.searchMessages(q, Number(limit) || 50));
});

// Leads export
app.get('/api/leads', (req, res) => res.json(searchService.getCapturedLeads()));
app.post('/api/leads/export/excel', async (req, res) => {
  try { res.download(await exportService.exportLeadsToExcel()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/leads/export/csv', (req, res) => {
  try { res.download(exportService.exportLeadsToCSV()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Task 4.1: Auto-Reply CRUD ──
app.get('/api/accounts/:id/auto-replies', (req, res) => {
  res.json(autoReplyEngine.getRules(req.params.id));
});
app.post('/api/accounts/:id/auto-replies', (req, res) => {
  const { trigger_keyword, response_template } = req.body;
  res.json(autoReplyEngine.createRule({
    account_id: req.params.id, trigger_keyword, response_template
  }));
});
app.patch('/api/auto-replies/:id/toggle', (req, res) => {
  res.json(autoReplyEngine.toggleRule(Number(req.params.id), req.body.is_active));
});
app.delete('/api/auto-replies/:id', (req, res) => {
  res.json(autoReplyEngine.deleteRule(Number(req.params.id)));
});

// ── Task 4.2: Broadcast ──
app.get('/api/accounts/:id/broadcast/quota', (req, res) => {
  res.json(broadcastEngine.getDailyQuota(req.params.id));
});

app.post('/api/accounts/:id/broadcast', async (req, res) => {
  const { thread_ids, message } = req.body;
  if (!thread_ids?.length || !message) {
    return res.status(400).json({ error: 'Thiếu thread_ids hoặc message' });
  }
  try {
    const campaignId = await broadcastEngine.startCampaign({
      account_id: req.params.id,
      thread_ids,
      message,
      sendFn: sendViaExtension,
      onProgress: (progress) => io.emit('BROADCAST_PROGRESS', progress)
    });
    res.json({ success: true, campaignId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/broadcast/:campaignId/cancel', (req, res) => {
  res.json(broadcastEngine.cancelCampaign(req.params.campaignId));
});

// ── Task 4.3: AI Config CRUD ──
app.get('/api/accounts/:id/ai-config', (req, res) => {
  const config = aiMediator.getConfig(req.params.id);
  // Mask API key trước khi trả về
  if (config?.api_key) config.api_key = config.api_key.slice(0, 8) + '***';
  res.json(config || {});
});

app.put('/api/accounts/:id/ai-config', (req, res) => {
  res.json(aiMediator.upsertConfig({ account_id: req.params.id, ...req.body }));
});

app.patch('/api/accounts/:id/ai-config/toggle', (req, res) => {
  res.json(aiMediator.toggleAI(req.params.id, req.body.is_active));
});

app.post('/api/threads/:id/ai/pause', (req, res) => {
  res.json(aiMediator.pauseForThread(req.params.id));
});

app.post('/api/threads/:id/ai/resume', (req, res) => {
  res.json(aiMediator.resumeForThread(req.params.id));
});

app.get('/api/ollama/health', async (req, res) => {
  const isOnline = await aiMediator.checkOllamaHealth();
  res.json({ online: isOnline });
});

// Messages REST API - With UI Guard Filter
app.get('/api/threads/:id/messages', (req, res) => {
  const msgs = db.prepare('SELECT * FROM messages WHERE thread_id=? ORDER BY timestamp_ms ASC, created_at ASC, id ASC').all(req.params.id);
  const cleanMsgs = msgs.map(m => {
    const cleaned = cleanMessageText(m.content);
    return { ...m, cleaned };
  }).filter(m => m.cleaned && !isSystemOrMetadataText(m.cleaned) && m.cleaned !== 'Đang tải...').map(m => ({
    ...m,
    content: m.cleaned
  }));
  res.json(cleanMsgs);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// ────────────────────────────────────────────────
const PORT = process.env.PORT || 5050;
function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] http://localhost:${PORT}`);
    console.log(`[Server] WebSocket ws://localhost:${PORT}`);
  });
}

module.exports = { app, server, startServer, extensionConnections, io };
