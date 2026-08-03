# Project Rules & Development Guidelines

This document defines mandatory guidelines for all AI agents and developers working on this project (`autochatbot`).

---

## 1. Mandatory Pre-Flight Checklist
Before writing code or initiating changes:
- Read `AGENTS.md` and `PROJECT_RULES.md` to understand project rules and standards.
- Check Graphify knowledge graph (`graphify query "<question>"`) before exploring raw codebase files.

---

## 2. Spec-Driven Development (Spec Kit Workflow)
All feature additions and significant changes MUST follow the **Spec Kit** workflow:
1. **Constitution** (`/speckit.constitution`): Verify non-negotiable project principles.
2. **Specification** (`/speckit.specify`): Define requirements and user intent clearly before technical planning.
3. **Plan** (`/speckit.plan`): Create technical implementation plan and architecture design.
4. **Tasks** (`/speckit.tasks`): Break down the plan into small, executable task steps.
5. **Implement** (`/speckit.implement`): Write code strictly according to the generated tasks.
6. **Converge** (`/speckit.converge`): Verify implementation completeness against specifications.

---

## 3. Knowledge Graph Maintenance (Graphify)
- Query the graph first for codebase structure questions: `graphify query`, `graphify path`, `graphify explain`.
- **MANDATORY**: After modifying code or making architectural changes, always execute `graphify update .` to keep the graph current (AST-only update).

---

## 4. UI/UX Excellence (UI/UX Pro Max Rules)
When creating or updating user interfaces:
- **Design Tokens**: Follow a 3-layer token system (primitive → semantic → component) with clean CSS variables.
- **Styling**: Avoid generic colors or unstyled browser defaults; use curated palettes (HSL/Tailwind), modern typography, smooth gradients, and subtle micro-animations.
- **Accessibility**: Ensure proper ARIA labels, keyboard focus states, contrast ratios, and responsive breakpoints across desktop and mobile.
- **Design Intelligence**: Consult the `ui-ux-pro-max` skill database for layout patterns, chart choices, icon sets, and component states.

---

## 5. Documentation & AGENTS.md Adherence
- Always consult `AGENTS.md` and project rules at the start of any implementation turn.
- Keep documentation up to date alongside code modifications.
