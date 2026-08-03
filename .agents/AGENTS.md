# Agent Instructions & Execution Rules

These rules apply to all AI agent executions in this project (`autochatbot`).

## Mandatory Core Rules

### 1. Always Read Rules First
- At the start of every task or coding session, read `AGENTS.md` and `PROJECT_RULES.md` before analyzing code or writing implementation.

### 2. Follow Spec Kit Workflow
- All new feature implementations and major architecture changes MUST follow Spec-Driven Development:
  - Phase 1: `/speckit.specify` (Requirements)
  - Phase 2: `/speckit.plan` (Architecture & Plan)
  - Phase 3: `/speckit.tasks` (Task Breakdown)
  - Phase 4: `/speckit.implement` (Code Implementation)
  - Phase 5: `/speckit.converge` (Verification)

### 3. Maintain Knowledge Graph (Graphify)
- Use `graphify query`, `graphify path`, or `graphify explain` to explore codebase dependencies and structure.
- **MANDATORY**: Run `graphify update .` after making any code or architecture changes to keep the graph up to date.

### 4. Apply UI/UX Pro Max Design Intelligence
- When building or modifying UI, consult the `ui-ux-pro-max` skill.
- Enforce 3-layer design tokens, accessible color palettes, responsive layouts, micro-animations, and ARIA standards.
