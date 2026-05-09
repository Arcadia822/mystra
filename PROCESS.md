# Mystra Process

## Context Loading

Use the smallest context set that can answer the task.

- Product or scope decisions: read `PRODUCT.md`, then `docs/SPEC.md`.
- Stack or architecture decisions: read `PLATFORM.md`, then `docs/ARCHITECTURE.md`.
- Workflow and quality decisions: read this file, then `docs/IMPLEMENTATION-PLAN.md`.
- Runner or deployment work: also read `docs/RUNNER-ENVIRONMENT.md` and relevant ADRs.

## 5xP and Spec-Kit Workflow

The project uses 5xP for durable project context and Spec-Kit for feature-level specification-driven development.

The current product boundary is Open Agents framework reuse with local-first providers: SQLite RDB, dummy workflow, and single-machine Docker sandbox.

1. Use `AGENTS.md` to route the work and identify the relevant skill/process.
2. Use the 5xP root files for stable project context:
   - `PRODUCT.md`
   - `PLATFORM.md`
   - `PROCESS.md`
   - `PROFILE.md`
   - `AGENTS.md`
3. Use Spec-Kit for feature artifacts:
   - `.specify/memory/constitution.md`
   - `.specify/templates/`
   - `.specify/scripts/`
   - `specs/<feature>/`
4. Update 5xP files only when a durable project rule changes.
5. Keep feature-specific requirements inside Spec-Kit specs, plans, tasks, and generated design artifacts.

## Spec-Kit Commands

Codex prompt files are initialized in `.codex/prompts/`:

```text
speckit.constitution
speckit.specify
speckit.clarify
speckit.plan
speckit.tasks
speckit.analyze
speckit.checklist
speckit.implement
speckit.taskstoissues
```

Recommended flow for new work:

```text
speckit.specify -> speckit.clarify -> speckit.plan -> speckit.tasks -> speckit.analyze -> implementation -> tests/review
```

## Quality Gates

- Prefer shared Zod schemas for service-boundary contracts.
- Add tests for shared contract changes, state transitions, runner protocol changes, and persistence behavior.
- Run the narrowest relevant test first, then broader checks when the touched surface justifies it.
- For broad changes, run `pnpm typecheck` and `pnpm test`.
- Do not introduce MVP-excluded behavior unless the product boundary is explicitly amended first.

## Git Discipline

- Keep changes scoped to the requested work.
- Do not include `.obsidian/` or other local workspace noise in feature commits unless explicitly requested.
- Preserve user changes. Do not revert unrelated files.
