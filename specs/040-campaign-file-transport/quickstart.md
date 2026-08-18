# Quickstart: Campaign File Transport

**Status (2026-08-17)**: describes the verification steps for the FINISHED feature (T005–T021 in `tasks.md`). Not runnable yet — `tests/integration/campaignFileTransport.test.js` referenced below does not exist, and folder/multi-file/personal-route dispatch is not implemented. Keep this file as the target checklist; re-verify and update once those tasks land, per T025.

## Automated validation

```bash
node --check src/server/server.js
node --check src/extension/background.js
node --test tests/integration/campaignFileTransport.test.js
npm run test:persistence
npm run build:all
```

Expected: arbitrary files validate before queueing; folders become one ZIP manifest; Page/personal routes remain distinct; dispatch stays pending/processing until matching Facebook confirmation; duplicate or local-only observations do not confirm.

## Manual acceptance

1. Send PDF, DOCX, ZIP, and an image through a Page route.
2. Send the same manifest through a personal route only after its feature flag and live verification are enabled.
3. Select a nested folder and verify ZIP contents, relative paths, file count, and total size.
4. Change tab identity during upload and verify fail-closed behavior.
5. Replay confirmation and verify no duplicate message or attempt.
