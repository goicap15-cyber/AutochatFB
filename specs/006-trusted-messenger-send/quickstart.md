# Quickstart

1. Stop old backend processes and run `npm start`.
2. Build with `npm run build:extension`.
3. Load exactly `dist/extension` unpacked and reload the Messenger tab.
4. Enable the replacement feature flag.
5. Send one unique text; verify poll → click → confirmation.
6. Force click timeout; verify one CDP Enter fallback and one confirmation.
7. Replay the confirmation; verify no duplicate row.
8. Disable the flag and verify the rollback path starts without changing stored history.
9. Run `npm run test:persistence` and outbound integration tests.
