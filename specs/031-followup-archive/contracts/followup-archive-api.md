# API Contract

- GET /api/threads includes archived_at and active reminder summary.
- PUT /api/threads/:id/reminder accepts due_at and optional note; it upserts the active reminder.
- DELETE /api/threads/:id/reminder cancels the active reminder.
- POST /api/threads/:id/reminder/complete completes the active reminder.
- POST /api/threads/:id/archive archives the thread.
- POST /api/threads/:id/restore restores the thread.

All mutations return the updated thread/reminder state or a clear 4xx validation/not-found error.
