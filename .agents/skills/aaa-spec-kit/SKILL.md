---
name: aaa-spec-kit
description: Route feature work through Spec-Kit commands and 5xP project context. Use at the start of sessions that need requirements, planning, implementation, review, or shipping work governed by Spec-Kit.
---

# AAA Spec-Kit

## Purpose

Use this skill as a generic workflow router for repositories that use 5xP for
durable context and Spec-Kit for feature-level development.

For non-trivial feature work, product-boundary changes, API or runtime contract
changes, persistence changes, packaging changes, or implementation plans, do not
create standalone PRDs or task lists in arbitrary documentation paths. Use the
repository's Spec-Kit feature directory:

```text
specs/<feature>/
├── index.html
├── spec.md
├── features.md
├── checklists.md
├── README.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── prototype.md
├── mockups/
├── contracts/
├── tasks.md
└── checklists/
```

Durable repository rules belong in 5xP files. Feature-specific artifacts belong
under `specs/<feature>/`.

Each feature should also expose a user-readable HTML review surface at
`specs/<feature>/index.html` when the repository provides a Spec View template
or renderer. Treat Markdown artifacts as the source of truth, and the HTML page
as the owner-facing presentation layer for review and navigation.

所有面向用户、评审者或后续 agent 的 Spec-Kit 产物默认使用中文撰写，除非用户在当前任务中明确要求使用其他语言。保留必要的代码标识符、文件路径、命令、API 名称和英文产品名，但叙述、验收、计划、任务、清单、features、prototype 说明和 quickstart 文案都应使用中文。

凡是 UI-facing 或体验相关 spec，必须在进入 tasks 或 implementation 前制作可打开的 prototype 产物。最低要求是 `specs/<feature>/prototype.md` 指向独立 HTML 原型或截图/交互原型；如果已有 `mockups/index.html`，也要通过 `prototype.md` 明确说明原型入口、覆盖页面、使用方式和当前限制。

Before writing a PRD-like spec, pause for user story discussion unless user
stories are completely unsuitable for the work. This is an intentional
pre-specification phase, not a violation of Spec-Kit. Spec-Kit starts cleaner
when the owner has first reacted to the actors, situations, motivations, and
outcomes that the feature is supposed to serve.

## Required Context

Before routing work, load only the smallest useful context:

- `AGENTS.md` for top-level routing, repository principles, and agent behavior.
- `PROCESS.md` for workflow, quality gates, and git discipline.
- `.specify/memory/constitution.md` for non-negotiable project principles when
  the repository has one.
- Relevant 5xP files only when the request needs them.

## 5xP Initialization

When initializing 5xP in a repository, create or update these root files:

```text
AGENTS.md
PRODUCT.md
PLATFORM.md
PROCESS.md
PROFILE.md
```

Use them as durable operating context:

- `AGENTS.md`: agent routing, repository principles, and local agent rules.
- `PRODUCT.md`: purpose, users, boundaries, success measures, and non-goals.
- `PLATFORM.md`: repository shape, storage rules, commands, dependencies, and
  integration constraints.
- `PROCESS.md`: development workflow, quality gates, Spec-Kit usage, and git
  discipline.
- `PROFILE.md`: owner preferences and collaboration style.

Do not put feature-level PRDs, plans, or task lists in the 5xP files. Put those
under `specs/<feature>/`.

## Spec-Kit Initialization

When initializing Spec-Kit in a repository, create the standard project surface:

```text
.specify/memory/constitution.md
.specify/templates/
.specify/scripts/
.codex/prompts/
specs/README.md
scripts/render-spec-view.mjs
.specify/extensions/spec-artifacts/
```

The constitution captures non-negotiable repository principles. Templates and
scripts are the source of truth for generated Spec-Kit artifacts. Command
prompts bind the workflow into the local agent environment.

For Codex-oriented repositories, initialize or copy prompt bindings when
available:

```text
.codex/prompts/speckit.constitution.md
.codex/prompts/speckit.specify.md
.codex/prompts/speckit.clarify.md
.codex/prompts/speckit.plan.md
.codex/prompts/speckit.tasks.md
.codex/prompts/speckit.analyze.md
.codex/prompts/speckit.checklist.md
.codex/prompts/speckit.implement.md
```

## Command Binding

Prefer repository-local Codex prompts, Spec-Kit scripts, and templates whenever
a Spec-Kit phase applies.

| Phase | Command prompt | Script / source of truth | Output |
|---|---|---|---|
| Constitution | `.codex/prompts/speckit.constitution.md` | `.specify/memory/constitution.md` | constitution updates |
| User Story Discussion | chat-first, before PRD/spec creation | `writing-userstory`, `product-requirements`, `idea-refine` | agreed user stories or explicit technical-scenario rationale |
| Specify | `.codex/prompts/speckit.specify.md` | `.specify/scripts/*` + `.specify/templates/spec-template.md` + `speckit.spec-artifacts.generate` when available | `specs/<feature>/spec.md`, `features.md`, `checklists.md` |
| Clarify | `.codex/prompts/speckit.clarify.md` | active `spec.md` | clarified `spec.md` |
| Plan | `.codex/prompts/speckit.plan.md` | `.specify/scripts/*` + `.specify/templates/plan-template.md` + GitNexus codebase evidence when relevant | `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` |
| Plan Review | chat-first review gate | `plan-eng-review`, `gitnexus-exploring`, `gitnexus-impact-analysis` | reviewed plan or required revisions before tasks |
| Tasks | `.codex/prompts/speckit.tasks.md` | `.specify/scripts/*` + `.specify/templates/tasks-template.md` + GitNexus impact evidence when relevant | `tasks.md` |
| Analyze | `.codex/prompts/speckit.analyze.md` | `spec.md`, `plan.md`, `tasks.md` + GitNexus evidence when current-code consistency matters | consistency report or fixes |
| Implement | `.codex/prompts/speckit.implement.md` | `tasks.md` + GitNexus navigation/debugging/refactoring support as needed | small verified implementation slices |
| Checklist | `.codex/prompts/speckit.checklist.md` | `.specify/templates/checklist-template.md` | `checklists/*.md` |
| Spec View | `scripts/render-spec-view.mjs --feature <feature>` | `.specify/templates/spec-view-template.html` + current feature Markdown artifacts | `specs/<feature>/index.html` |

If the user asks for "PRD", "plan", "tasks", or "implementation" for a
feature, map the request to the closest Spec-Kit phase instead of creating a
parallel document path.

For PRD/spec requests, the closest phase is usually not immediate Specify. First
run a short user story discussion, then create or update the Spec-Kit spec from
the agreed stories. If the work is truly not user-story-shaped, record why and
use concrete technical scenarios with named actors instead.

### Spec View Presentation

When the repository has `.specify/templates/spec-view-template.html` and
`scripts/render-spec-view.mjs`, every feature can expose a stable HTML entry
point for owner review:

```sh
node scripts/render-spec-view.mjs --feature <feature>
```

The page should use tabs for:

- `SPEC`
- `FEATURES`
- `CHECKLISTS`
- `PROTOTYPE`
- `PLAN`
- `TASKS`

`SPEC`, `FEATURES`, `CHECKLISTS`, `PROTOTYPE`, `PLAN`, and `TASKS` should load
directly from `spec.md`, `features.md`, `checklists.md`, `prototype.md`,
`plan.md`, and `tasks.md` when those files exist. `PROTOTYPE` may link to an
independent HTML prototype page, typically `specs/<feature>/mockups/index.html`.
The renderer must not parse headings or infer structure from standard Spec-Kit
files; it reads fixed artifact paths and renders missing states when files do
not exist.

After any change to a feature's Spec-Kit artifacts (`spec.md`, `features.md`,
`checklists.md`, `prototype.md`, `plan.md`, `tasks.md`, or related review
artifacts), proactively refresh the feature review surface:

1. Re-render `specs/<feature>/index.html` when a renderer exists.
2. Open or refresh `specs/<feature>/index.html` in the Codex in-app browser for
   the owner, preferably on the tab most relevant to the changed artifact.
3. Do this without waiting for the owner to ask again. The review surface is the
   expected handoff after spec edits, not an optional extra.

## Feature Health Checks

Use the local Spec-Kit health helpers for different jobs:

- `spec-kit-status` answers **"update and inspect the current feature's status snapshot"**
- `spec-kit-doctor` answers **"is the Spec-Kit project surface healthy?"**

### Status First, Current Feature First

When the workflow needs an updated view of the active feature's artifact state,
task progress, or likely next phase, use `spec-kit-status` first and keep the
scope on the active feature:

- Prefer `/speckit.status-report.show` with the current feature/branch context.
- Prefer explicit feature targeting (for example `--feature <name>`) when the
  branch is not already on the feature.
- Do **not** default to global overview modes like `--all` unless the user
  explicitly asks for repository-wide status.
- Treat `status` as the way to refresh the current feature's status snapshot
  before or after `spec.md`, `plan.md`, `tasks.md`, and implementation updates.

### Doctor For Structural Or Installation Health

Use `spec-kit-doctor` when you need to validate the Spec-Kit system surface
rather than feature progress:

- missing or suspicious `spec/plan/tasks` artifacts
- newly installed or modified extensions
- missing `.specify/scripts`, `.specify/templates`, `.specify/memory`, or agent
  bindings
- before/after patching Spec-Kit tooling itself

`doctor` is a repository-health diagnostic. It can confirm that the project
surface is sound, but it is **not** the primary progress view for the current
feature.

## Workflow Skill Pack

This workflow is designed to coordinate a local skill pack. Use the named local
skills as phase lenses when they are available; if one is missing, continue with
the closest available repository or global skill and record the fallback.

Core workflow skills:

- `product-requirements`
- `writing-userstory`
- `idea-refine`
- `plan-eng-review`
- `spec-driven-development`
- `planning-and-task-breakdown`
- `incremental-implementation`
- `test-driven-development`
- `code-review-and-quality`
- `documentation-and-adrs`
- `git-workflow-and-versioning`
- `spec-kit-status`
- `spec-kit-doctor`

Specialist skills used when the phase touches their domain:

- `api-and-interface-design`
- `source-driven-development`
- `frontend-ui-engineering`
- `browser-testing-with-devtools`
- `debugging-and-error-recovery`
- `security-and-hardening`
- `performance-optimization`
- `ci-cd-and-automation`
- `shipping-and-launch`
- `context-engineering`
- `product-strategist`
- `claude-design-intake`
- `claude-design-core`
- `claude-design-wireframe`
- `claude-design-prototype`
- `claude-design-design-system`
- `claude-design-frontend-direction`
- `claude-design-dev-handoff`

Optional codebase-intelligence skills:

- `gitnexus-exploring`
- `gitnexus-impact-analysis`
- `gitnexus-debugging`
- `gitnexus-pr-review`
- `gitnexus-refactoring`
- `gitnexus-cli`

## Code Navigation Layers

When a repository exposes a repo-local LSP command, treat it as the first layer
for symbol-local language intelligence rather than as a replacement for
graph-aware tooling.

- Use repo-local LSP first for go-to-definition, find-references, rename
  preparation, and diagnostics in the repository's primary language surface.
- Use GitNexus first for execution-flow discovery, ownership boundaries,
  impacted callers, and blast-radius questions.
- Use both when a local symbol question grows into a cross-package or
  cross-process question: start with LSP to identify the symbol, then switch to
  GitNexus to understand how that symbol participates in the wider system.
- If the repo-local LSP is unavailable or the question is outside its language
  scope, fall back to direct file analysis instead of pretending the LSP can
  answer everything.

## Routing

Use this decision table after loading the required context:

| Request shape | Primary path | Local skill pack |
|---|---|---|
| Vague product idea | Refine the idea, discuss user stories, then run specify when concrete | `idea-refine`, `product-strategist`, `writing-userstory` |
| New feature or contract change | Discuss user stories first, then Specify | `writing-userstory`, `product-requirements`, `spec-driven-development` |
| PRD or requirements request | Discuss user stories before writing the PRD/spec | `writing-userstory`, `product-requirements`, `idea-refine` |
| Specify needs interface or experience design | Run design intake/direction before freezing UI-facing spec requirements | `claude-design-intake`, `claude-design-core`, `claude-design-wireframe`, `claude-design-prototype`, `claude-design-frontend-direction`, `claude-design-dev-handoff` |
| Existing spec needs technical design | Plan with codebase evidence when useful | `spec-driven-development`, `api-and-interface-design` when contracts are involved, plus repo-local LSP for symbol-local navigation and `gitnexus-exploring` / `gitnexus-impact-analysis` |
| Need to refresh current feature status or next step | Update the active feature's artifact/task snapshot before deciding the next phase | `spec-kit-status` |
| Need Spec-Kit structural health or extension install validation | Diagnose project-level Spec-Kit setup before trusting workflow artifacts | `spec-kit-doctor` |
| Existing plan needs engineering validation | Review plan before tasks when risk is meaningful | `plan-eng-review`, plus `gitnexus-exploring` or `gitnexus-impact-analysis` when current-code evidence matters |
| Existing plan needs work items | Tasks, informed by impacted files and dependency boundaries when relevant | `planning-and-task-breakdown`, `gitnexus-impact-analysis` |
| Consistency risk before build | Analyze against spec, plan, tasks, and current code evidence | `code-review-and-quality`, `context-engineering`, `gitnexus-impact-analysis`, `gitnexus-exploring` |
| Implementation | Implement one task slice at a time with codebase navigation support as needed | `incremental-implementation`, `test-driven-development`, repo-local LSP for symbol-local navigation, `gitnexus-exploring`, `gitnexus-refactoring` |
| UI implementation | Implement plus UI review | `frontend-ui-engineering`, `browser-testing-with-devtools`, `claude-design-frontend-direction`, `claude-design-dev-handoff`, `gitnexus-exploring` |
| API, runtime, persistence, or package contract | Spec and plan before implementation | `api-and-interface-design`, `spec-driven-development`, `gitnexus-impact-analysis` |
| Source-doc-sensitive change | Spec and plan with source verification | `source-driven-development`, `gitnexus-exploring` |
| Bug fix | Reproduce and fix; update spec only if behavior contract changes | `debugging-and-error-recovery`, `test-driven-development`, repo-local LSP for local symbol tracing, `gitnexus-debugging`, `gitnexus-exploring` |
| Tests | Add or update focused tests tied to acceptance criteria | `test-driven-development` |
| Review | Review against spec, plan, tasks, constitution, and current-code impact | `code-review-and-quality`, `gitnexus-pr-review`, `gitnexus-impact-analysis` |
| Security concern | Review or fix with explicit boundaries | `security-and-hardening`, `gitnexus-impact-analysis` |
| Performance concern | Measure first, then tune | `performance-optimization`, `gitnexus-impact-analysis` |
| CI/CD | Keep gates aligned with Spec-Kit verification | `ci-cd-and-automation`, `gitnexus-impact-analysis` |
| Docs/ADR | 5xP for durable rules, `specs/<feature>/` for feature docs | `documentation-and-adrs` |
| Git operations | Keep feature artifacts and code in coherent commits | `git-workflow-and-versioning`, `gitnexus-cli` |
| Launch/deploy | Confirm acceptance and rollback evidence | `shipping-and-launch`, `gitnexus-impact-analysis` |

## Non-Negotiable Rules

1. Never place feature-level PRDs, plans, or tasks directly under a generic docs
   path when the repository uses Spec-Kit feature directories.
2. Never use a generic template when the repository has a local
   `.specify/templates/` template for that phase.
3. Never proceed from specify to plan to tasks when the previous artifact is
   missing or materially incomplete.
4. Never skip `.specify/memory/constitution.md` when a change touches a
   repository principle or product boundary covered by the constitution.
5. If requirements conflict with the constitution, stop and report the conflict.
6. Do not skip user story discussion before PRD/spec creation unless user
   stories are completely unsuitable; when skipping, record the rationale and
   use named technical scenarios instead.
7. Preserve unrelated user changes and local workspace noise.

## Phase Gates

### User Story Discussion Gate

- Run before creating or materially updating a PRD-like `spec.md`, unless the
  work is completely unsuitable for user stories.
- Propose a small set of stories for owner review before freezing the spec.
- Prefer the form `As a [actor/persona], I want [capability/action], so that
  [outcome/benefit]`.
- Also capture acceptance criteria in owner-readable terms, preferably as
  concise Given/When/Then scenarios.
- Ask the owner to confirm, reject, or revise the stories before treating them
  as requirements.
- For platform, architecture, or runtime work, still look for a real actor such
  as owner, operator, maintainer, future agent, internal caller, provider
  implementer, or reviewer.
- Use technical scenarios instead of user stories only when user stories would
  obscure the work. In that case, keep the same discipline: named actor,
  situation, goal, acceptance criteria, and independent validation.
- If the user asks to move quickly, keep the discussion short but do not silently
  skip it.

### Specify Gate

- Feature directory is under `specs/<feature>/`.
- `spec.md` follows the repository's spec template.
- Spec-Kit feature artifacts should be written in Chinese by default, while
  preserving code identifiers, commands, file paths, API names, and product
  names as literals.
- If the `spec-artifacts` extension is available, `features.md` and
  `checklists.md` are generated or refreshed in the same feature directory after
  `spec.md` passes quality validation. These are presentation/review artifacts
  and do not replace `spec.md` or `checklists/requirements.md`.
- Check the current feature with `spec-kit-status` before or after spec updates
  when you need to confirm artifact completeness or the next Spec-Kit phase.
- User stories were discussed with the owner before spec creation, or the spec
  records why technical scenarios were more appropriate.
- UI-facing requirements have gone through the appropriate Claude Design lens
  before the spec is treated as frozen. Use `claude-design-intake` and
  `claude-design-core` for design direction, then add `claude-design-wireframe`,
  `claude-design-prototype`, `claude-design-design-system`,
  `claude-design-frontend-direction`, or `claude-design-dev-handoff` when the
  feature needs those artifacts.
- UI-facing specs must include a prototype artifact before moving into tasks or
  implementation. At minimum, create `prototype.md` that links to the independent
  HTML prototype or mockup entry and records covered surfaces and known limits.
- Acceptance criteria or validation scenarios are independently testable.
- Open questions are resolved or explicitly marked for clarification.

For low-level architecture, framework, provider-boundary, persistence, or
runtime contract changes, do not force consumer-style user stories when they
obscure the work. First try actor-centered stories using the real operator or
maintainer; use independently testable technical scenarios only when stories are
genuinely unsuitable.

### Plan Gate

- `plan.md` follows the repository's plan template.
- Prefer `spec-kit-status` on the current feature before planning if there is
  any doubt about existing artifact state or whether the feature is already past
  the plan phase.
- Constitution checks are explicit when relevant.
- Technical context, risks, dependencies, and verification checkpoints are
  concrete.
- Use repo-local LSP first for symbol-local code reading when the repo exposes
  one, then use `gitnexus-exploring` or `gitnexus-impact-analysis` when
  current-code structure, dependency impact, or ownership boundaries materially
  affect the plan.
- Generated artifacts live beside the spec, not in generic docs paths.

### Plan Review Gate

- Use `plan-eng-review` before tasks when risk is meaningful.
- Add `gitnexus-exploring` for codebase questions and `gitnexus-impact-analysis`
  for blast-radius or dependency questions.
- Do not ask reviewers to judge architecture from memory when cheap codebase
  evidence is available.

### Tasks Gate

- `tasks.md` follows the repository's tasks template.
- Prefer `spec-kit-status` on the current feature before task generation or task
  backfill so you do not confuse repository-wide progress with the active spec's
  actual state.
- Tasks are grouped by independently deliverable scenario when applicable.
- Each task has acceptance and verification criteria.
- Dependencies and parallelization boundaries are explicit.
- Use `gitnexus-impact-analysis` when task boundaries depend on impacted files,
  modules, contracts, or parallelization safety.

### Analyze Gate

- Compare `spec.md`, `plan.md`, `tasks.md`, and current code reality.
- Use `spec-kit-status` for the current feature when you need a fast artifact /
  progress snapshot before deeper consistency analysis.
- Use `gitnexus-exploring` for targeted codebase facts and
  `gitnexus-impact-analysis` when consistency risks cross files or modules.

### Implementation Gate

- Implement from `tasks.md`, not from memory.
- Re-check the current feature with `spec-kit-status` after meaningful task or
  artifact updates when the next phase decision depends on current completion.
- Keep changes small and verifiable.
- Run the narrowest relevant verification first, then broader checks when the
  touched surface justifies it.
- Use repo-local LSP first for symbol-local language navigation when the repo
  provides one.
- Use GitNexus skills as needed: `gitnexus-exploring` for graph-aware
  navigation, `gitnexus-debugging` for failures, `gitnexus-refactoring` for
  scoped refactors, and `gitnexus-impact-analysis` before broad changes.

## Verification

Before declaring workflow setup complete, run structural checks appropriate for
the repository, such as:

```sh
test -f AGENTS.md
test -f PRODUCT.md
test -f PLATFORM.md
test -f PROCESS.md
test -f PROFILE.md
test -d .specify
test -d specs
```

Add repository-specific checks to the repository's own 5xP files or feature
specs, not to this generic workflow skill.
