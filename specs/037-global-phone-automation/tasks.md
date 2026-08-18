# Tasks: Global Phone Automation

- [X] T001 Add singleton schema/migration and global automation service.
- [X] T002 Validate enabled/target settings and add read/write API.
- [X] T003 Apply global target on inbound capture before campaign-specific override.
- [X] T004 Add focused tests for disabled state, global conversion, and campaign precedence.
- [X] T005 Add accessible CRM navigation modal with toggle, target status selector, and save feedback.
- [X] T006 Build UI and apply migration to the real local database.
- [X] T007 Run full persistence suite and production UI build.
- [ ] T008 [manual] Verify with a connected Page/customer pair that an ordinary inbound number updates the visible sidebar chip without refresh.

## Verification

- Focused global automation tests: 4/4 pass.
- `npm run test:persistence`: 260/260 pass.
- `npm run build:ui`: passed.
- Local database migration v22 applied successfully.
- Manual Page check intentionally remains open.
