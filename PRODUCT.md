# Mystra Product

> Ship software with agents.

## Purpose

Mystra is an open-source platform for autonomous software delivery. You describe
what you want built; agents handle the full software development lifecycle —
planning, implementation, testing, and pull request delivery.

Mystra's core product model is a flexible software factory: standardized
requirements enter as Tasks, Providers perform flexible production under a
program-owned Standard Execution Prompt, and reviewable results leave the
factory. Feature 051 first standardizes the Task production lifecycle and a
narrow Agent status CLI. Feature 052 makes Agent Context optional: one
lightweight TaskExecutionAttempt always starts one goal/autopilot Session and freezes
an Agent snapshot only when the operator explicitly selects one.

Mystra remains a headless execution control plane. It owns durable intent, Task
status, execution truth, resource boundaries, and review handoff.
It does not infer business completion from Session output or verify the Agent's
PR/self-test statements in feature 051.

## Current domain boundary

- **Task** is a durable Team-scoped production task. It has Mystra-owned title,
  description and `status`, plus immutable `0..1` Project and `0..1`
  exact Issue references. Project is context, not ownership; external Issue
  status remains provider-owned and is neither copied nor mapped.
- **TaskExecutionAttempt** is one durable production attempt for one Project-bound Task. It
  freezes an optional selected Agent name/revision/system-prompt snapshot and associates exactly one long-running
  Autopilot Session. Feature 051 does not give TaskExecutionAttempt a parallel
  production state machine; multiple Sessions, attempt-owned heartbeat/event subscriptions
  and automatic recovery remain follow-up work.
- **Session** is a Team-scoped execution object and belongs to neither Task nor
  Project. It may independently reference `0..1` Task and `0..1` Project, and
  selects Runtime, Provider, optional Agent Context and execution Context independently. It supports
  serial user messages without a Turn business object. Feature 049's first
  execution slice requires a Task and consumes its ready Workspace; Project-only
  and standalone Session launch remain deferred without changing the north-star
  optional references. A TaskExecutionAttempt-driven Session receives these four resolved
  inputs from its attempt and MUST use the attempt-frozen optional Agent snapshot.
- **SessionEvent** is the typed, immutable, Session-scoped execution history.
  Team-authorized callers may page one Session's validated, bounded and redacted
  events; it is not a top-level business object, global activity feed, or log API.
- **Runtime** is a first-class execution backend. Runtime capacity/slot limits
  remain a future capability; an idle ready Session does not reserve capacity.
- **Workspace** is the unified execution working-directory and context-delivery
  contract. Feature 048 prepares one Runtime-affine Workspace per eligible Task,
  and resolves the same mutable Workspace attachment for every Task-bound
  Session. Feature 048 does not create Session、initial turn or Provider
  execution；feature 049 owns that atomic launch transaction. Future
  preparation for deferred Session modes must reuse this contract rather than
  introduce a parallel variant.
- **Runtime/Runner** enrollment and Runtime capability persistence are owned by
  feature 044. Session claim, continuation and lifecycle reporting are owned by
  feature 049; capacity/slot persistence and scheduling are a future capability.
- Runner protocol bookkeeping and Runtime-private filesystem details remain
  implementation facts rather than business objects.

## North-star operating model

Mystra's long-term model is a hosted **Mystra platform** serving many independent
**Teams**. Each Team may contain multiple Projects, Tasks, Sessions, and Agents
while sharing platform-owned provider pools. Team is the tenant boundary;
Project and Task are optional Session references rather than ownership parents.

```text
Mystra platform
  -> Team
    -> Agent
    -> Project
      -> Issue Integration / repository binding
    -> Task (status)
      -> TaskExecutionAttempt
        -> one Autopilot Session (MVP)
    -> Session
      -> project? (0..1 reference)
      -> task? (0..1 reference)
```

The intended experience is similar in spirit to Stripe Minion: fast intake,
clear Agent production ownership, a durable execution attempt, and reviewable output
without turning Mystra into a general-purpose workflow engine.

Tools that turn ideas into code already exist. They produce prototypes. Mystra
targets serious, shippable software: tested, reviewed, and maintainable.

## Users

- People with ideas who want working software without managing the build process.
- Teams that already use coding agents and want structured dispatch, execution,
  and delivery across projects.
- Organizations that want agent workloads running on infrastructure they control.

## Business model

The north-star is a hosted **Mystra platform** with an open-source core:

- **Open-source self-hosted** — run the core control plane and execution stack on
  your own infrastructure. Provider capabilities may differ from hosted Mystra.
- **Hosted SaaS** — managed execution plus platform-operated integrations that
  require a public callback, shared application identity, or managed secrets.

## Core model

- **IntegrationConnection** — provider-neutral Integration account or
  installation metadata, capability configuration, and an opaque credential
  reference. It never stores credential plaintext.
- **Project** — durable product/repository binding through one exact connection,
  a provider-stable repository external ID, and a Mystra-owned configured base
  branch. The configured branch is ordinary provider-neutral Project repository
  configuration; branch discovery and resolution use standard Git protocol, not
  an Integration-specific RepoProvider extension. Mutable provider observations
  such as repository name, URL, Provider default branch, visibility, and
  archive/delete state are not persisted on Project.
- **Task** — durable Team-scoped production task with title, description,
  Mystra-owned `status`, and immutable optional Project and exact
  Issue references. It has no Project ownership.
- **Agent** — Team-scoped behavior configuration with stable identity and one
  effect-related field, system prompt. It has no Project relation.
- **TaskExecutionAttempt (internal)** — durable coordination record for one Task production
  attempt. It freezes the optional Agent snapshot and launch inputs before a
  Session exists, then idempotently associates exactly one Autopilot Session in
  the first version. It is not an operator-facing product object, navigation
  destination, or parallel Task state machine.
- **TaskStatusTransition** — append-only record of an authorized, revision-safe
  Task status change.
- **Session** — Team-scoped execution object with independent optional Task and
  Project references in the north-star model; the current 048/049/050 slice is
  Task-bound only and defers Project-only/standalone launch.
- **Workspace** — one execution-directory/context-delivery contract; currently
  Task-owned, Runtime-affine and shared-mutable across that Task's Sessions.
- **Runtime/Runner** enrollment and advertised capabilities are first-class;
  Session capacity/slot scheduling remains owned by a future Runtime
  specification, not Workspace setup.

## Platform topology

```text
Mystra platform
  → Team
    → Agent
    → Project
    → Task (status)
      → TaskExecutionAttempt → one Autopilot Session
    → Session
      → Project? (0..1 reference)
      → Task? (0..1 reference)
```

Each Team may contain multiple Projects, Tasks, TaskExecutionAttempts, Sessions, and Agents
while sharing platform-owned execution pools. Session selects optional Agent Context independently
of its optional Project and Task references; a TaskExecutionAttempt-driven Session is the
narrow case where its attempt resolves and freezes the optional Agent snapshot.

## MVP scope

In scope:

- Next.js control plane with canonical Task, Session, Runner, Project, Issue,
  Integration, Repository, and review-handoff contracts. Existing Session and
  Runner callers are not persistence requirements for the first Prisma schema.
- Task status is exactly `pending`, `in_progress`, `blocked`, `done`,
  or `canceled`; `blocked` is displayed as Needs handoff / 待接手. Task has no
  `waiting_for_review`, `error`, or `failed` top-level status.
- `RdbProvider` with selectable SQLite, PostgreSQL, and Supabase-backed
  PostgreSQL deployments. Supabase reuses the PostgreSQL implementation while
  adding explicit pooled-runtime and direct-migration connection configuration.
- Destructive local development schema migration: precisely recognized obsolete
  schemas may be rebuilt; unknown or mixed schemas fail closed.
- GitHub remote repositories and repository-scoped Issues; read-only Linear
  Issues; stable Project repository bindings. Issue/Repo Info retrieval and
  caching remain separately designed Integration capabilities.
- Atomic create-or-open from an exact Project-scoped GitHub or Linear Issue to
  at most one Task; the Issue remains externally owned and read-only.
- Start production for an eligible Project-bound Task, with optional explicit Agent Context. Start
  atomically moves `pending` to `in_progress` and creates a TaskExecutionAttempt;
  after commit it prepares the Task Workspace, then idempotently starts
  exactly one goal/autopilot Session when the Workspace is ready.
- Two intentionally separate CLI surfaces: `mystra` manages Control Plane
  resources for Humans, external Agents, and automation; workload-local
  `mystra-agent` uses a short-lived, attempt-scoped execution code to return the
  current execution context and let the scoped Agent report `blocked` (Needs
  handoff) or resume `in_progress`. Human actors own `done` and `canceled`, and
  may resolve `blocked` to `in_progress` or `done`; Session state never
  automatically mutates Task status. Review, authorization, waiting
  for answers or information, and other causes remain future handoff reasons.
- In the self-use MVP, the executing Agent reads Linear through the host user's
  authenticated `linctl` and publishes a PR through the host user's
  authenticated `gh`. Mystra neither proxies those CLIs nor issues their
  credentials, and a missing or unauthenticated tool is reported by the Agent
  as `blocked` rather than silently falling back to a Project connection.
- Agent-authored PR and self-test notes are stored and displayed as unverified
  reports. Feature 051 does not query PRs, run tests, or validate delivery.
- Task-bound Session creation and persistence are deferred to feature 049;
  Project-only and standalone Sessions require a later specification that
  reuses the same Workspace/attachment contract.
- Multiple explicit GitHub connections with deployment-aware methods:
  self-hosted Mystra supports personal access tokens behind a protected
  SecretProvider. RDB persists only authenticated envelope ciphertext and a
  wrapped per-secret DEK; PAT plaintext and the deployment KEK stay outside
  RDB. Hosted Mystra additionally supports the platform-operated
  Mystra GitHub App. OAuth verifies each App installation owner, installation
  tokens remain short-lived, and every Project binds one exact connection for
  repository discovery and delivery. The open-source tree may retain the hosted
  GitHub App adapter and tests without making that method a supported
  self-hosted capability.
  Hosted App runtime activation is phased behind hosted caller-identity
  federation, hosted Team administration, hosted persistence, and managed secret
  prerequisites; those prerequisites are not part of the current self-hosted MVP.
- Self-hosted single-node human identity and access: username/password
  authentication with no email dependency, and Owner/Admin/Member Team RBAC.
  Registration grants every human User an initial Team they own, every User
  always belongs to at least one Team, Team is the
  top-level tenant boundary, and all protected API/MCP/CLI/Web operations resolve
  effective permissions server-side. Feature 043 owns this contract and waits for
  the 040 Prisma RDB integration on `main`.
- Stable pull-based Runtime enrollment, credential rotation, heartbeat and
  capability advertisement. Session execution claim, cancellation, continuation
  and lifecycle reporting belong to 049; capacity/slot accounting remains a
  future Runtime capability.
- Direct Docker sandbox and Agent execution with test, build, preview, branch,
  commit, review, and Agent-reported handoff evidence attached to `blocked`.
- Thin CLI, MCP, and secondary Web clients over the canonical API.
- Team-authorized, Session-scoped typed event history needed for execution,
  recovery and diagnosis.

Out of scope:

- Hosted multi-tenant caller-identity federation, general-purpose logs API or
  arbitrary stdout/stderr persistence, retry API, callbacks, or quality-fix loops.
- Cross-Session/global activity timelines, event search, and public
  internal-fact collections. Session-scoped typed history is the narrow in-scope exception.
- Claude CLI, Kubernetes sandboxes, cross-Runner shared caches, per-repository
  arbitrary secret management, and managed hosted RDB provisioning or
  administration. Connection-scoped GitHub PAT storage is the narrow exception
  required by the active GitHub Integration contract.
- Caller-login OAuth, webhooks, Issue write-back, a general-purpose Integration
  management catalog beyond the GitHub connection surface, public hosted Team
  administration, or GitLab as an enabled intake Integration.
- A general WorkflowProvider, user-configurable workflow DSL, workflow
  marketplace, standing orders, arbitrary triggers, or orchestration outside
  the Task-bound TaskExecutionAttempt. Future Production Recipes require explicit specs.
- Generic TaskExecutionAttempt/Artifact CLI commands, Artifact/Delivery contracts, and
  non-PR output profiles. Feature 051 includes only `mystra-agent whoami`,
  `context get`, and the scoped Task status commands.
- Attempt-owned heartbeat/event subscriptions, multiple Sessions, automatic
  Session recovery, and configurable Production Recipes.

## Success measures

- SQLite, PostgreSQL, and Supabase-backed PostgreSQL expose the same
  IntegrationConnection, Project, and Task CRUD behavior through `RdbProvider`.
- Repeating the same Issue dispatch key returns one Task; conflicting ownership
  fails explicitly.
- Repeating the same Start command with the same optional Agent intent returns one TaskExecutionAttempt and one
  `pending` → `in_progress` transition; replaying Workspace-ready continuation
  returns the same single Session.
- Agent status transitions are allowlisted, revision-safe, idempotent, and
  append-only audited; Agent capabilities cannot mark Tasks done or canceled.
- Session failure or completion does not automatically change Task
  `status` or create a second Session.
- Mutable Issue and repository information is never persisted as Task or Project
  snapshots.
- Database selection is explicit at installation time and credentials never
  appear in RDB records, logs, public responses, or operator-visible errors.
- Removed Session, Runtime/Runner, ContextBundle, event, and artifact persistence
  cannot re-enter through compatibility tables or raw SQL.

## Source documents

- `README.md`
- `PLATFORM.md`
- `PROCESS.md`
- `specs/038-task-session-model/`
- `docs/ARCHITECTURE.md`
- `docs/RUNNER-ENVIRONMENT.md`
