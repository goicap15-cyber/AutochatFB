const MessageQueueRepository = require('../repositories/MessageQueueRepository');
const OutboundConfirmationService = require('./OutboundConfirmationService');

let defaultDb;
function getDefaultDb() {
  if (!defaultDb) defaultDb = require('../database/db');
  return defaultDb;
}

function updateQueueStatusFromClientMessage(clientMessageId, status, errorReason = null, database = getDefaultDb()) {
  if (typeof clientMessageId !== 'string' || !clientMessageId.startsWith('queue_')) return false;
  const queueId = clientMessageId.slice('queue_'.length);
  if (!queueId) return false;
  return MessageQueueRepository.updateStatus(queueId, status, errorReason, database);
}

class OutboundDomCorrelationService {
  /**
   * Spec 040 T020: a DOM-observed event carries real media evidence
   * (media_url, or a media_type other than 'text') regardless of whether a
   * caption is also present - page_content.js's resolveMessageContent now
   * reports kind:'media' with a caption instead of silently losing the image
   * when both are found in the same DOM wrapper (confirmed live 2026-08-17/18
   * for a file-transport image manifest sent with a caption). Requiring an
   * EMPTY caption to treat an event as media confirmation meant a real,
   * successful file-transport send with a caption could never be recognized
   * as sent - it fell through to the text-only match, which correctly
   * refuses to confirm an attachment/manifest dispatch by content alone (see
   * matchPendingOutboundByRawContent above), so it would time out and get
   * resent for real since QUEUE_CONFIRMATION_TIMEOUT is retryable.
   */
  static isMediaConfirmationEvent(m) {
    return !!(m?.media_url || (m?.media_type && m.media_type !== 'text'));
  }

  /**
   * A DOM observer's raw scrape of our own just-sent bubble can get fully
   * collapsed to '' by cleanMessageText's junk-pattern pass (it targets exactly
   * the kind of status/timestamp-surrounded text a fresh Business Suite
   * confirmation looks like) - so this matches on the RAW text instead, against
   * only what we ourselves are actively waiting to confirm in that exact
   * thread. Bounded to one confirmation-cycle window (same constant
   * OutboundConfirmationService already uses) so a stale, unrelated pending row
   * from much earlier can't be coincidentally claimed by a later echo.
   *
   * Excludes any pending row whose dispatch carries an attachment/manifest
   * (spec 039/040): a text-only DOM scrape proves the caption rendered, not
   * that the file(s) actually attached and sent - live testing showed
   * Facebook can post the caption alone while the file silently fails to
   * attach, and this content-only match would otherwise mark the whole
   * dispatch (including the unverified files) as falsely 'sent'. Such
   * dispatches are left pending for matchPendingImageOutbound (an explicit
   * media observation) or the confirmation timeout (fails to 'unknown'
   * rather than a false positive) - see FR-007/FR-012 in specs 039/040.
   */
  static matchPendingOutboundByRawContent(database, threadId, rawContent) {
    if (!rawContent) return null;
    const windowSeconds = Math.round(OutboundConfirmationService.DEFAULT_CONFIRMATION_WINDOW_MS / 1000);
    const candidate = database.prepare(`
      SELECT outbound.id, outbound.client_message_id, outbound.content FROM messages outbound
      LEFT JOIN outbound_attempts attempt ON outbound.latest_attempt_id = attempt.id
      LEFT JOIN message_queue queued ON (
        outbound.client_message_id = 'queue_' || queued.id
        OR attempt.id = queued.outbound_attempt_id
      )
      WHERE outbound.thread_id = ? AND outbound.is_outgoing = 1 AND outbound.delivery_status = 'pending'
        AND datetime(outbound.created_at) >= datetime('now', '-' || ? || ' seconds')
        AND (queued.id IS NULL OR (queued.attachment_id IS NULL AND queued.manifest_id IS NULL))
        AND outbound.attachment_id IS NULL AND (outbound.media_type IS NULL OR outbound.media_type = 'text')
      ORDER BY outbound.id DESC LIMIT 1
    `).get(threadId, windowSeconds);
    if (!candidate) return null;
    const pendingContent = String(candidate.content || '').trim();
    if (!pendingContent) return null;
    if (rawContent === pendingContent || rawContent.includes(pendingContent) || pendingContent.includes(rawContent)) {
      return candidate;
    }
    return null;
  }

  /**
   * A DOM image observation carries nothing comparable to a specific
   * attachment (no checksum/id is recoverable from a rendered Facebook
   * image), so thread + "has an attachment" is the strongest signal
   * available - unlike the text match above, this cannot require exact
   * content equality. Bounding by the same confirmation window at least
   * keeps a long-stale pending image in this thread from being coincidentally
   * claimed by an unrelated later image confirmation.
   */
  static matchPendingImageOutbound(database, threadId) {
    const windowSeconds = Math.round(OutboundConfirmationService.DEFAULT_CONFIRMATION_WINDOW_MS / 1000);
    return database.prepare(`
      SELECT outbound.id, outbound.client_message_id
      FROM messages outbound
      LEFT JOIN outbound_attempts attempt ON outbound.latest_attempt_id = attempt.id
      LEFT JOIN message_queue queued ON (
        outbound.client_message_id = 'queue_' || queued.id
        OR attempt.id = queued.outbound_attempt_id
      )
      WHERE outbound.thread_id = ? AND outbound.is_outgoing = 1
        AND outbound.delivery_status = 'pending'
        AND (
          outbound.attachment_id IS NOT NULL
          OR (outbound.media_type IS NOT NULL AND outbound.media_type != 'text')
          OR queued.attachment_id IS NOT NULL
          OR queued.manifest_id IS NOT NULL
        )
        AND datetime(outbound.created_at) >= datetime('now', '-' || ? || ' seconds')
      ORDER BY outbound.id DESC LIMIT 1
    `).get(threadId, windowSeconds) || null;
  }

  /**
   * Shared "mark a pending outbound row as sent" step, used both by the early
   * raw-content match above and the legacy content-match correlation in
   * server.js - keeps one place that performs this update instead of a third
   * parallel variant. Returns false (no-op) if this fb/dom id was already
   * claimed by another row (replay-safe).
   */
  static confirmPendingOutbound(database, ioServer, pendingRow, { fbMessageId, tsMs = 0, tsSource = 'unknown', rawMessage }) {
    const confirmedId = fbMessageId || `dom_${pendingRow.client_message_id}`;
    const existingConfirmed = database.prepare('SELECT id, is_outgoing FROM messages WHERE fb_message_id = ?').get(confirmedId);
    if (existingConfirmed) {
      if (existingConfirmed.id === pendingRow.id) {
        return true;
      }
      if (existingConfirmed.is_outgoing === 0) {
        console.log(`[WS] Removing duplicate misidentified incoming row ${existingConfirmed.id} in favor of pending outbound row ${pendingRow.id}`);
        database.prepare('DELETE FROM messages WHERE id = ?').run(existingConfirmed.id);
      } else {
        console.log(`[WS] Confirmed ID ${confirmedId} đã tồn tại ở row outgoing ${existingConfirmed.id}. Bỏ qua pending match.`);
        return false;
      }
    }
    database.prepare(`
      UPDATE messages SET fb_message_id = ?, delivery_status = 'sent', delivery_error = NULL,
        timestamp_ms = CASE WHEN ? > 0 THEN ? ELSE timestamp_ms END,
        timestamp_source = CASE WHEN ? <> 'unknown' THEN ? ELSE timestamp_source END
      WHERE id = ?
    `).run(confirmedId, tsMs, tsMs, tsSource, tsSource, pendingRow.id);

    const updatedMsg = database.prepare('SELECT * FROM messages WHERE id = ?').get(pendingRow.id);
    const OutboundAttemptRepository = require('../repositories/OutboundAttemptRepository');
    if (updatedMsg && updatedMsg.latest_attempt_id) {
      OutboundAttemptRepository.transition(
        updatedMsg.latest_attempt_id,
        ['queued', 'dispatching', 'awaiting_confirmation'],
        'sent',
        {
          confirmed_at: new Date(tsMs || Date.now()).toISOString(),
          confirmation_message_id: confirmedId,
          confirmation_source: (tsSource === 'page_dom_observer' || tsSource === 'page_dom') ? 'page_dom' : 'personal_dom'
        },
        database
      );
      const attempt = OutboundAttemptRepository.getById(updatedMsg.latest_attempt_id, database);
      if (attempt && attempt.queue_id) {
        MessageQueueRepository.updateStatus(attempt.queue_id, 'sent', null, database);
      }
    }
    updateQueueStatusFromClientMessage(pendingRow.client_message_id, 'sent', null, database);

    if (ioServer) {
      const targetThreadId = pendingRow.thread_id || rawMessage?.thread_id;
      ioServer.emit('MESSAGE_SENT', { thread_id: targetThreadId, client_message_id: pendingRow.client_message_id, fb_message_id: confirmedId, status: 'sent' });
      ioServer.emit('MESSAGE_SEND_STATUS', {
        thread_id: targetThreadId,
        client_message_id: pendingRow.client_message_id,
        message_id: pendingRow.id,
        status: 'sent',
        fb_message_id: confirmedId
      });
      ioServer.emit('NEW_MESSAGE', {
        ...rawMessage,
        ...updatedMsg,
        client_message_id: pendingRow.client_message_id,
        fb_message_id: confirmedId,
        delivery_status: 'sent',
        status: 'sent',
        is_outgoing: true,
        timestamp_ms: tsMs || updatedMsg?.timestamp_ms,
        timestamp_source: tsSource || updatedMsg?.timestamp_source,
        created_at: rawMessage?.created_at || updatedMsg?.created_at || new Date().toISOString()
      });
    }
    console.log(`[WS] Đã ghép DOM confirmation vào pending outbound ${pendingRow.client_message_id}`);
    return true;
  }
}

module.exports = OutboundDomCorrelationService;
