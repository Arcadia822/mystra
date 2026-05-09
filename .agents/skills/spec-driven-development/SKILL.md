---
name: spec-driven-development
description: Mystra-specific Spec-Kit workflow for creating and maintaining feature specifications, plans, tasks, and implementation gates.
---

# Spec-Driven Development

## Mystra Binding

In Mystra, "spec-driven development" means the project-local Spec-Kit workflow.
Do not use a generic PRD or plan format when a Spec-Kit phase applies.

Required local sources:

- `.codex/prompts/speckit.specify.md`
- `.codex/prompts/speckit.clarify.md`
- `.codex/prompts/speckit.plan.md`
- `.codex/prompts/speckit.tasks.md`
- `.codex/prompts/speckit.analyze.md`
- `.codex/prompts/speckit.implement.md`
- `.specify/memory/constitution.md`
- `.specify/templates/spec-template.md`
- `.specify/templates/plan-template.md`
- `.specify/templates/tasks-template.md`
- `.specify/scripts/bash/create-new-feature.sh`
- `.specify/scripts/bash/setup-plan.sh`
- `.specify/scripts/bash/check-prerequisites.sh`

Feature artifacts must live under:

```text
specs/<###-feature>/
```

Never create feature PRDs, implementation plans, task lists, contracts, or
generated design artifacts directly under `docs/`.

## When To Use

Use this skill for:

- New features.
- Contract changes across API, MCP, runner protocol, persistence, sandbox, or
  workflow boundaries.
- Product-boundary changes.
- Architecture or provider decisions.
- Work that needs a plan before code.

Do not use it for isolated typo fixes or single-line changes that do not alter
behavior or contracts.

## Phase Flow

### 1. Specify

Use `.codex/prompts/speckit.specify.md` as the instruction source.

Expected behavior:

1. Generate a short feature name.
2. Run `.specify/scripts/bash/create-new-feature.sh --json --short-name "<name>" "<description>"` from repo root when creating a new feature.
3. Parse the JSON output for `BRANCH_NAME`, `SPEC_FILE`, and `FEATURE_NUM`.
4. Fill `SPEC_FILE` using `.specify/templates/spec-template.md`.
5. Create or update `checklists/requirements.md` when validating spec quality.

If updating an existing feature, use the existing `specs/<feature>/spec.md`
instead of creating a parallel directory.

### 2. Clarify

Use `.codex/prompts/speckit.clarify.md` when requirements are ambiguous.

Clarification is required before planning when a decision materially affects:

- MVP boundary.
- User-visible behavior.
- Security or secrets.
- Persistence model.
- API, MCP, runner, sandbox, or provider contracts.

### 3. Plan

Use `.codex/prompts/speckit.plan.md` as the instruction source.

Expected behavior:

1. Run `.specify/scripts/bash/setup-plan.sh --json`.
2. Parse `FEATURE_SPEC`, `IMPL_PLAN`, `SPECS_DIR`, and `BRANCH`.
3. Load `.specify/memory/constitution.md`.
4. Fill `plan.md` from `.specify/templates/plan-template.md`.
5. Generate supporting artifacts as applicable:
   - `research.md`
   - `data-model.md`
   - `quickstart.md`
   - `contracts/`
6. Re-check constitution gates after design.

### 4. Tasks

Use `.codex/prompts/speckit.tasks.md` as the instruction source.

Expected behavior:

1. Run `.specify/scripts/bash/check-prerequisites.sh --json`.
2. Load available feature docs from the returned `FEATURE_DIR`.
3. Generate `tasks.md` from `.specify/templates/tasks-template.md`.
4. Organize tasks by user story when applicable.
5. Include acceptance criteria, verification, dependencies, and parallelization
   notes.

### 5. Analyze

Use `.codex/prompts/speckit.analyze.md` before implementation when consistency
risk is meaningful.

Analyze `spec.md`, `plan.md`, and `tasks.md` against the constitution. Fix
critical inconsistencies before implementation.

### 6. Implement

Use `.codex/prompts/speckit.implement.md` and implement from `tasks.md` in small
verified slices.

For code-symbol edits, obey the GitNexus rules in `AGENTS.md` before editing.
For contract work, use `api-and-interface-design`. For tests, use
`test-driven-development`.

## Verification

Before claiming a Spec-Kit phase is complete, confirm:

- Artifacts are under `specs/<feature>/`.
- The phase used the corresponding `.codex/prompts/speckit.*.md` instructions.
- The relevant `.specify/templates/` template was used.
- The constitution was checked when the work touches project boundaries.
- The next phase has the files it expects.

If any item fails, report the exact gap and fix it before continuing.
