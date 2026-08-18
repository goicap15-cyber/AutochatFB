// The DOM observer reports the bare Facebook id (e.g. a personal PSID from
// the /messages/t/<psid> URL), but rich-message rows store the CRM's own
// thread id, which for personal threads is the compound "<account_id>:<psid>"
// - the two never compare equal directly. Reuses the exact resolution
// ConversationRepository.upsertThread already relies on elsewhere, rather
// than inventing a new lookup.
function resolveInternalThreadId(database, accountId, rawThreadId) {
  const row = database.prepare(
    'SELECT id FROM threads WHERE account_id = ? AND COALESCE(external_thread_id, id) = ?'
  ).get(accountId, String(rawThreadId));
  return row ? row.id : String(rawThreadId);
}

module.exports = { resolveInternalThreadId };
