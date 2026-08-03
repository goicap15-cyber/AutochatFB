## Mandatory Project Policies

### 1. Always Read Rules First
- At the start of every task or implementation, inspect `AGENTS.md` and `PROJECT_RULES.md` before writing code.

### 2. Spec-Driven Development (Spec Kit Workflow)
- Every feature development or structural change MUST follow the Spec Kit SDD process:
  - `/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks` -> `/speckit.implement` -> `/speckit.converge`

### 3. Maintain Knowledge Graph (Graphify)
- This project has a knowledge graph at `graphify-out/`.
- For codebase questions, use `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"`.
- **MANDATORY**: After modifying code or changing architecture, run `graphify update .` to keep the graph current.

### 4. UI/UX Pro Max Design Rules
- Follow UI/UX design intelligence guidelines from `ui-ux-pro-max` skill for all UI components, pages, design tokens, color schemes, typography, and responsive layouts.
