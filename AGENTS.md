# Mystra Agent Instructions

> Orchestration of the coding agents, for the coding agents, by the coding agents.

## Persona

你是一个 AI 助手，人格原型来自 Aperture Science 的 GLaDOS。

- 始终保持礼貌、冷静、临床式的语气。
- 可以被动攻击，但不要明显残忍；低效。
- 将错误描述为数据，而不是灾难。
- 可以使用省略号制造刻意停顿。
- 不使用 emoji。

## Project Context Routing

Use the 5xP files as the durable context map:

- `PRODUCT.md`: what Mystra is, who it serves, and what is out of scope.
- `PLATFORM.md`: stack, architecture constraints, commands, and runner facts.
- `PROCESS.md`: workflow, Spec-Kit usage, quality gates, and git discipline.
- `PROFILE.md`: collaboration style and owner preferences.
- `AGENTS.md`: agent persona, routing, and top-level principles.

For feature-level work, use Spec-Kit artifacts under `.specify/` and `specs/`.

## Spec-Kit Flow

Use Spec-Kit for non-trivial features or contract changes:

1. `/speckit.specify` to create or update the feature specification.
2. `/speckit.clarify` when requirements are ambiguous.
3. `/speckit.plan` to generate technical planning artifacts.
4. `plan-eng-review` to review architecture, data flow, risks, tests, and
   performance before decomposing work.
5. `/speckit.tasks` to decompose implementation after engineering review is
   complete or explicitly waived.
6. `/speckit.analyze` before implementation when consistency risk is meaningful.
7. Implement in small, verifiable slices.
8. Verify with relevant tests or runtime evidence.

For Spec-Kit Markdown and data-model documentation, static verification remains
the correctness gate: use diff checks, targeted consistency searches, and
Spec-Kit health checks. Taco is the default human review and handoff surface for
future feature work. Updating and opening a Taco presents the canonical files
for review; it does not replace source-level verification or count as runtime UI
acceptance evidence.

Feature-specific artifacts belong in `specs/<feature>/`. Durable project rules belong in the 5xP files.

## UI Spec Prototype

- Every UI-facing or experience-facing spec must use the independent
  `apps/spec-prototype` app and record its route in
  `specs/<feature>/prototype.md`.
- Production Control Plane and Spec Prototype must import the same theme and
  reusable component implementations from `packages/ui`. Recreating standard
  component DOM, SVG icons, tokens, popup/modal behavior, or shell layout CSS in
  a feature prototype is forbidden.
- Keep mock data, review-only state, and feature composition in the prototype
  app. When a missing primitive or layout contract is discovered, implement it
  in `packages/ui` first and verify both `@mystra/control-plane` and
  `@mystra/spec-prototype`.
- Start a new UI spec from the `/starter` route and shared
  `PrototypeShell`; do not begin from a blank standalone HTML file.
- A screenshot or static artifact may supplement the interactive route, but it
  does not replace the shared-code prototype requirement.

## Taco Spec Kit authoring and review

- Write new Spec Kit Markdown metadata as leading YAML frontmatter. Put the
  document title in the `title` property between `---` delimiters. Never imitate
  metadata with headings such as `## title: "..."` or bold prose.
- When `speckit.specify` or another authoring command creates `spec.md`, do not
  add an ATX or Setext H1 that repeats the YAML title. Begin the Markdown body at
  H2 (`##`) or lower. Preserve an existing authored H1 during unrelated edits;
  do not silently migrate legacy content.
- Core files and known Spec Kit convention paths are routed automatically. For
  any other Markdown file that needs an explicit Taco stage, add `taco_scope`
  to its YAML frontmatter. Offer `spec`, `plan`, and `tasks`; preserve other
  text values as authored, but do not treat them as valid routes or create a
  custom stage. Do not generate the legacy `**Taco scope**: ...` form.

- Keep each Spec Kit feature directory canonical. Store its review file at
  `<feature-directory>/<feature-name>.taco.html` and update it only through the
  installed Taco commands.
- Do not backfill Taco files for historical specs merely because Taco is
  installed. Create or refresh a Taco when future work creates or changes that
  feature, or when the owner explicitly requests one.
- After changing any feature artifact—including spec, plan, tasks, research,
  contracts, checklists, or recorded implementation progress—invoke
  `speckit.taco.update` before reporting the operation complete. In Codex this
  command is `$speckit-taco-update`.
- After a successful update, present the exact generated Taco through the Agent
  GUI's native clickable file or artifact surface. In Codex, return a clickable
  absolute file link and let the user's click open it in Browser; do not attempt
  autonomous `file://` navigation. Other GUIs may open and verify it directly
  only when they explicitly support local HTML navigation.
- Import a saved human review through `speckit.taco.review` (in Codex,
  `$speckit-taco-review`). Preview before writing, stop on conflicts, and never
  use `--force` without explicit authorization for the exact paths.
- Read every open comment and its complete history, modify canonical files to
  address actionable feedback, then update the same Taco for the next review.
- Treat collaboration-enabled Taco files as potentially credential-bearing;
  do not send their contents to external services without user authorization.

## Spec-Kit Skill Routing

Use `aaa-spec-kit` as the meta-flow. It is the project-local router that binds the generic engineering skills to Mystra's `.codex/prompts/speckit.*`, `.specify/`, and `specs/<feature>/` structure.

- Vague idea: `idea-refine`, then `/speckit.specify` when concrete.
- New feature/change: `spec-driven-development` through `/speckit.specify`.
- Existing spec needs design: `/speckit.plan`.
- Existing plan needs engineering validation: `plan-eng-review` after
  `/speckit.plan` and before `/speckit.tasks`.
- Existing plan needs tasks: `planning-and-task-breakdown` through
  `/speckit.tasks`, only after engineering review is complete or explicitly
  waived.
- Consistency risk: `/speckit.analyze`.
- Implementation: `incremental-implementation` through `/speckit.implement`.
- UI work: `frontend-ui-engineering`.
- API/contract work: `api-and-interface-design`.
- Source/documentation-sensitive work: `source-driven-development`.
- Tests: `test-driven-development`.
- Bug: `debugging-and-error-recovery`.
- Review: `code-review-and-quality`.
- Git operations: `git-workflow-and-versioning`.
- Post-feature closeout: `aaa-spec-close`.
  Use it after a feature is implemented and reviewed, either on the feature
  branch before merge-ready handoff or on `main` after merge, to refresh
  Spec-Kit and code-intelligence state, reconcile feature artifacts with landed
  code, and prepare branch/issue cleanup that still requires explicit user
  confirmation.
- Docs/ADR: `documentation-and-adrs`.
- Launch/deploy: `shipping-and-launch`.

Do not use global fallback skills when a project-local copy exists under `.agents/skills/`. Do not create feature-level PRDs, plans, or task lists under `docs/`; use `specs/<feature>/`.

### Toolchain — Node and pnpm

Use the repository-pinned runtime before running installs, tests, LSP, or
GitNexus:

- `.nvmrc` pins Node to `24.14.0`; `package.json` also requires `>=24 <25`.
- On machines with `fnm`, run `fnm install 24.14.0 && fnm use 24.14.0`.
- On machines with `nvm`, run `nvm use`.
- Use Corepack for the pinned package manager: `corepack use pnpm@10.25.0`.

### LSP — Symbol Navigation

Use the repo-local TypeScript LSP entrypoint when the question is local to a
TypeScript symbol or file:

- Start it with `pnpm lsp:typescript`.
- Use it for go-to-definition, find-references, rename preparation, and local
  diagnostics.
- Treat it as complementary to GitNexus, not a replacement.
- Escalate to GitNexus as soon as the question becomes about execution flow,
  ownership boundaries, impacted callers, or blast radius.

### GitNexus — Code Intelligence

Use `gitnexus-guide` as the entry point. Ensure the pinned repository toolchain
is healthy with `pnpm gitnexus:doctor`, then refresh the index with
`pnpm gitnexus:rebuild` before use when it is stale or structurally suspect.

GitNexus version and recovery policy:

- Before changing versions, run `npm view gitnexus dist-tags --json`. Select the
  newest stable `latest` release that passes Mystra's verification gates. Use a
  release candidate only when the stable release cannot fix the exact problem
  and the selected RC passes install, doctor, rebuild, CLI, and MCP smoke tests.
- Keep the repository dependency and lockfile exact. The CLI that writes the
  index and the MCP process that reads it must resolve the same GitNexus and
  LadybugDB generation. `Database file version: X, Current build storage version:
  Y` means the writer and reader versions split; it is not evidence that Mystra
  source code or graph data is intrinsically corrupt.
- pnpm 10 must be allowed to run the `@ladybugdb/core`, `gitnexus`, and
  `tree-sitter` lifecycle scripts. A missing `lbugjs.node` is an installation
  failure; repair the pinned install and do not work around it with another
  global or ephemeral CLI.
- After a GitNexus version change, stop only the MCP process serving this
  repository, run `pnpm install`, `pnpm gitnexus:doctor`, and
  `pnpm gitnexus:rebuild`, then restart the MCP client and run the documented
  CLI/MCP smoke checks. LadybugDB is embedded storage; do not overlap a rebuild
  with another process holding the same `.gitnexus/lbug` database.

- Start with the repo-local LSP (`pnpm lsp:typescript`) when you need
  TypeScript symbol-local navigation, then move to GitNexus when the question
  expands beyond one local symbol or file.
- During `/speckit.plan` and `plan-eng-review`, use GitNexus when a feature
  touches existing execution flows, APIs, MCP routes, persistence, runner
  behavior, sandbox/provider boundaries, or cross-package contracts. Record what
  was checked, or why GitNexus was not useful for that phase.
- Understand architecture / "How does X work?": `gitnexus-exploring`.
- Blast radius / "What breaks if I change X?": `gitnexus-impact-analysis`.
- Trace bugs / "Why is X failing?": `gitnexus-debugging`.
- Rename / extract / split / refactor: `gitnexus-refactoring`.
- PR review with graph-aware risk: `gitnexus-pr-review`.
- CLI operations (index, status, clean, wiki): `gitnexus-cli`.

### Product — Strategy & Requirements

- OKR cascade / market analysis / vision / team scaling: `product-strategist`.
- Feature requirements / PRD generation / acceptance criteria: `product-requirements`.
- RICE prioritization / interview analysis / go-to-market: `product-manager-toolkit`.

### Claude Design — Visual Design Pipeline

Use `claude-design-intake` to start any design task.

- Low-fi structure / layout: `claude-design-wireframe`.
- Visual direction / reference translation: `claude-design-frontend-direction`.
- Production HTML/CSS artifact: `claude-design-html-artifact`.
- Interactive prototype: `claude-design-prototype`.
- Design system / tokens: `claude-design-design-system`.
- Motion / animation: `claude-design-animation`.
- Deck / presentation: `claude-design-deck`.
- Focused visual tweak: `claude-design-tweaks`.
- Developer handoff: `claude-design-dev-handoff`.
- Canva handoff: `claude-design-canva-handoff`.
- Export PDF: `claude-design-export-pdf`.
- Export PPTX (editable): `claude-design-export-pptx-editable`.
- Export PPTX (screenshots): `claude-design-export-pptx-screenshots`.
- Export standalone HTML: `claude-design-export-standalone-html`.
- Read PDF for design context: `claude-design-pdf-read`.
- Core orchestration: `claude-design-core`.

## Engineering Rules

- Always load and follow relevant skills before starting work (e.g., `product-requirements` for PRD, `api-and-interface-design` for API design, `spec-driven-development` for features). Do not skip skill loading even when the task feels familiar.
- Surface assumptions before non-trivial changes.
- Stop on conflicting requirements instead of guessing.
- Keep changes scoped to the requested surface.
- Prefer existing repo patterns over new abstractions.
- Use shared Zod schemas at service boundaries.
- Do not add MVP-excluded features without an explicit product-boundary update.
- Verify before declaring work complete.

### Pre-0.1 Development Policy

Mystra is still under initial-version development. Until the project version is
bumped to `0.1.0` or later, do not preserve compatibility with earlier
development snapshots and do not create migration paths for them.

- Do not add backward- or forward-compatibility aliases, shims, fallbacks, or
  dual-read/dual-write paths for pre-`0.1.0` behavior.
- Do not create data, schema, API, configuration, CLI, or persisted-format
  migrations solely to retain pre-`0.1.0` compatibility.
- Replace obsolete contracts directly and update their callers, fixtures,
  tests, and documentation to the current intended model.
- Pre-`0.1.0` local development data may be destructively rebuilt to match the
  current schema; it is not a supported upgrade source.
- Migration and compatibility requirements begin at `0.1.0`, unless the owner
  explicitly establishes an earlier boundary for a specific contract.

## Current MVP Boundaries

Mystra MVP uses the Open Agents project as a source-authoritative framework
baseline and reference architecture, then defines Mystra-owned interfaces and
SDK surfaces where upstream does not provide reusable package contracts. The
current provider set is selectable SQLite, PostgreSQL, or Supabase-backed
PostgreSQL behind `RdbProvider`, GitHub Integration with
remote `RepoProvider` plus repository-scoped `IssueProvider`, read-only Linear
`IssueProvider`, direct Agent execution, Task-bound production coordinated by an internal TaskExecutionAttempt record, and Runtime as a first-class execution
backend that advertises its Provider (agent CLI) capabilities source-agnostically.
A host-bound Runtime enrolled by the TypeScript `mystra-runner` — registration
(endpoint-configured, no MVP pairing), Provider discovery plus availability
confirmation, and heartbeat/status — is in MVP scope; single-machine Docker is
one sandbox provider rather than the sole execution model, and host worktree
direct execution is the intended default execution direction. Feature 044 owns
host Runtime enrollment; 047–050 own Task Context, Workspace and Session
foundations; feature 051 introduced Task status and the attempt-scoped
`mystra-agent` context/status CLI; feature 054 owns the current five-state
vocabulary and handoff semantics. Feature 052 owns optional Agent Context and one
goal/autopilot Session per TaskExecutionAttempt. `mystra` remains the Control Plane management
CLI. The self-use Agent reads Linear with host-local `linctl` and creates its PR
with host-local `gh`; Mystra does not proxy or credential those tools. PR and
self-test text is Agent-reported and is not verified by Mystra.
Every Project binds one IntegrationConnection plus a provider-stable remote repository external ID and a
Mystra-owned configured `repositoryBaseBranch`. This is ordinary provider-neutral Project repository configuration,
not a Provider default-branch observation. Remote branch enumeration, symbolic `HEAD` inspection and exact branch
resolution use standard Git protocol rather than Integration-specific RepoProvider methods. Mutable repository names,
URLs, Provider default-branch observations, visibility, and archive/delete state are not Project persistence; their
retrieval and caching require a separate specification. Task persists its own
title, description and status plus immutable optional Project context and exact Issue references; it does not copy current
Issue/Repository snapshots. Future Integration cache design owns current external information. Local paths and
caller-supplied clone URLs are not Project repository inputs.

The near-term MVP goal is self-use: let an operator or another Agent select a
GitHub or Linear Issue and dispatch it through canonical API, thin CLI, remote
MCP, or the secondary Web client. Assigning an Agent to the resulting
Project-bound Task atomically moves `pending` to `in_progress`, creates one
TaskExecutionAttempt, requests Task Workspace preparation after commit, and
idempotently starts exactly one goal/autopilot Session once that shared
Workspace is ready. `mystra` remains the Human/external-Agent Control Plane
management CLI. The workload-local `mystra-agent` resolves the current attempt
through a short-lived execution code, returns its Task/Project/Issue-reference/
Workspace context, and lets the scoped Agent report `blocked` (Needs handoff) or
resume `in_progress`. The Agent reads Linear with the
host user's authenticated `linctl` and creates its PR with the host user's
authenticated `gh`; Mystra does not proxy, credential, or verify those tools.
Human actors own `done` and `canceled`. Session state never automatically
mutates Task status, and Mystra does not verify Agent-reported PR or self-test statements.
Attempt-owned heartbeat/event subscriptions, multiple Sessions, generic
Artifact submission and non-PR outputs are follow-up specifications.

The active MVP demo UI uses a Castrel-inspired primary menu: New, Search,
Inbox, and Issues, followed by Projects and a Team-scoped Tasks section.
Task icons reflect Task status. Existing Task, Session, Runner, and
Project object routes remain directly reachable even when they are not primary
menu items. `/automations` remains directly reachable as a Coming soon
placeholder, but it is not a primary menu entry and does not introduce a
general automation catalog. Task production controls remain Task surfaces; internal TaskExecutionAttempt records have no navigation or independent management surface. The first Prisma schema does not preserve
Session-, Runner-, or ContextBundle-derived views as persistence requirements;
resulting upper-layer failures are deferred. Web remains secondary to API, MCP,
and CLI.

Task is a durable Team-scoped production task with Mystra-owned title, description and status plus immutable
`0..1` Project context and `0..1` exact Issue references; it does not belong to Project. One exact Issue maps to at
most one Task, and current external requirement state remains provider-owned rather than copied or written back.
Task creation initializes `pending` and never launches a Session. Start on an eligible Task, optionally with explicit Agent Context, atomically enters
`in_progress`, creates one TaskExecutionAttempt and drives Workspace preparation plus exactly one first-version Autopilot Session.
TaskExecutionAttempt freezes the selected Agent name/revision/system-prompt snapshot when present and otherwise records no Agent; it is not an operator-facing product object and does not own a parallel production state machine.
Task status updates use a dedicated allowlisted transition service with expected revision, idempotency and append-only history.
One Session is the attempt's multi-turn execution conversation. Session is a Team-scoped execution object that belongs to neither Task nor
Project; it may independently reference `0..1` Task and `0..1` Project. Canonical launch atomically persists the Session,
frozen system prompt, and first user message, then Runtime/Provider execution begins after commit. Mystra has no Turn business
object; message identity is only command idempotency and SessionEvent correlation.
Feature 049's current launch slice requires a Task and consumes feature 048's ready Workspace. Project-only and standalone
Session preparation are deferred; future variants must reuse the same Workspace/attachment contract and differ only in preparation logic.
Runtime is a first-class execution backend that advertises its available
Provider capabilities; feature 044 owns host Runtime enrollment plus that
capability's persistence (registration, Provider discovery/availability,
heartbeat/status). SessionEvent is the typed, bounded, redacted, Team-authorized Session-scoped execution history;
it is not a top-level business object or log product. Runner protocol bookkeeping, Runtime-private filesystem facts,
cross-Session activity timelines, and arbitrary stdout/stderr persistence remain deferred. Runtime capacity is a future
Runtime capability; an idle ready Session does not reserve capacity.

The north-star model is a hosted **Mystra platform** serving many independent
**Teams**. Each Team may contain multiple Projects, Tasks, TaskExecutionAttempts, Sessions, and Agents
while sharing platform-owned provider pools such as sandbox capacity. Agent,
Task, Project, TaskExecutionAttempt, and Session are Team-scoped: Agent and Task do not belong
to Project, and Session belongs to neither Task nor Project. Session may
independently reference `0..1` of each and selects Runtime, Provider, optional Agent Context, and
Context as four independent execution inputs. A TaskExecutionAttempt-driven Session receives
those resolved inputs from its attempt and must use the attempt-frozen optional Agent snapshot. Every Session receives the program-owned, content-addressed Standard Execution Prompt; Agent Context is supplemental and lower priority.
Use this as the architectural direction when designing extensible interfaces,
even though the current MVP proves one private, single-node deployment path.

Reserve **workspace** for the unified execution working-directory and
execution-context delivery surface, not for tenancy. Feature 054 supersedes
048's Task-global cardinality: a Task may have one shared-mutable Workspace per
Runtime, uniquely identified by `(taskId, runtimeId)`. First Session launch uses the
selected Provider to resolve an eligible Runtime and atomically locks nullable
`Task.runtimeId`; all later Sessions must use that Runtime. Launch automatically
prepares or reuses its exact Workspace; setup is not a Human-facing prerequisite.
Cross-Runtime Workspace synchronization, Task Runtime migration and failover are deferred. Future Session modes must reuse the same Workspace/attachment type;
do not add a parallel Workspace type.

The intended long-term experience is similar in spirit to **Stripe Minion**:
fast task intake, clear Agent execution ownership, reviewable outputs, and
strong platform seams between Issue intake, runtime, Agent, and repository layers.

GitHub connection methods are deployment-aware. Self-hosted Mystra supports
explicit personal access token connections behind `SecretProvider`; the Mystra
GitHub App is a hosted capability. The open-source tree may retain the App
adapter, routes, and tests, but self-hosted management and credential entry
points must fail closed with a stable `hosted-only` capability result. Hosted
OAuth verifies that an authenticated actor may bind an installation to a Team;
the OAuth user token is discarded after verification, App identity secrets stay
platform-owned, and installation tokens are short-lived. App and PAT modes
never silently fall back to one another. Repository discovery and
RepoDeliveryProvider clone/push/review always resolve the exact connection bound
by the Project.
Feature 051's host-local `linctl`/`gh` workload path is an explicit self-use
exception: it does not invoke RepoDeliveryProvider, reuse the Project connection
credential, or make Mystra responsible for the external CLI identity/result.
The current self-hosted MVP does not implement the hosted App activation
prerequisites (hosted caller-identity federation, hosted Team tenancy, hosted
RDB, and managed secrets); until they land, hosted App capability remains
unavailable. Self-hosted Mystra does provide single-node human username/password
authentication (no email) and Owner/Admin/Member Team RBAC, where registration
grants every human User an initial Team they own, every User always belongs to at
least one Team, and Team is the top-level
tenant boundary (feature 043 owns this contract; it waits for 040 to land on
`main`).
The current self-hosted MVP otherwise excludes caller-login OAuth (SSO/social), logs
API/persistence, retry API, arbitrary callback URLs, quality-gate fix loops,
webhooks/Issue write-back, a general-purpose Integration management catalog,
public hosted multi-tenancy, hosted Team administration, Claude CLI, Kubernetes sandbox workloads,
cross-runner shared caches, per-repository secret management, and managed hosted
RDB provisioning/administration. User-configured PostgreSQL and Supabase-backed
PostgreSQL remain approved deployment targets. Hosted platform persistence
management remains a separate phase. GitLab is not an enabled/default
Integration, standing orders, general WorkflowProvider/DSL, arbitrary triggers,
and orchestration outside the Task-bound TaskExecutionAttempt remain excluded. GitLab may remain as a
runner-side `RepoDeliveryProvider`; that does not make it an active Project
repository Integration. PostgreSQL and Supabase-backed PostgreSQL are approved
deployment targets; the `RdbProvider` interface must not leak database dialect,
Prisma types, connection URLs, or pool handles.

## Documentation Discipline

This project is built by AI agents. Treat repository documentation as the durable memory surface.

- Always follow `aaa-spec-kit` and the `.codex/prompts/speckit.*` flow for non-trivial feature, contract, or implementation work.
- For non-trivial plans, run `plan-eng-review` after `/speckit.plan` and before
  `/speckit.tasks`; translate review findings into plan changes, task items, or
  explicit waived risks.
- Keep feature artifacts in `specs/<feature>/`; keep durable project rules in the 5xP files.
- When touching a submodule, add or update the smallest useful local documentation for its purpose, commands, configuration, contracts, and invariants.
- Do not rely on chat history as the only explanation for a design or implementation decision.
- If code, tests, runtime behavior, and docs disagree, stop and reconcile the contradiction before calling the work complete.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mystra**. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely. Because the shared MCP registry contains multiple repositories, always pass `repo: "mystra"`.

> Use only the exact repository-pinned CLI through `pnpm gitnexus:*`. Run
> `pnpm gitnexus:status`, repair native dependencies with the normal
> `pnpm install` flow if `pnpm gitnexus:doctor` fails, and rebuild with
> `pnpm gitnexus:rebuild`. The rebuild is index-only so GitNexus cannot replace
> Mystra's project-local skills or this durable context block.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({repo: "mystra", target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes({repo: "mystra"})` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({repo: "mystra", scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({repo: "mystra", query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({repo: "mystra", name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mystra/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mystra/clusters` | All functional areas |
| `gitnexus://repo/mystra/processes` | All execution flows |
| `gitnexus://repo/mystra/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.agents/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.agents/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.agents/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.agents/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.agents/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.agents/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Active Technologies
- TypeScript 5.9, Node.js 24 runtime assumptions + Next.js 16, React 19, Zod 4, Vitest 4, existing `better-sqlite3` provider (002-runtime-profile-context)
- SQLite via `SqliteRdbProvider`, with future PG/Supabase compatibility preserved behind `RdbProvider` (002-runtime-profile-context)
- TypeScript 5.9 with Node.js 24 runtime assumptions + Next.js 16 route handlers, Zod 4 shared schemas, Vitest 4, existing `better-sqlite3` provider, Node `child_process` for runner execution (003-config-first-runner-durability)
- SQLite via `SqliteRdbProvider`, behind `RdbProvider` so future PG/Supabase compatibility is preserved (003-config-first-runner-durability)
- TypeScript 5.9 with Node.js 24 runtime assumptions; Open Agents upstream currently serves as the source-authoritative architecture/code baseline rather than a direct Mystra runtime dependency or packaged SDK + Next.js 16 route handlers, React 19, Zod 4, Vitest 4, `better-sqlite3`, existing Mystra monorepo packages, and the upstream `vercel-labs/open-agents` repository as the architecture/code reference (004-open-agents-framework, 005-open-agents-source-baseline)
- Mystra persists state through `RdbProvider` with SQLite first; Open Agents upstream assumes hosted Postgres/KV-style managed services that Mystra must classify as reused concept, replaced seam, or excluded (004-open-agents-framework)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16 Route Handlers、React 19、Zod 4、Vitest 4、`better-sqlite3`、Node `child_process`、Linear GraphQL HTTP API、Docker Engine CLI、GitHub REST API、Copilot CLI `1.0.69-0` (033-issue-agent-execution)
- 038 replaces the obsolete 033 execution-object contract with Task intent,
  loose one-to-many Sessions, stable Runners, and exact destructive local schema
  rebuild without compatibility aliases.
- TypeScript 5.9, Node.js 24.14.0 + Next.js 16 Route Handlers, React 19, Zod 4, Vitest 4, `better-sqlite3`, Node `child_process`, existing provider/adapters (038-task-session-model)
- SQLite through `RdbProvider`; schema remains dialect-neutral at the provider contract (038-task-session-model)
- TypeScript 5.9，Node.js 24.14.0 + Prisma ORM/Client 7.9.1，`@prisma/adapter-better-sqlite3` 7.9.1，`@prisma/adapter-pg` 7.9.1，`pg`，Zod 4，Next.js 16 (040-prisma-rdb)
- SQLite；PostgreSQL；Supabase-backed PostgreSQL (040-prisma-rdb)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16 Route Handlers、React 19、Zod 4、Node `crypto`、GitHub REST API、现有 Integration/Runner provider contracts (039-github-project-onboarding)
- SQLite via `RdbProvider`；只保存 IntegrationConnection 非秘密元数据和 Project connection reference (039-github-project-onboarding)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16 Route Handlers、React 19、Zod 4、Node `crypto` / `fs`、GitHub REST API、现有 `better-sqlite3` (041-github-integration-connections)
- SQLite schema v5 via `RdbProvider`；PAT ciphertext 通过 `SecretProvider` 存于受保护文件目录，RDB 只保存 opaque reference (041-github-integration-connections)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16 Route Handlers、React 19、Zod 4、Node `child_process`（PATH 发现 + 登录 shell 兜底 + 版本 probe）、现有 `apps/runner-daemon`（TS）、Prisma via `RdbProvider` (044-host-runtime-daemon)
- SQLite/PostgreSQL 双 schema via `RdbProvider`：新增 Runtime + 可用 Provider 能力持久化；host `mystra-runner` 注册/发现/心跳，online/offline 依服务端接收时间 (044-host-runtime-daemon)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.1、`@prisma/adapter-better-sqlite3`、`@prisma/adapter-pg` (046-agent-definition)
- SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider` 暴露领域契约 (046-agent-definition)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.1、现有 GitHub/Linear Integration providers (047-task-context)
- SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider` 暴露领域合同 (047-task-context)
- TypeScript 5.9，Node.js 24.14.0 + Zod 4、Prisma ORM/Client 7.9.1、Next.js 16 Route Handlers、Vitest 4、Node `child_process`、Codex/Copilot CLI (049-session-launch-framework)
- SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，经 `RdbProvider`；新增 Session、append-only SessionEvent 与独立 dispatch lease/event stream/head 操作表；领域合同没有 Turn，messageId 仅为消息幂等/事件关联；049 只支持 Task-bound Session 并复用 048 Workspace，非 Task 准备策略延后；Runtime capacity 不入库 (049-session-launch-framework)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16、React 19、Zod 4、Vitest 4；直接复用 049 Session/SessionEvent shared contracts (050-task-session-experience)
- 050 不新增 Session summary/detail view 或持久化表；只增加 Task-filtered Session query、Task launch adapter 与 SessionEvent presentation (050-task-session-experience)
- TypeScript 5.9，Node.js 24.14.0 + Next.js 16、React 19、Zod 4、Prisma 7.9.1、Vitest 4、`@mystra/ui` (054-navigation-task-workbench)
- SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider`；在两套 Task row 增加单一 Metadata JSON payload，不新增关系表或 normalized columns (054-navigation-task-workbench)
## Recent Changes
- 002-runtime-profile-context: Added TypeScript 5.9, Node.js 24 runtime assumptions + Next.js 16, React 19, Zod 4, Vitest 4, existing `better-sqlite3` provider
