# Quickstart

1. Stop all old backend processes and run `npm start`.
2. Build extension with `npm run build:extension`.
3. Load exactly `dist/extension` as unpacked and reload the Facebook tab.
4. Clear old drafts; send one unique text from CRM.
5. Verify logs in order: `pending`, stage attempt, DOM/result confirmation, `sent`.
6. Repeat with 10 unique texts and verify no duplicates.
7. Replay a DOM event and verify no exception and no extra row.
8. Run `npm run test:persistence` and outbound integration tests.
