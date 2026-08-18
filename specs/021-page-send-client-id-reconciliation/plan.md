# Implementation Plan: Page Send Client-ID Reconciliation

## Architecture

Two small, surgical changes:
1. `src/server/server.js`'s `sendViaExtension()` — add one field to one existing socket emit.
2. `src/client/App.jsx`'s `socket.on('NEW_MESSAGE', ...)` handler — extend the existing match/update logic by a few lines.

No schema change, no change to `MessageQueueRepository`, `QueueWorker.js`, `background.js`, or any DOM-correlation logic already touched by features 015/017/019/020.

## Phases

1. **Carry the original id through the first emit** (`server.js`, inside `sendViaExtension`, the `io.emit('NEW_MESSAGE', {...})` call at the end of the function):
   ```js
   io.emit('NEW_MESSAGE', {
     id: result.lastInsertRowid,
     thread_id,
     content: text,
     is_outgoing: true,
     status: 'pending',
     created_at: new Date().toISOString(),
     client_message_id: clientMsgId,
     original_client_message_id: client_message_id || clientMsgId
   });
   ```
   `client_message_id` here is the function's own parameter (the frontend's original id, still in scope — untouched by the `if (isPageThread) { clientMsgId = ... }` reassignment which only ever mutates the separate `clientMsgId` variable). Falls back to `clientMsgId` itself for the non-Page branch (where they're already equal) purely so the field is never undefined.

2. **Match by either id, reconcile to the new one** (`App.jsx`, the `socket.on('NEW_MESSAGE', ...)` handler):
   ```js
   socket.on('NEW_MESSAGE', (newMsg) => {
     const tidStr = String(newMsg.thread_id);
     setMessages(prev => {
       const currentMsgs = prev[tidStr] || [];
       let updated;
       if (newMsg.client_message_id) {
         const existsIdx = currentMsgs.findIndex(m =>
           m.client_message_id === newMsg.client_message_id ||
           (newMsg.original_client_message_id && m.client_message_id === newMsg.original_client_message_id)
         );
         if (existsIdx >= 0) {
           updated = [...currentMsgs];
           updated[existsIdx] = { ...currentMsgs[existsIdx], ...newMsg, client_message_id: newMsg.client_message_id, status: newMsg.status || newMsg.delivery_status || 'sent' };
         } else {
           updated = [...currentMsgs, { ...newMsg, status: newMsg.status || newMsg.delivery_status || 'sent' }];
         }
       } else {
         updated = [...currentMsgs, { ...newMsg, status: newMsg.status || newMsg.delivery_status || 'sent' }];
       }
       ...
   ```
   The key addition: `client_message_id: newMsg.client_message_id` in the spread-merge on match (FR-003) — explicitly overwrites the bubble's id to the server's `queue_`-derived one, so every *later* event (which only ever carries that id, never the original) still finds this same bubble via the plain first branch of the `||` (no `original_client_message_id` needed after this point).

3. **Non-Page and retry paths need no special-casing**: `handleRetryMessage` generates a fresh `retry_<...>` id through the exact same `handleSendMessage` → `sendViaExtension` path, so it's covered by the same fix automatically. The non-Page branch already has caller id === server id, so `original_client_message_id` there is redundant but harmless (matches on the first condition already).

4. **Validation**: this is a live-only UI reconciliation - not meaningfully unit-testable (the bug is about two independent id-generation points and a client-side React state merge, not a DB/SQL behavior). Validate live: (a) send a fresh message to the Page test thread, confirm exactly one bubble appears and transitions from spinner to checkmark; (b) send to the personal-messenger test thread, confirm unchanged behavior; (c) run `npm run test:persistence` to confirm zero backend regression, since no backend logic actually changed (only an extra field on an existing payload).

## Safety Gates

- Do not touch `MessageQueueRepository`, `QueueWorker.js`, `background.js`, or the `messages`/`message_queue` schema — the entire fix is "tell the frontend both ids once, let it reconcile."
- Do not change what gets stored in the `messages.client_message_id` column — it must remain exactly `'queue_' + queue_id` for Page threads, unchanged, since `SEND_MESSAGE_RESULT`/`QUEUED_MESSAGE_RESULT` handlers and the pending-correlation/mismatch-guard/id-upgrade logic all key off it.
- `original_client_message_id` is transient/emit-only — never persisted, never read back from the DB.
