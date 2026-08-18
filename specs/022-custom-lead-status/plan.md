# Implementation Plan: Custom Lead Status

## Architecture

New table + one new nullable column (additive migration, no data loss). Two small backend endpoints, one existing endpoint extended, one existing query extended with a join. Two frontend components touched: `LeadDetailsPanel.jsx` (status picker + create-new UI) and `ConversationSidebar.jsx` (status badge + filter).

## Phases

1. **Schema**: add both the new table and the new column, plus `schema.sql` (for fresh installs), following the exact existing versioned-migration convention in `db.js` (a `migrations` array of `{version, name, up(db)}`, each `ALTER TABLE` wrapped in `try {} catch (e) {}` for idempotency — see e.g. migration v11). Add a new entry (next version number, e.g. 12):
   ```js
   {
     version: 12,
     name: 'add_lead_statuses',
     up: (db) => {
       db.exec(`
         CREATE TABLE IF NOT EXISTS lead_statuses (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT NOT NULL UNIQUE,
           color TEXT NOT NULL,
           created_at DATETIME DEFAULT CURRENT_TIMESTAMP
         )
       `);
       try { db.exec("ALTER TABLE contacts ADD COLUMN status_id INTEGER REFERENCES lead_statuses(id);"); } catch (e) {}
       const seedStatuses = db.prepare('SELECT COUNT(*) AS count FROM lead_statuses').get().count;
       if (seedStatuses === 0) {
         const insert = db.prepare('INSERT INTO lead_statuses (name, color) VALUES (?, ?)');
         insert.run('Mới', '#2684ff');
         insert.run('Đang xử lý', '#ff6b2c');
         insert.run('Đã chốt', '#0fbd74');
       }
       console.log('[DB] Migration v12: Created lead_statuses table, added contacts.status_id, seeded starter statuses.');
     }
   }
   ```
   Mirror the same `CREATE TABLE`/column into `schema.sql` too (for brand-new installs that skip straight to the latest schema, matching how earlier tables like `inbox_sources` are present in both places).

2. **Backend - status CRUD** (`server.js`, near the existing `/api/contacts/:thread_id` routes):
   - `GET /api/lead-statuses` → `db.prepare('SELECT id, name, color FROM lead_statuses ORDER BY id ASC').all()`.
   - `POST /api/lead-statuses` → validate `name`/`color` present, `INSERT ... ON CONFLICT(name) DO NOTHING` (or a pre-check), return the row (existing or newly created) so the frontend can select it immediately either way.

3. **Backend - persist status_id on contacts** (`PUT /api/contacts/:thread_id`, `server.js`): add `status_id` to the destructured body and to the `INSERT ... ON CONFLICT DO UPDATE` statement, same pattern already used for `tags`/`notes`.

4. **Backend - join status into thread list** (`AssignmentManager.getThreadsByFilter()`): add `LEFT JOIN lead_statuses ls ON ls.id = c.status_id` and `ls.name AS status_name, ls.color AS status_color` to the existing `SELECT`/`LEFT JOIN contacts c` — no change to the function's filtering logic, purely additive to the SELECT list.

5. **Frontend - status picker** (`LeadDetailsPanel.jsx`): replace the `DetailRow icon={Activity} label="Trạng thái"` block's `normalizeLeadStatus`/`statusLabel`-driven `<select>`-like control with: a dropdown fetching `GET /api/lead-statuses` on mount (or lifted to `App.jsx` and passed down, matching how `accounts`/`threads` are already loaded once at the top level), showing each option with its color swatch; selecting one updates local state and flows into the existing `onSaveContact` payload as `status_id` (previously-dropped `status`/`lead_status` fields removed). A small "+ Tạo mới" affordance opens a compact inline form (name input + row of preset color swatches from `AVATAR_COLORS`) that calls `POST /api/lead-statuses`, then selects the result.

6. **Frontend - sidebar badge + filter** (`ConversationSidebar.jsx`): render a small colored dot/pill per thread using `thread.status_color`/`thread.status_name` (now present on every thread object via phase 4's join, no extra fetch). Add a status filter `<select>` next to the existing "Tất cả nguồn" one, populated from the same `GET /api/lead-statuses` list, filtering `filteredThreads` by `thread.status_id === selectedStatusId` when set — mirroring the existing source-filter's client-side `.filter()` exactly.

7. **Validation**: `npm run test:persistence` for the additive schema change (confirm no existing test breaks); manual test — create a status on one thread, confirm it's selectable (not retyped) on a different thread, confirm the sidebar badge/filter reflect it, confirm `threads.status`-driven tabs/completion are untouched.

## Safety Gates

- Additive-only schema change: new table, one new nullable column. No existing column renamed, no existing data touched.
- Do not modify `threads.status`, its CHECK constraint, or `AssignmentManager`'s tab-filtering `WHERE` clauses (FR-009) — only the `SELECT` list gains columns.
- Do not touch the hardcoded "TAGS" chip section in `LeadDetailsPanel.jsx` (FR-010) — separate, out of scope.
- Status creation must not create duplicate rows for the same name (FR-004) — reuse the existing row instead.
- The existing preset-only restriction is superseded by the 2026-08-13 color-picker change request below.


## Color Picker Replacement Increment (2026-08-13)

### Scope and component boundary

This increment replaces only the fixed color-dot row inside `LeadDetailsPanel.jsx`'s inline “Tạo trạng thái mới” form. The picker is conditionally mounted under `showCreateStatus`; it never appears while merely viewing or selecting an existing status. Existing dropdown, save-contact behavior, status filter, sidebar badge, and workflow status remain unchanged.

### Technical design

1. Add `react-colorful` and wrap its `HexColorPicker` in a project-owned `LeadStatusColorPicker.jsx`. The wrapper owns the popover/dialog semantics, labels, focus return, Escape/outside-click behavior, hex input, swatch, and Apply/Cancel controls.
2. Add `src/client/utils/color.js` with pure helpers to normalize and validate opaque six-digit hex values and derive readable foreground/ring colors for arbitrary backgrounds.
3. In `LeadDetailsPanel.jsx`, replace `AVATAR_COLORS.map(...)` with a color trigger and conditionally rendered picker. Keep two state layers:
   - committed create-form color: `newStatusColor`;
   - temporary picker color: `draftColor`.
4. Picker “Áp dụng” copies `draftColor` to `newStatusColor`. Picker “Hủy”, outside-click, or Escape closes without changing the committed form color. The outer “Tạo” button is the only persistence action.
5. Reset picker visibility, committed color, and draft color on outer Cancel, successful creation, active-contact change, and unmount. This prevents stale state and guarantees the picker exists only in creation mode.
6. Harden `POST /api/lead-statuses`: trim and normalize color, accept only `/^#[0-9A-F]{6}$/`, return HTTP 400 for malformed/alpha values. No schema migration is required because `lead_statuses.color` is already `TEXT NOT NULL`.
7. Reuse the normalized stored color in the current status dropdown and sidebar badge. Where text or focus rings sit on the chosen color, calculate contrast rather than assuming a preset palette.
8. Cover utilities, picker transaction behavior, lifecycle cleanup, API rejection, existing dropdown/status persistence, and sidebar rendering. Finish with build/persistence tests plus manual light/dark, narrow panel, keyboard, outside-click, and 200% zoom checks.

### File impact

`package.json`, lockfile, `src/client/components/LeadStatusColorPicker.jsx` (new), `src/client/components/LeadDetailsPanel.jsx`, `src/client/utils/color.js` (new), related frontend tests, `src/server/server.js`, and API tests.

### Non-goals

No editing colors of existing statuses, alpha channel, eyedropper, saved palettes, gradients, database migration, changes to tags, or changes to `threads.status`.
