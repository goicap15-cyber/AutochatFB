# Research: Advanced Conversation Filters

## Decision: Expand the existing applied/draft filter model

**Rationale**: The current filter already separates draft changes from applied state and sanitizes removed options. Extending that pattern preserves safe cancellation and avoids premature list changes.

**Alternatives considered**: Immediate filtering on every click was rejected because it makes experimentation and manual-rule editing disruptive.

## Decision: Match entirely against loaded conversation summaries

**Rationale**: The inbox is already loaded locally. Adding tags and contact-presence fields to the existing summary keeps filtering immediate and avoids a request for every interaction.

**Alternatives considered**: A server search endpoint per filter change was rejected for latency and unnecessary complexity at current inbox scale.

## Decision: Use grouped selection plus an explicit rule builder

**Rationale**: Groups make frequent options fast to use while a field/operator/value row handles unusual segmentation. OR within a multi-value group and AND across groups/rules matches operator expectation.

**Alternatives considered**: A free-form query language was rejected because it is harder to discover and validate.

## Decision: Make the filter responsive

**Rationale**: A narrow anchored popover cannot safely contain many groups and manual rules. Desktop uses a wide anchored panel; constrained layouts use a scrollable dialog/drawer with the same draft behavior.

## Decision: Preserve existing list pipeline

**Rationale**: Archive scope, search, workflow tab and custom filter determine membership; Spec 032 due ordering remains the final presentation priority after matching.
