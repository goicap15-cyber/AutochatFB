# Research: CRM VIP Quick Action

## Decision 1: VIP is a case-insensitive contact tag

- **Decision**: Treat \`VIP\` as a standard contact tag and reuse existing tag parse/toggle/validation/persistence behaviour. A legacy spelling such as \`vip\` is recognized as VIP rather than adding another value.
- **Rationale**: The CRM already persists a multi-tag contact value, preserves other tags, handles a maximum tag count and rolls back failed updates. A separate VIP field would duplicate data and create inconsistent filtering later.
- **Alternatives considered**:
  - Create a dedicated VIP boolean — rejected because it duplicates the meaning of a tag and needs data migration/filter reconciliation.
  - Add VIP as a fixed starter tag — not required; the quick action itself is the discoverable entry point, while existing tag UX remains general purpose.

## Decision 2: Reuse optimistic tag saving and isolate stale responses

- **Decision**: The VIP button updates immediately, prevents another tag mutation while saving, and restores the prior tag list on a failed save. Each operation is bound to the customer active when it starts; a response for an old customer is ignored after the operator switches contact.
- **Rationale**: The existing tag workflow has the correct rollback semantics. The customer identity guard closes the remaining race where an old request could change the new customer's saving/error state.
- **Alternatives considered**:
  - Wait for persistence before visual feedback — rejected because the current tag UX is intentionally optimistic and would make the quick action feel slow.
  - Leave the optimistic state on failure — rejected because it falsely says the customer is VIP.

## Decision 3: Preserve all other quick actions

- **Decision**: Do not add behavior to Gọi, Nhắc or Lưu, and do not introduce call history, reminder, archive, backend route or schema change.
- **Rationale**: This increment delivers one complete, low-risk workflow without bringing unapproved external-call behavior into the CRM.
