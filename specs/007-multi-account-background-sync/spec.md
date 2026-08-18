# Feature Specification: Multi-Account Background Messenger Sync

**Feature Branch**: `007-multi-account-background-sync`  
**Created**: 2026-08-04  
**Status**: Draft

## User Stories

### US1 — CRM updates receiver account without manual Messenger interaction (P1)

When a managed Facebook account receives a new Messenger message, CRM updates that account's conversation list and active chat without the operator opening Messenger, reloading the Messenger tab, or sending a seed message.

**Acceptance scenarios**:

1. Given accounts A and B are connected, when A sends a Messenger message to B, then B's CRM conversation moves to the top with the new preview after the next background sync cycle.
2. Given B's conversation is open in CRM, when B receives a new Messenger message, then the chat panel receives the new message after background sync.
3. Given B's browser profile is connected but the operator is not interacting with Messenger, background sync still runs through the profile's Messenger tab.

### US2 — Safe multi-account isolation (P2)

The system must not mix thread/message updates between Facebook accounts.

**Acceptance scenarios**:

1. Given two accounts have active extension connections, sync requests are sent only to the target account connection.
2. Given a thread update is received from account B, only B's CRM thread list entry is updated.
3. Given a background sync is already running for a thread, duplicate sync requests are throttled.

### US3 — Observable background sync lifecycle (P3)

Operators and developers can diagnose whether an account is connected, syncing sidebar, detecting changed threads, syncing messages, or throttled.

## Functional Requirements

- **FR-001**: Backend MUST schedule `SYNC_THREADS` for each connected account without waiting for manual UI interaction.
- **FR-002**: Backend MUST rate-limit account-level sidebar sync to avoid flooding Messenger/extension.
- **FR-003**: Backend MUST compare incoming sidebar snapshots with existing persisted thread preview/activity and identify changed threads.
- **FR-004**: Backend MUST enqueue `SYNC_THREAD_MESSAGES` for changed threads when a connected account owns that thread.
- **FR-005**: Backend MUST suppress duplicate message sync jobs for the same account/thread within a short cooldown.
- **FR-006**: Extension MUST ensure a usable Messenger/Facebook messages tab exists for background sync.
- **FR-007**: Extension MUST log sync failures with bounded reason codes, without leaking cookies/tokens.
- **FR-008**: CRM UI MUST update list/chat from backend events without requiring page reload.
- **FR-009**: Existing trusted-send behavior MUST remain unchanged.
- **FR-010**: Any account/thread identity enhancement MUST be backward compatible with existing rows.

## Success Criteria

- **SC-001**: With two connected accounts, a new incoming message appears in the receiver account's CRM list within 30 seconds in manual E2E testing.
- **SC-002**: Active receiver chat updates without opening Messenger manually.
- **SC-003**: Backend logs show account sync cycle, changed-thread detection, message-sync dispatch, and sync result.
- **SC-004**: Existing CRM sends still follow pending → DOM correlated → sent lifecycle without duplicate text.

## Scope

Included: text/list/message background synchronization for already connected Facebook profiles.  
Excluded: mobile push integration, official Meta APIs, attachment download changes, and full destructive DB primary-key migration.
