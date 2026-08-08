# Mystra Product

> Ship software with agents.

## Purpose

Mystra is an open-source platform for autonomous software delivery. You describe
what you want built; agents handle the full software development lifecycle —
planning, implementation, testing, and pull request delivery.

The current persistence milestone is direct: an operator or Agent selects an
Issue and Mystra creates a durable Task. Session persistence and the execution
handoff are deferred for a separate redesign; the first Prisma schema must not
encode the former Session/Runner model merely to keep old surfaces running.

Mystra remains a headless execution control plane. It owns durable intent,
execution truth, resource boundaries, and review handoff; it does not own a
workflow graph above the Agent.

## Current domain boundary

- **Task** is a durable Team-scoped identity and does not belong to Project. The
  current Prisma `projectId` relation is an obsolete pre-0.1 implementation gap;
  source, objective and Issue/Repository snapshots remain deferred.
- **Session** is a Team-scoped execution concept and belongs to neither Task nor
  Project. It may independently reference `0..1` Task and `0..1` Project; its
  remaining persistence fields, lifecycle and CRUD are deferred.
- **Runtime/Runner** persistence is deferred for a separate capacity and sandbox
  provider design; the first Prisma schema does not define either table.
- Runner protocol bookkeeping and internal execution facts are implementation
  details, not business objects. A public activity timeline remains undecided.

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
    -> Task
    -> Session
      -> project? (0..1 reference)
      -> task? (0..1 reference)
      -> review evidence (future)
```

The intended experience is similar in spirit to Stripe Minion: fast intake,
clear Agent execution ownership, and reviewable output without turning Mystra
into a competing Agent or workflow engine.

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
- **Project** — durable product/repository binding through one exact connection
  and provider-stable repository external ID. Mutable repository information is
  not persisted on Project.
- **Task** — durable Team-scoped identity with optional Issue dispatch key and
  metadata. It has no Project ownership or execution state.
- **Agent** — Team-scoped behavior configuration with stable identity and one
  effect-related field, system prompt. It has no Project relation.
- **Session** — Team-scoped execution object with independent optional Task and
  Project references; neither object owns it.
- **Runtime/Runner** remains an execution-capacity concept owned by its separate
  specifications.

## Platform topology

```text
Mystra platform
  → Team
    → Agent
    → Project
    → Task
    → Session
      → Project? (0..1 reference)
      → Task? (0..1 reference)
      → sandbox → Agent → tested PR
```

Each Team may contain multiple Projects, Tasks, Sessions, and Agents while
sharing platform-owned execution pools. Session selects Agent independently of
its optional Project and Task references.

## MVP scope

In scope:

- Next.js control plane with canonical Task, Session, Runner, Project, Issue,
  Integration, Repository, and review-handoff contracts. Existing Session and
  Runner callers are not persistence requirements for the first Prisma schema.
- `RdbProvider` with selectable SQLite, PostgreSQL, and Supabase-backed
  PostgreSQL deployments. Supabase reuses the PostgreSQL implementation while
  adding explicit pooled-runtime and direct-migration connection configuration.
- Destructive local development schema migration: precisely recognized obsolete
  schemas may be rebuilt; unknown or mixed schemas fail closed.
- GitHub remote repositories and repository-scoped Issues; read-only Linear
  Issues; stable Project repository bindings. Issue/Repo Info retrieval and
  caching remain separately designed Integration capabilities.
- Idempotent Issue dispatch to one Task through `issueDispatchKey`.
- Session creation and persistence are deferred for separate redesign.
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
- Stable pull-based Runner enrollment, credential rotation, heartbeat,
  eligibility, capacity, claim, cancellation, and terminal completion.
- Direct Docker sandbox and Agent execution with test, build, preview, branch,
  commit, review, and `waiting_for_review` evidence.
- Thin CLI, MCP, and secondary Web clients over the canonical API.
- Internal structured execution facts needed for recovery and diagnosis.

Out of scope:

- Hosted multi-tenant caller-identity federation, logs API or log persistence, retry API, callbacks, or
  quality-fix loops.
- Public activity timeline or a public internal-fact collection.
- Claude CLI, Kubernetes sandboxes, cross-Runner shared caches, per-repository
  arbitrary secret management, and managed hosted RDB provisioning or
  administration. Connection-scoped GitHub PAT storage is the narrow exception
  required by the active GitHub Integration contract.
- Caller-login OAuth, webhooks, Issue write-back, a general-purpose Integration
  management catalog beyond the GitHub connection surface, public hosted Team
  administration, or GitLab as an enabled intake Integration.
- A workflow provider, workflow DSL, workflow marketplace, standing orders, or
  platform-owned orchestration above the Agent.

## Success measures

- SQLite, PostgreSQL, and Supabase-backed PostgreSQL expose the same
  IntegrationConnection, Project, and Task CRUD behavior through `RdbProvider`.
- Repeating the same Issue dispatch key returns one Task; conflicting ownership
  fails explicitly.
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
