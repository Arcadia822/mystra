---
name: spec-kit-workflow
description: Routes Mystra work through Spec-Kit commands and the project-local skill set. Use at the start of Mystra sessions and before any feature, contract, implementation, review, or shipping work.
---

# Spec-Kit Workflow

## Purpose

This is Mystra's project-local workflow router. It replaces the generic
`using-agent-skills` name because this repository is governed by Spec-Kit, 5xP,
and the project-local skill set under `.agents/skills/`.

For non-trivial feature work, product-boundary changes, API/runner contract
changes, persistence changes, or implementation plans, do not create standalone
PRDs or plans under `docs/`. Use the Spec-Kit feature directory:

```text
specs/<###-feature>/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── tasks.md
└── checklists/
```

Durable project rules belong in the 5xP files. Feature-specific artifacts belong
in `specs/<###-feature>/`.

When creating or updating requirements, use the project-local
`product-requirements` skill as the requirements-quality lens before declaring
the spec ready. Adapt its scoring and clarification process to Spec-Kit, but do
not follow its generic `docs/{feature-name}-prd.md` output path.

## Required Context

Before routing work, load only the smallest useful context:

- `AGENTS.md` for top-level routing and project boundaries.
- `PROCESS.md` for Spec-Kit commands and quality gates.
- `.specify/memory/constitution.md` for non-negotiable project principles.
- Relevant 5xP files only when the request needs them.

## Spec-Kit Command Binding

Mystra has project-local Codex prompts and Spec-Kit scripts. Prefer these over
generic skill templates whenever a Spec-Kit phase applies.

| Phase | Command prompt | Script / source of truth | Output |
|---|---|---|---|
| Constitution | `.codex/prompts/speckit.constitution.md` | `.specify/memory/constitution.md` | constitution updates |
| Specify | `.codex/prompts/speckit.specify.md` | `.specify/scripts/bash/create-new-feature.sh` + `.specify/templates/spec-template.md` | `specs/<feature>/spec.md` |
| Clarify | `.codex/prompts/speckit.clarify.md` | active `spec.md` | clarified `spec.md` |
| Plan | `.codex/prompts/speckit.plan.md` | `.specify/scripts/bash/setup-plan.sh` + `.specify/templates/plan-template.md` | `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` |
| Engineering Review | project-local `plan-eng-review` skill | `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, GitNexus context when useful | review findings in `plan.md` or `checklists/engineering-review.md` |
| Tasks | `.codex/prompts/speckit.tasks.md` | `.specify/scripts/bash/check-prerequisites.sh` + `.specify/templates/tasks-template.md` | `tasks.md` |
| Analyze | `.codex/prompts/speckit.analyze.md` | `spec.md`, `plan.md`, `tasks.md` | consistency report/fixes |
| Implement | `.codex/prompts/speckit.implement.md` | `tasks.md` | small verified slices |
| Checklist | `.codex/prompts/speckit.checklist.md` | `.specify/templates/checklist-template.md` | `checklists/*.md` |

If the user asks for "PRD", "plan", "tasks", or "implementation" for a feature,
map that request to the closest Spec-Kit phase instead of inventing a parallel
document path.

## Routing

Use this decision table after loading the required context:

| Request shape | Primary path | Supporting skill |
|---|---|---|
| Vague product idea | Refine the idea, then run `/speckit.specify` when concrete | `idea-refine` |
| New feature or contract change | `/speckit.specify` | `product-requirements`, `spec-driven-development` |
| Existing spec needs technical design | `/speckit.plan` | `spec-driven-development`, `api-and-interface-design` when contracts are involved |
| Existing plan needs engineering validation | `plan-eng-review` after `/speckit.plan` and before `/speckit.tasks` | `gitnexus-exploring`, `gitnexus-impact-analysis`, `api-and-interface-design` when contracts are involved |
| Existing plan needs work items | `/speckit.tasks` only after engineering review is complete or explicitly waived | `planning-and-task-breakdown` |
| Consistency risk before build | `/speckit.analyze` | `code-review-and-quality` |
| Implementation | `/speckit.implement`, one task slice at a time | `incremental-implementation`, `test-driven-development` |
| UI implementation | `/speckit.implement` plus UI skill | `frontend-ui-engineering` |
| API/runner/persistence contract | Spec/plan first, then implementation | `api-and-interface-design` |
| Source-doc-sensitive change | Spec/plan first, then source verification | `source-driven-development` |
| Bug fix | Reproduce and fix; create/update spec only if behavior contract changes | `debugging-and-error-recovery` |
| Tests | Add or update focused tests tied to spec acceptance criteria | `test-driven-development` |
| Review | Review against spec, plan, tasks, and constitution | `code-review-and-quality` |
| Security concern | Review/fix with explicit boundary and least-privilege checks | `security-and-hardening` |
| Performance concern | Measure first, then tune | `performance-optimization` |
| CI/CD | Keep gates aligned with Spec-Kit verification | `ci-cd-and-automation` |
| Docs/ADR | 5xP for durable rules, `specs/<feature>/` for feature docs | `documentation-and-adrs` |
| Git operations | Keep feature artifacts and code in coherent commits | `git-workflow-and-versioning` |
| Launch/deploy | Confirm spec acceptance and rollback evidence | `shipping-and-launch` |

## Non-Negotiable Rules

1. Never place feature-level PRDs, plans, or tasks directly under `docs/`.
2. Never use the generic spec template when `.specify/templates/` has the
   project template for that phase.
3. Never skip `product-requirements` when creating or materially updating
   requirements. Use its quality scoring and clarification loop, require a
   90+ score before planning when practical, and record the score in
   `specs/<feature>/checklists/requirements.md`. If the score remains below 90,
   record the gaps and do not proceed to planning without explicit owner
   acceptance.
4. Never skip `.specify/memory/constitution.md` for product-boundary,
   persistence, runner, sandbox, API, or MCP changes.
5. Never proceed from specify to plan to tasks when the previous artifact is
   missing or materially incomplete.
6. Never split implementation tasks for non-trivial architecture, API, runner,
   sandbox, persistence, or provider-boundary work until `plan-eng-review` has
   reviewed the generated plan. If review is intentionally skipped, record the
   owner acceptance and reason in the feature directory.
7. If requirements conflict with the constitution, stop and report the conflict.
8. Use GitNexus during plan and engineering-review phases when the feature
   touches existing code paths, symbols, execution flows, provider boundaries,
   persistence, API/MCP contracts, or runner behavior. Record what GitNexus was
   used for, or why it was not useful for the phase.
9. If a task edits code symbols, follow the GitNexus impact-analysis rules from
   `AGENTS.md` before editing.
10. Preserve unrelated user changes and local workspace noise.

## Phase Gates

### Specify Gate

- Feature directory is under `specs/<###-feature>/`.
- `spec.md` follows `.specify/templates/spec-template.md`.
- `checklists/requirements.md` exists when specification quality was evaluated.
- `checklists/requirements.md` includes the `product-requirements` quality
  score or explicitly states why scoring could not be completed.
- Open questions are either resolved or explicitly marked for clarification.

For low-level architecture, framework, provider-boundary, persistence, or runner
contract changes, do not force consumer-style user stories when they obscure the
work. Use the mandatory Spec-Kit "User Scenarios & Testing" section as
"Technical Scenarios & Validation" in substance: name the actor as a platform
operator, internal caller, runner maintainer, provider implementer, or future
agent; describe the independently testable capability; and keep acceptance
scenarios concrete. The requirement is independently testable slices, not
theatrical user-story prose.

### Plan Gate

- `plan.md` is generated from `.specify/templates/plan-template.md`.
- Constitution checks are explicit.
- Technical context, risks, dependencies, and verification checkpoints are
  concrete.
- Generated artifacts live beside the spec, not in `docs/`.
- For plans that touch existing code, APIs, MCP tools, persistence, runner
  behavior, sandbox/provider boundaries, or cross-package contracts, use
  GitNexus before finalizing the plan:
  - Refresh or check the index when stale, using `npx gitnexus analyze` when
    needed.
  - Use `gitnexus-exploring` / `gitnexus_query` to understand current execution
    flows before inventing new structure.
  - Use `gitnexus-impact-analysis` / `gitnexus_impact` for important existing
    symbols or contract surfaces referenced by the plan.
  - Record the relevant flows/symbols and key findings in `plan.md`, or record
    why GitNexus was not applicable.

### Engineering Review Gate

- Run project-local `plan-eng-review` after `/speckit.plan` and before
  `/speckit.tasks` for non-trivial feature, architecture, runner, API,
  persistence, sandbox, provider, or cross-package contract changes.
- Review against `spec.md`, `plan.md`, `research.md`, `data-model.md`,
  `contracts/`, `.specify/memory/constitution.md`, and relevant 5xP files.
- Use GitNexus when the review needs current-code evidence about existing
  architecture, blast radius, execution flows, or symbol ownership. Prefer:
  - `gitnexus-exploring` for "how does this currently work?"
  - `gitnexus-impact-analysis` for "what breaks if this plan changes X?"
  - `gitnexus-debugging` when the plan responds to a concrete failure path.
- Record findings, required plan changes, open questions, and waived risks in
  `plan.md` or `checklists/engineering-review.md`.
- Do not proceed to `/speckit.tasks` until critical review findings are resolved
  or explicitly accepted by the owner.

### Tasks Gate

- `tasks.md` is generated from `.specify/templates/tasks-template.md`.
- The Engineering Review Gate is complete or explicitly waived.
- Tasks are grouped by user story when applicable.
- Each task has acceptance and verification criteria.
- Dependencies and parallelization boundaries are explicit.
- Review findings are translated into concrete tasks, verification checks, or
  explicit non-goals.

### Implementation Gate

- Implement from `tasks.md`, not from memory.
- Keep changes small and verifiable.
- Run the narrowest relevant verification first, then broader checks when the
  touched surface justifies it.

## Local Skill Inventory

The workflow expects these project-local skills to exist under `.agents/skills/`:

- `product-requirements`
- `plan-eng-review`
- `idea-refine`
- `spec-driven-development`
- `planning-and-task-breakdown`
- `incremental-implementation`
- `frontend-ui-engineering`
- `api-and-interface-design`
- `source-driven-development`
- `test-driven-development`
- `debugging-and-error-recovery`
- `code-review-and-quality`
- `security-and-hardening`
- `performance-optimization`
- `git-workflow-and-versioning`
- `ci-cd-and-automation`
- `documentation-and-adrs`
- `shipping-and-launch`
- `context-engineering`
- `browser-testing-with-devtools`

If one is missing, restore the project-local copy before relying on the global
fallback. Global fallback skills are not allowed to override Mystra's Spec-Kit
directory structure.
