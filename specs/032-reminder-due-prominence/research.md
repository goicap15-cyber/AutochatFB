# Research: Reminder Due Prominence

## Decision: Derive urgency from the existing active reminder

**Rationale**: Existing conversation data already carries the active reminder summary. A derived state cannot drift from completion or cancellation.

**Alternatives considered**: Persisting another urgency flag was rejected because it duplicates state.

## Decision: Filter first, then use stable due-first ordering

**Rationale**: Search, archive mode, workflow tabs and filters define the operator’s intended membership. Due state only prioritizes within that visible set and preserves relative activity order.

**Alternatives considered**: Injecting all due conversations into every view was rejected because it breaks filtering trust; sorting solely by scheduled time was rejected because it needlessly reshuffles items.

## Decision: Layer accessible cues

**Rationale**: Card tint and edge treatment support scanning, a bell gives recognizable shape, and text conveys urgency without relying on color or motion.

**Alternatives considered**: A small chip only was rejected because it is too easy to miss; animation alone was rejected for accessibility and distraction.

## Decision: Keep future reminders calm

**Rationale**: Scheduled future work should remain visible but not compete with overdue work.
