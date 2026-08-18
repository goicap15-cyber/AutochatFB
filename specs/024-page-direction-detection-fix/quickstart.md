# Quickstart: Validate Page Direction Detection

## Automated Checks

Run from the repository root:

npm run test:persistence
npm run build:ui
node --check src/extension/page_content.js
node --check src/server/repositories/ConversationRepository.js
node --check src/server/server.js

Expected result: persistence tests pass, the UI build succeeds, and syntax checks exit successfully.

## Schema and Pending Check

1. Start the backend with npm start so the normal database migration runs.
2. Confirm existing rows have direction_status=confirmed after migration.
3. Feed or observe a Page message with deliberately unavailable geometry.
4. Confirm exactly one row is retained with direction_status=pending and is_outgoing=0 as a placeholder.
5. Confirm the CRM does not render that row as a left/incoming bubble.
6. Provide a later high-confidence edge observation and confirm the same fb_message_id is promoted to confirmed without a duplicate.

## Live Direction Check

1. Reload the unpacked extension and open Business Suite thread 100092115712908.
2. Capture a scan where only the recent outgoing window is mounted.
3. Confirm high-confidence outgoing results for what, ok khong, 123456, 31321, dadadadada, and khoai qua.
4. Confirm a null midpoint or missing container produces unknown, not incoming.
5. Scroll until an incoming message is mounted and confirm high-confidence incoming results.
6. Repeat scans and confirm row count does not increase.

## Historical Verification

Read-only inspect the six known fb_message_id values first. The old manual backup is evidence of a prior correction, not a substitute for current verification. Create a new backup before any targeted repair. Do not flip every inbound row in a Page thread.

## Regression

Run side-by-side checks on at least two other Page threads for direction, chronological order, and repeated identical text. Confirm personal Messenger still uses content.js and Page sends still use the existing queue. Leave the extension running for 10 minutes and reload the server once.
