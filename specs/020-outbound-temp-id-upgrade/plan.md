# Implementation Plan: Outbound Temp-ID Upgrade Dedup

## Architecture

Entirely contained within `server.js`'s `NEW_MESSAGE_RECEIVED` case, inside the existing `if (isOutgoing && (m.source === 'dom_observer' || m.source === 'page_dom_observer') && m.content)` block (`server.js:365-432`). No change to `ConversationRepository.js`, `page_content.js`, `content.js`, or the schema.

## Phases

1. **Add the temp-id-upgrade check** immediately after the existing "pending" correlation block (`server.js:377-401`, which already `break`s on success) and before the "Mismatch guard" block (`server.js:403-430`):
   ```js
   if (m.fb_message_id) {
     const recentSent = db.prepare(`
       SELECT id, client_message_id, fb_message_id FROM messages
       WHERE thread_id = ? AND content = ? AND is_outgoing = 1 AND delivery_status = 'sent'
         AND fb_message_id IS NOT NULL AND fb_message_id != ?
         AND datetime(created_at) >= datetime('now', '-8 seconds')
       ORDER BY id DESC LIMIT 1
     `).get(m.thread_id, m.content, m.fb_message_id);
     if (recentSent) {
       db.prepare('UPDATE messages SET fb_message_id = ? WHERE id = ?').run(m.fb_message_id, recentSent.id);
       console.log(`[WS] Nâng cấp fb_message_id tạm ${recentSent.fb_message_id} -> ${m.fb_message_id} (id ${recentSent.id}), cùng 1 tin gửi đi`);
       console.log('[OUTBOUND_TRACE]', JSON.stringify({ stage: 'BACKEND_DOM_ID_UPGRADED', thread_id: String(m.thread_id), from_fb_message_id: recentSent.fb_message_id, to_fb_message_id: m.fb_message_id, at: new Date().toISOString() }));
       break;
     }
   }
   ```
2. **No new socket emit** (FR-003) — the row's bubble is already visible and correct from the first correlation; only the DB identity changes.
3. **Ordering**: pending-match (existing) → temp-id-upgrade match (new) → mismatch-guard (existing) → plain insert (existing, unchanged fallback). Each step only runs if the previous ones found nothing.
4. **Validation**: this logic touches `db`/`ConversationRepository` indirectly through raw SQL in `server.js`, which (per feature 015's Phase 4 note) isn't practically unit-testable without a live WS connection and `extensionConnections` — cover it the same way feature 015 did: trace the logic against the real observed log sequence (already done in spec.md's Input) plus a focused standalone script exercising the three SQL statements directly against a throwaway test DB (create pending row → simulate temp-id correlation UPDATE → simulate permanent-id arrival → assert the new query finds and upgrades it, not inserts a duplicate) — mirroring the "standalone Node script" validation style used for `page_content.js` changes (features 017/018), just targeting SQL statements instead of DOM logic this time.

## Safety Gates

- Do not change the pending-correlation or mismatch-guard blocks' existing logic or ordering relative to each other — only insert the new check between them.
- Do not touch inbound (customer, `is_outgoing = 0`) message handling at all.
- Keep the match window short (8s per FR-002) — do not make it configurable or long "just in case"; a longer window increases US2's false-merge risk for no real benefit given the observed ~1-3s lag.
- No new socket emission for the upgrade — must stay a silent DB-only correction (FR-003).
