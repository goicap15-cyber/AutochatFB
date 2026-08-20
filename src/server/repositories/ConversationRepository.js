const crypto = require('crypto');
const { isInvalidContactName } = require('../utils/textFilter');
let defaultDb;
function getDefaultDb() {
  if (!defaultDb) defaultDb = require('../database/db');
  return defaultDb;
}

// Feature 019: page_dom_observer's geometry-based direction detection
// recomputes a fresh horizontal midpoint every scan tick, which can read
// noisy/wrong right after a page reload before layout has settled (e.g.
// right after `npm start`, mid backlog rescan). Committing a flip on a
// single disagreeing reading let one bad tick silently corrupt an
// already-correct is_outgoing. This map requires the SAME disagreeing
// value to be seen twice (not necessarily consecutive ticks, but with no
// agreeing reading in between) before it's actually written - see
// shouldCommitDirectionFlip below. In-memory and reset on server restart
// by design: a restart is exactly when the first noisy reading tends to
// happen, so it should never carry a "one disagreement already logged"
// state across restarts.
let directionFlipCandidates = new Map(); // fb_message_id -> proposed isOutgoing (0/1)

function shouldCommitDirectionFlip(stableMessageId, existingIsOutgoing, proposedIsOutgoing) {
  if (Number(!!existingIsOutgoing) === Number(!!proposedIsOutgoing)) {
    directionFlipCandidates.delete(stableMessageId); // agrees with stored value - any pending disagreement was noise
    return false;
  }
  const proposed = proposedIsOutgoing ? 1 : 0;
  if (directionFlipCandidates.get(stableMessageId) === proposed) {
    directionFlipCandidates.delete(stableMessageId); // confirmed by a second matching disagreement - commit
    return true;
  }
  directionFlipCandidates.set(stableMessageId, proposed); // first disagreement (or a different one) - wait for confirmation
  return false;
}

class ConversationRepository {
  static upsertThread(threadData, database = getDefaultDb()) {
    const { id, account_id, thread_url, contact_name, last_message, is_unread, source_id } = threadData;
    const external_thread_id = String(threadData.external_thread_id || threadData.thread_id || id);
    const preferredId = String(id || external_thread_id);
    const cleanIncomingName = isInvalidContactName(contact_name) ? null : contact_name.trim();

    let existing = null;
    if (source_id && external_thread_id) {
      existing = database.prepare(`
        SELECT id, contact_name FROM threads
        WHERE source_id = ? AND COALESCE(external_thread_id, id) = ?
      `).get(source_id, external_thread_id);
    }
    if (!existing && account_id && external_thread_id) {
      existing = database.prepare(`
        SELECT id, contact_name FROM threads
        WHERE account_id = ? AND COALESCE(external_thread_id, id) = ?
      `).get(account_id, external_thread_id);
    }
    if (!existing) {
      existing = database.prepare('SELECT id, contact_name FROM threads WHERE id = ?').get(preferredId);
    }

    if (existing) {
      const existingIsInvalid = isInvalidContactName(existing.contact_name);
      let targetName = existing.contact_name;
      if (cleanIncomingName && cleanIncomingName !== 'Khách hàng') {
        targetName = cleanIncomingName;
      } else if (existingIsInvalid || !existing.contact_name) {
        targetName = cleanIncomingName || 'Khách hàng';
      }

      database.prepare(`
        UPDATE threads
        SET external_thread_id = COALESCE(external_thread_id, ?),
            source_id = COALESCE(?, source_id),
            contact_name = ?,
            thread_url = COALESCE(?, thread_url),
            last_message = COALESCE(?, last_message),
            is_unread = COALESCE(?, is_unread)
        WHERE id = ?
      `).run(
          external_thread_id, 
          source_id || null, 
          targetName,
          thread_url, 
          last_message, 
          is_unread === undefined ? null : (is_unread ? 1 : 0), 
          existing.id
      );
      return this.getThread(existing.id, database);
    }

    database.prepare(`
      INSERT INTO threads (id, external_thread_id, account_id, source_id, thread_url, contact_name, last_message, is_unread)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(preferredId, external_thread_id, account_id, source_id || null, thread_url, cleanIncomingName || 'Khách hàng', last_message, is_unread === undefined ? 1 : (is_unread ? 1 : 0));
    return this.getThread(preferredId, database);
  }

  static getThread(id, database = getDefaultDb()) {
    return database.prepare('SELECT * FROM threads WHERE id = ?').get(id);
  }

  // Resolves a thread's inbox source for send-routing decisions (feature 015).
  // Mirrors the exact threads -> inbox_sources join MessageQueueRepository.popPending()
  // already uses, so both places agree on what counts as a Page thread. Returns
  // { sourceType: null, pageId: null } for a thread with no source_id (e.g. legacy
  // personal threads) or one whose source_id doesn't resolve to a live source row.
  static getThreadSource(threadId, database = getDefaultDb()) {
    const row = database.prepare(`
      SELECT s.source_type AS sourceType, s.external_id AS pageId
      FROM threads t
      LEFT JOIN inbox_sources s ON s.id = t.source_id
      WHERE t.id = ?
    `).get(threadId);
    if (!row || !row.sourceType) return { sourceType: null, pageId: null };
    return row;
  }

  static touchThread(threadId, lastMessage, database = getDefaultDb()) {
    database.prepare('UPDATE threads SET last_message = COALESCE(?, last_message), last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(lastMessage, threadId);
  }

  // Writes a resolved avatar to the contacts row only when no real avatar is
  // stored yet, so re-scanning an already-captured thread (or one whose
  // messages predate avatar extraction) can still backfill it once, without
  // clobbering a good value on every later scan tick.
  static setContactAvatarIfMissing(threadId, contactName, avatarUrl, database = getDefaultDb()) {
    if (!avatarUrl) return { updated: false };
    const existing = database.prepare('SELECT avatar_url FROM contacts WHERE thread_id = ?').get(threadId);
    if (existing && existing.avatar_url) return { updated: false };
    database.prepare(`
      INSERT INTO contacts (thread_id, name, avatar_url)
      VALUES (?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        avatar_url = COALESCE(contacts.avatar_url, excluded.avatar_url)
    `).run(threadId, contactName || 'Khách hàng', avatarUrl);
    return { updated: true };
  }

  // Lightweight projection used to seed a fresh content-script's client-side
  // timestamp-anchor map (see page_content.js) after a restart, without
  // sending full message content/media over that sync-hint channel. Excludes
  // synthetic fingerprint() ids ('history_...') - they never match a real
  // DOM data-message-id, so they'd never be usable as anchors anyway.
  static getMessageTimestamps(threadId, database = getDefaultDb()) {
    return database.prepare(`
      SELECT fb_message_id, timestamp_ms FROM messages
      WHERE thread_id = ? AND fb_message_id IS NOT NULL AND fb_message_id NOT LIKE 'history_%'
      ORDER BY timestamp_ms ASC, created_at ASC, id ASC
    `).all(threadId);
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
      INSERT INTO messages (thread_id, fb_message_id, sender_id, content, timestamp_ms, timestamp_source, is_outgoing, direction_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fb_message_id) DO UPDATE SET
        content = CASE WHEN excluded.content IS NOT NULL AND excluded.content <> '' THEN excluded.content ELSE messages.content END,
        timestamp_ms = CASE WHEN excluded.timestamp_ms > messages.timestamp_ms THEN excluded.timestamp_ms ELSE messages.timestamp_ms END,
        timestamp_source = CASE WHEN excluded.timestamp_source <> 'fallback' THEN excluded.timestamp_source ELSE messages.timestamp_source END,
        created_at = CASE WHEN excluded.timestamp_ms > 0 THEN excluded.created_at ELSE messages.created_at END,
        is_outgoing = CASE WHEN excluded.direction_status = 'confirmed' THEN excluded.is_outgoing ELSE messages.is_outgoing END,
        direction_status = CASE WHEN excluded.direction_status = 'confirmed' THEN 'confirmed' ELSE messages.direction_status END
    `);
    const rank = { facebook_payload: 6, facebook_label: 5, dom_order: 5, facebook_dom: 4, realtime_fallback: 3, sync: 3, fallback: 2, unknown: 1 };
    const transaction = database.transaction((msgs) => {
      const result = { insertedIds: [], updatedIds: [], skippedCount: 0 };
      for (const msg of msgs) {
        const isOutgoing = msg.is_outgoing === true || msg.is_outgoing === 1 ? 1 : 0;
        const directionStatus = msg.direction_status === 'pending' || msg.directionStatus === 'pending'
          ? 'pending'
          : 'confirmed';
        const senderId = msg.sender_id || msg.sender || (isOutgoing ? String(msg.account_id || 'SYSTEM') : 'CONTACT');
        const stableId = msg.fb_message_id || msg.messageId || msg.client_message_id || ConversationRepository.fingerprint(threadId, msg);
        const timestampMs = msg.timestamp_ms || msg.timestamp || 0;
        const timestampSource = msg.timestamp_source || 'sync';
        const content = msg.content ?? msg.text ?? msg.cleaned ?? null;
        const createdAt = msg.created_at || (timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date().toISOString());
        const existing = database.prepare('SELECT content, timestamp_ms, timestamp_source, is_outgoing, direction_status FROM messages WHERE fb_message_id = ?').get(stableId);
        if (existing) {
          const directionChanged = directionStatus === 'confirmed'
            && (existing.direction_status !== 'confirmed' || existing.is_outgoing !== isOutgoing);
          const changed = existing.content !== content
            || timestampMs > (existing.timestamp_ms || 0)
            || (rank[timestampSource] || 1) > (rank[existing.timestamp_source] || 1)
            || directionChanged;
          if (!changed) { result.skippedCount += 1; continue; }
          insertMsg.run(threadId, stableId, senderId, content, timestampMs, timestampSource, isOutgoing, directionStatus, createdAt);
          result.updatedIds.push(stableId);
          continue;
        }
        insertMsg.run(threadId, stableId, senderId, content, timestampMs, timestampSource, isOutgoing, directionStatus, createdAt);
        result.insertedIds.push(stableId);
      }
      return result;
    });
    return transaction(messages);
  }
  // Test-only: clears direction-flip hysteresis state between test cases so
  // one test's pending candidate can't leak into another's assertions.
  static _resetDirectionFlipTracking() {
    directionFlipCandidates = new Map();
  }

  // Reconciles an already-existing message row with a freshly re-scanned
  // observation of it: upgrades the timestamp when the new source outranks the
  // stored one, and (for page_dom_observer specifically, whose geometry-based
  // direction detection is the most reliable signal for that source) corrects
  // is_outgoing when it disagrees with what's stored - but only once that
  // disagreement is confirmed twice (see shouldCommitDirectionFlip). Never
  // inserts a second row and never throws on repeated identical re-scans.
  static reconcileExistingMessage(stableMessageId, { source, isOutgoing, directionStatus, direction_status, directionConfidence, direction_confidence, tsMs, tsSource, createdAt, content = null } = {}, database = getDefaultDb()) {
    const existingMsg = database.prepare('SELECT timestamp_source, is_outgoing, direction_status FROM messages WHERE fb_message_id = ?').get(stableMessageId);
    if (!existingMsg) return { updated: false, reason: 'not_found' };

    const ranks = {
      facebook_payload: 6,
      facebook_label: 5,
      dom_order: 5,
      facebook_dom: 4,
      realtime_fallback: 3,
      fallback: 2,
      unknown: 1
    };
    const oldRank = ranks[existingMsg.timestamp_source] || 1;
    const newRank = ranks[tsSource] || 1;
    const shouldUpdateTimestamp = newRank > oldRank;
    const explicitStatus = directionStatus || direction_status;
    const explicitConfidence = directionConfidence || direction_confidence;
    const isDirectionKnown = isOutgoing === true || isOutgoing === false || isOutgoing === 1 || isOutgoing === 0;
    const isPendingObservation = explicitStatus === 'pending'
      || !isDirectionKnown
      || explicitConfidence === 'unknown';
    const normalizedOutgoing = isOutgoing === true || isOutgoing === 1 ? 1 : 0;

    // Unknown geometry must never complete or alter a direction decision. It
    // also clears any prior flip candidate so two separated noisy readings
    // cannot combine around an unknown observation.
    if (isPendingObservation) {
      directionFlipCandidates.delete(stableMessageId);
      if (!shouldUpdateTimestamp) return { updated: false, reason: 'no_change' };
      database.prepare(`
        UPDATE messages
        SET timestamp_ms = ?, timestamp_source = ?, created_at = ?
        WHERE fb_message_id = ?
      `).run(tsMs, tsSource, createdAt, stableMessageId);
      return {
        updated: true,
        timestampUpdated: true,
        directionUpdated: false,
        previousTimestampSource: existingMsg.timestamp_source,
        previousIsOutgoing: existingMsg.is_outgoing,
        previousDirectionStatus: existingMsg.direction_status
      };
    }

    const isPageObservation = source === 'page_dom_observer';
    const existingIsPending = existingMsg.direction_status === 'pending';
    const shouldPromotePending = isPageObservation && existingIsPending;
    const shouldUpdateDirection = isPageObservation && (
      shouldPromotePending
      || shouldCommitDirectionFlip(stableMessageId, existingMsg.is_outgoing, normalizedOutgoing)
    );

    if (!shouldUpdateTimestamp && !shouldUpdateDirection) {
      return { updated: false, reason: 'no_change' };
    }

    database.prepare(`
      UPDATE messages
      SET timestamp_ms = CASE WHEN ? = 1 THEN ? ELSE timestamp_ms END,
          timestamp_source = CASE WHEN ? = 1 THEN ? ELSE timestamp_source END,
          created_at = CASE WHEN ? = 1 THEN ? ELSE created_at END,
          is_outgoing = CASE WHEN ? = 1 THEN ? ELSE is_outgoing END,
          direction_status = CASE WHEN ? = 1 THEN 'confirmed' ELSE direction_status END,
          content = CASE WHEN (content IS NULL OR content = '') AND (? IS NOT NULL AND ? != '') THEN ? ELSE content END
      WHERE fb_message_id = ?
    `).run(
      shouldUpdateTimestamp ? 1 : 0, tsMs,
      shouldUpdateTimestamp ? 1 : 0, tsSource,
      shouldUpdateTimestamp ? 1 : 0, createdAt,
      shouldUpdateDirection ? 1 : 0, normalizedOutgoing,
      shouldUpdateDirection ? 1 : 0,
      content, content, content,
      stableMessageId
    );

    return {
      updated: true,
      timestampUpdated: shouldUpdateTimestamp,
      directionUpdated: shouldUpdateDirection,
      previousTimestampSource: existingMsg.timestamp_source,
      previousIsOutgoing: existingMsg.is_outgoing,
      previousDirectionStatus: existingMsg.direction_status
    };
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
