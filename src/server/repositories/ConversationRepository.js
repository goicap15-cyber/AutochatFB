const crypto = require('crypto');
let defaultDb;
function getDefaultDb() {
  if (!defaultDb) defaultDb = require('../database/db');
  return defaultDb;
}

class ConversationRepository {
  static upsertThread(threadData, database = getDefaultDb()) {
    const { id, account_id, thread_url, contact_name, last_message, is_unread } = threadData;
    const existing = database.prepare('SELECT id FROM threads WHERE id = ?').get(id);
    if (existing) {
      database.prepare(`
        UPDATE threads
        SET contact_name = COALESCE(?, contact_name),
            thread_url = COALESCE(?, thread_url),
            last_message = COALESCE(?, last_message),
            is_unread = COALESCE(?, is_unread)
        WHERE id = ?
      `).run(contact_name, thread_url, last_message, is_unread === undefined ? null : (is_unread ? 1 : 0), id);
    } else {
      database.prepare(`
        INSERT INTO threads (id, account_id, thread_url, contact_name, last_message, is_unread)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, account_id, thread_url, contact_name, last_message, is_unread === undefined ? 1 : (is_unread ? 1 : 0));
    }
    return this.getThread(id, database);
  }

  static getThread(id, database = getDefaultDb()) {
    return database.prepare('SELECT * FROM threads WHERE id = ?').get(id);
  }

  static touchThread(threadId, lastMessage, database = getDefaultDb()) {
    database.prepare('UPDATE threads SET last_message = COALESCE(?, last_message), last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(lastMessage, threadId);
  }

  static getMessages(threadId, limit = 50, offset = 0, database = getDefaultDb()) {
    return database.prepare(`
      SELECT * FROM messages
      WHERE thread_id = ?
      ORDER BY timestamp_ms DESC, created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(threadId, limit, offset).reverse();
  }

  static saveMessagesTransaction(threadId, messages = [], database = getDefaultDb()) {
    const insertMsg = database.prepare(`
      INSERT INTO messages (thread_id, fb_message_id, sender_id, content, timestamp_ms, timestamp_source, is_outgoing, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fb_message_id) DO UPDATE SET
        content = COALESCE(excluded.content, messages.content),
        timestamp_ms = CASE WHEN excluded.timestamp_ms > messages.timestamp_ms THEN excluded.timestamp_ms ELSE messages.timestamp_ms END,
        timestamp_source = CASE WHEN excluded.timestamp_source <> 'fallback' THEN excluded.timestamp_source ELSE messages.timestamp_source END,
        created_at = CASE WHEN excluded.timestamp_ms > 0 THEN excluded.created_at ELSE messages.created_at END
    `);
    const rank = { facebook_payload: 6, facebook_label: 5, facebook_dom: 4, realtime_fallback: 3, sync: 3, fallback: 2, unknown: 1 };
    const transaction = database.transaction((msgs) => {
      const result = { insertedIds: [], updatedIds: [], skippedCount: 0 };
      for (const msg of msgs) {
        const senderId = msg.sender_id || msg.sender || (msg.is_outgoing ? String(msg.account_id || 'SYSTEM') : 'CONTACT');
        const stableId = msg.fb_message_id || msg.messageId || msg.client_message_id || ConversationRepository.fingerprint(threadId, msg);
        const timestampMs = msg.timestamp_ms || msg.timestamp || 0;
        const timestampSource = msg.timestamp_source || 'sync';
        const content = msg.content ?? msg.text ?? msg.cleaned ?? null;
        const createdAt = msg.created_at || (timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date().toISOString());
        const existing = database.prepare('SELECT content, timestamp_ms, timestamp_source FROM messages WHERE fb_message_id = ?').get(stableId);
        if (existing) {
          const changed = existing.content !== content || timestampMs > (existing.timestamp_ms || 0) || (rank[timestampSource] || 1) > (rank[existing.timestamp_source] || 1);
          if (!changed) { result.skippedCount += 1; continue; }
          insertMsg.run(threadId, stableId, senderId, content, timestampMs, timestampSource, msg.is_outgoing ? 1 : 0, createdAt);
          result.updatedIds.push(stableId);
          continue;
        }
        insertMsg.run(threadId, stableId, senderId, content, timestampMs, timestampSource, msg.is_outgoing ? 1 : 0, createdAt);
        result.insertedIds.push(stableId);
      }
      return result;
    });
    return transaction(messages);
  }
  static fingerprint(threadId, message) {
    return 'history_' + crypto.createHash('sha256').update(JSON.stringify([
      threadId,
      message.sender_id || message.sender || '',
      message.content || message.text || message.cleaned || '',
      message.timestamp_ms || message.timestamp || 0,
      message.media_url || '',
      message.created_at || ''
    ])).digest('hex').slice(0, 32);
  }
}

module.exports = ConversationRepository;
