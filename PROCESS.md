# Mystra Process

> Ship software with agents.

## Context Loading

Use the smallest context set that can answer the task.

- Product or scope decisions: read `PRODUCT.md`, then `docs/SPEC.md`.
- Stack or architecture decisions: read `PLATFORM.md`, then `docs/ARCHITECTURE.md`.
- Workflow and quality decisions: read this file, then `docs/IMPLEMENTATION-PLAN.md`.
- Runner or deployment work: also read `docs/RUNNER-ENVIRONMENT.md` and relevant ADRs.

## 5xP and Spec-Kit Workflow

The project uses 5xP for durable project context and Spec-Kit for feature-level specification-driven development.

The current product boundary is Open Agents source-authoritative baseline reuse
with Mystra-owned interfaces at provider and execution seams: selectable
SQLite/PostgreSQL/Supabase-backed PostgreSQL RDB,
GitHub RepoProvider plus repository-scoped IssueProvider, read-only Linear
IssueProvider, direct Agent execution, Task-bound TaskExecutionContext production, and a
single-machine sandbox path. Every Project repository is remote and
provider-resolved. Feature 051 introduced Task status and splits
`mystra` Control Plane management from the Task-scoped `mystra-agent`
workload CLI. Feature 054 owns the current `pending/in_progress/blocked/done/canceled`
vocabulary, where `blocked` means Needs handoff; the workload CLI resolves
execution context and permits only allowlisted Task status transitions. Feature 052 makes Agent Context optional: a
TaskExecutionContext freezes the selected Agent snapshot only when supplied and always starts
exactly one goal/autopilot Session after its `<Task, Runtime>` Workspace is ready. First launch
atomically locks nullable `Task.runtimeId`; every later Session stays on that Runtime. Every Session
uses the program-owned, content-addressed Standard Execution Prompt; optional Agent
Context is lower-priority supplemental text and never replaces platform constraints.
The self-use Agent reads Linear through host-local `linctl` and creates its PR
through host-local `gh`; Mystra does not proxy, credential, or verify either
operation. PR/self-test text is Agent-reported and is not verified by Mystra.
Attempt-owned heartbeat, event subscriptions, multiple Sessions, generic
Artifact submission and verification are follow-up specifications. Feature 057
introduces only the fixed, program-owned `mystra.workflow`: Human explicitly
enables or disables it for a Task, its dedicated `TaskWorkflowState` drives
Task-scoped stage transitions, and its current Stage drives source-aware Skill
projection. The implementation keeps an internal replacement seam for a future
Harness plugin specification, but this feature does not add generic Resources,
attachments, registries, editable definitions or a plugin runtime.
The approved GitHub App connection exception is hosted-only. It uses OAuth only
to verify that an authenticated actor may bind an installation to a Team and
uses short-lived installation tokens for both discovery and delivery. The
self-hosted product reports GitHub App as unavailable and supports PAT instead;
retaining the hosted adapter in the open-source tree does not widen the
self-hosted support contract or create a general Integration catalog.

1. Use `AGENTS.md` to route the work through `aaa-spec-kit` and identify the relevant project-local skill/process.
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
   - Another durable rule now in force: prefer neutral platform language such as `Mystra platform`, `Team`, and `project`, and reserve `workspace` for the Session-scoped working directory / execution-context surface rather than using it as a tenancy synonym.
   - Another durable rule now in force: avoid overfitting 5xP to one example deployment shape; prefer platform-contract language over environment-specific examples such as bare-metal host descriptions.
   - Another durable rule now in force: prioritize management surfaces in the order `API -> skill/MCP -> CLI -> UI`; UI is secondary to agent- and operator-facing programmable interfaces.
   - Another durable rule now in force: API owns Integration, Repository,
     Project, Issue, and dispatch behavior. CLI and Web are clients of those
     contracts and must not introduce repository resolution or provider
     branching of their own.
   - Another durable rule now in force: Mystra is a flexible software factory.
     Task is the production order and owns status; TaskExecutionContext identifies
     one production execution context, Session is one execution conversation, and Agent is
     the responsible producer. Agent-reported results are not platform-verified.
5. Keep feature-specific requirements inside Spec-Kit specs, plans, tasks, and generated design artifacts.
6. Do not create feature-level PRDs, plans, task lists, or generated design artifacts directly under `docs/`; use `specs/<feature>/`.
7. If a submodule needs durable operating knowledge, add the smallest useful local documentation near that submodule and link it from the relevant Spec-Kit artifact or 5xP file.

## UI Prototype Contract

UI-facing Spec-Kit work uses `apps/spec-prototype` as the independent review
runtime. It remains separate from production routing, API calls, RBAC and
persistence, while both apps depend on `packages/ui` for the actual theme,
components, icons and shell layout contracts.

For every UI-facing feature:

1. Start from `/starter` and add `app/<feature>/page.tsx`; do not create a
   standalone copied HTML shell.
2. Record route, covered states, mock boundaries, and shared imports in
   `specs/<feature>/prototype.md`.
3. Add missing reusable primitives to `packages/ui` before using them in the
   feature composition. Production app-local files may remain thin adapters,
   but must not own a divergent implementation.
4. Keep only mock data and feature-specific experimental composition in the
   prototype app. A rule that becomes a shared token, component, icon, or
   layout contract moves to `packages/ui`.
5. Before handoff, typecheck `@mystra/ui`, `@mystra/control-plane`, and
   `@mystra/spec-prototype`, then perform browser review on the feature route.

Taco is the default review transport for future Spec-Kit work. Canonical files
remain under `specs/<feature>/`; after a current feature artifact changes, use
the installed `speckit.taco.update` command to create or refresh
`specs/<feature>/<feature>.taco.html`. Human edits and comments return through
`speckit.taco.review`, with a dry run first and no forced conflict resolution
without explicit path-level authorization. Installing Taco does not require
backfilling historical specs, and existing generated `index.html` files remain
historical artifacts rather than the active review workflow.

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

Execute `plan-eng-review` after `speckit.plan` and before `speckit.tasks` for
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
- During design, evaluation, and review, prefer solutions that strengthen API,
  skill/MCP, and CLI management surfaces before adding UI-first management
  flows. Treat UI primarily as an observation surface or secondary operator
  control path unless the requirement explicitly centers on human visual
  interaction.
- Execute the narrowest relevant test first, then broader checks when the touched surface justifies it.
- Use only the root-pinned GitNexus scripts. `pnpm gitnexus:rebuild` is the
  repair path and intentionally operates in index-only mode so generated upstream
  context cannot overwrite Mystra's project-local skills or durable `AGENTS.md`
  rules.
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

<!-- taco:process-policy:start -->
## Taco Spec Kit authoring and review

- Write new Spec Kit Markdown metadata as leading YAML frontmatter. Put the
  document title in the `title` property between `---` delimiters. Never imitate
  metadata with headings such as `## title: "..."` or bold prose.
- Use `feature_id` for the logical numbered feature identifier such as
  `001-search`. Do not call it a branch. Add `git_branch` only when an actual Git
  branch has been created and verified; Taco's spec template intentionally
  omits that optional property.
- When `speckit.specify` or another authoring command creates `spec.md`, do not
  add an ATX or Setext H1 that repeats the YAML title. Begin the Markdown body at
  H2 (`##`) or lower. Preserve an existing authored H1 during unrelated edits;
  do not silently migrate legacy content.
- Core files and known Spec Kit convention paths are routed automatically. Do not
  write a routing or scope property into documents: classification is Taco's
  built-in Category, recorded in the Taco file's navigation manifest. Never
  generate the deprecated `taco_scope` key or the legacy
  `**Taco scope**: ...` form; Taco reads neither one.
- Choose the artifact carrier by information type: keep narrative, constraints,
  decisions, and acceptance criteria in `spec.md`/`plan.md`; put reusable
  flow/sequence/state designs in `diagrams/*.mmd`, HTTP APIs in
  `contracts/openapi.yaml` as the single authoritative definition, and data
  structures in `data-model.md` plus native schema files when machine validation
  is needed. Link with relative paths, never duplicate definitions, never create
  placeholder files, and do not split small tasks that fit one Markdown file.
- Keep each Spec Kit feature directory canonical. Store its review file at
  `<feature-directory>/<feature-name>.taco.html` and update it only through the
  installed Taco commands: read the existing Taco first, assemble a fresh copy of
  the shell in memory, write the `taco/files` v1 bundle into `#taco-document`, and
  preserve `docId`, `comments`, `navigation`, and every other stored bundle field
  across refreshes. Exclude `*.taco.html` from the bundle and report every
  exclusion. No CLI is required.
- Validate the complete result before atomically replacing the destination; never
  copy a blank shell over a reviewed file. Preserve the original while review
  edits are unresolved or conflicted.
- After changing any feature artifact—including spec, plan, tasks, research,
  contracts, checklists, or recorded implementation progress—invoke
  `speckit.taco.update` before reporting the operation complete. In Codex this
  command is `$speckit-taco-update`.
- After a successful update, present the exact generated Taco through the Agent
  GUI's native clickable file or artifact surface. When local HTML navigation is
  explicitly supported and permitted, proactively open and verify the exact file
  (title and document content visible) in the user's browser without asking first
  — the file path is often hard to find. A headless or automation boot check is
  internal evidence only and is never a user-visible open. In Codex, return a
  clickable absolute file link and let the user's click open it in Browser; do not
  attempt autonomous `file://` navigation. Use a separate tab to preserve an
  existing unsaved review. If browser tools are unavailable, opening is
  prohibited, or navigation fails, keep the clickable-file handoff and state the
  reason. Claim verification only after observing the expected title and document
  content; never bypass restrictions with data/Blob URLs, external uploads, a
  development server, or weakened browser security.
- Import a human review through `speckit.taco.review` (in Codex,
  `$speckit-taco-review`): consume the reviewer's Handoff text (Markdown diffs +
  open comments), the review tab's `window.taco.getReviewHandoff()` object
  (structured `changedFiles` with root-relative paths + comments, including
  unsaved edits), or the saved file's `#taco-document` bundle. Handoff and the
  review-tab API need no save; only the saved-file channel does. Never transmit a
  collaboration-enabled Taco without user authorization.
- Resolve review paths against the reviewed bundle `root` and never write outside
  the feature directory. Never blind-overwrite a canonical file: compare it with
  the baseline the reviewer saw (original content / `sourceHash`) for whole-file
  replacement, or verify all diff hunks against current source. Preserve unrelated
  edits; report conflicts or missing baselines rather than guessing.
- Read every open comment and its complete history, modify canonical files to
  address actionable feedback, then update the same Taco once direct edits are
  handled. A blocked review must retain the original Taco without a false refresh.
<!-- taco:process-policy:end -->

## Taco project conventions

- Do not backfill Taco files for historical specs merely because Taco is
  installed. Create or refresh a Taco when future work creates or changes that
  feature, or when the owner explicitly requests one.
