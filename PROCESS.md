# Mystra Process

## Context Loading

Use the smallest context set that can answer the task.

- Product or scope decisions: read `PRODUCT.md`, then `docs/SPEC.md`.
- Stack or architecture decisions: read `PLATFORM.md`, then `docs/ARCHITECTURE.md`.
- Workflow and quality decisions: read this file, then `docs/IMPLEMENTATION-PLAN.md`.
- Runner or deployment work: also read `docs/RUNNER-ENVIRONMENT.md` and relevant ADRs.

## 5xP and Spec-Kit Workflow

The project uses 5xP for durable project context and Spec-Kit for feature-level specification-driven development.

The current product boundary is Open Agents source-authoritative baseline reuse with Mystra-owned interfaces at provider and orchestration seams, plus local-first implementations: SQLite RDB, local workflow, and single-machine Docker sandbox.

1. Use `AGENTS.md` to route the work through `spec-kit-workflow` and identify the relevant project-local skill/process.
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
   - A durable rule now in force: treat Open Agents as a source-authoritative framework baseline and reference architecture, not as a packaged SDK with complete extension interfaces for Mystra surfaces.
   - Another durable rule now in force: prefer neutral platform language such as `Mystra platform`, `workspace`, and `project` over company/customer-specific tenancy terms in project-wide docs and specs.
5. Keep feature-specific requirements inside Spec-Kit specs, plans, tasks, and generated design artifacts.
6. Do not create feature-level PRDs, plans, task lists, or generated design artifacts directly under `docs/`; use `specs/<feature>/`.
7. If a submodule needs durable operating knowledge, add the smallest useful local documentation near that submodule and link it from the relevant Spec-Kit artifact or 5xP file.

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
speckit.specify -> speckit.clarify -> speckit.plan -> plan-eng-review -> speckit.tasks -> speckit.analyze -> implementation -> focused tests -> broader validation -> code-review-and-quality -> merge
```

Run `plan-eng-review` after `speckit.plan` and before `speckit.tasks` for
non-trivial architecture, API/MCP, persistence, runner, sandbox/provider, or
cross-package contract work. If the review is skipped, record the owner
acceptance and reason in the feature directory.

## Quality Gates

- Prefer shared Zod schemas for service-boundary contracts.
- Add tests for shared contract changes, state transitions, runner protocol changes, and persistence behavior.
- During plan and engineering-review phases, use GitNexus when the work touches
  existing code paths, symbols, execution flows, persistence, API/MCP contracts,
  runner behavior, or sandbox/provider boundaries. Record the explored flows,
  impacted symbols, and important findings in the Spec-Kit artifact, or state
  why GitNexus was not applicable.
- Resolve critical `plan-eng-review` findings before task decomposition, or
  record an explicit owner waiver.
- Run the narrowest relevant test first, then broader checks when the touched surface justifies it.
- For broad changes, run `pnpm typecheck` and `pnpm test`.
- Before merge, run the project-local `code-review-and-quality` review gate. Treat review findings as part of delivery, not optional cleanup.
- Do not introduce MVP-excluded behavior unless the product boundary is explicitly amended first.

## Documentation Quality

Mystra is built by AI agents, so documentation is part of the runtime safety model rather than decoration.

- Every non-trivial feature must have Spec-Kit artifacts under `specs/<feature>/`.
- Every service boundary change must document the contract owner, request/response shape, persistence impact, and verification command.
- Every submodule touched by a feature should have enough nearby documentation for a future agent to understand purpose, commands, configuration, and invariants without relying on chat history.
- Prefer small local docs in the affected directory when knowledge is module-specific; prefer 5xP files only for durable project-wide rules.
- Keep docs, specs, tests, and runtime behavior aligned in the same change set when practical.
- If implementation deviates from a spec or plan, update the Spec-Kit artifact before declaring completion.

## Git Discipline

- Keep changes scoped to the requested work.
- Do not include `.obsidian/` or other local workspace noise in feature commits unless explicitly requested.
- Preserve user changes. Do not revert unrelated files.
