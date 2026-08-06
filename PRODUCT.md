# Mystra Product

> Issue-driven execution of coding agents, with reviewable evidence.

## Purpose

Mystra is a self-use coding-agent execution platform. It uses Open Agents as a
source-authoritative framework baseline, then owns the interfaces required at
its persistence, Integration, sandbox, Agent, and repository seams.

The current persistence milestone is direct: an operator or Agent selects an
Issue and Mystra creates a durable Task. Session persistence and the execution
handoff are deferred for a separate redesign; the first Prisma schema must not
encode the former Session/Runner model merely to keep old surfaces running.

Mystra remains a headless execution control plane. It owns durable intent,
execution truth, resource boundaries, and review handoff; it does not own a
workflow graph above the Agent.

## Business model

- **Task** is currently a durable identity under one Project. The first Prisma
  model deliberately omits source, objective and Issue/Repository snapshots;
  those contracts will be redesigned with Linear/Issue Integration and cache.
- **Session** remains a future execution concept, but its persistence, Task
  relation, fields, lifecycle and CRUD are currently undefined and deferred.
- **Runner** is stable execution capacity with durable identity, health,
  capability, eligibility, credential rotation, and current assignments.
- Runner protocol bookkeeping and internal execution facts are implementation
  details, not business objects. A public activity timeline remains undecided.

## North-star operating model

Mystra's long-term model is a hosted **Mystra platform** serving many independent
**Teams**. Each Team may contain multiple Projects with their own Integrations,
Agent profiles, runtime images, product routes, user stories, and acceptance
criteria while sharing platform-owned provider pools.

```text
Mystra platform
  -> Team
    -> Project
      -> Task
        -> Session (0..N)
          -> review evidence / artifacts
      -> Issue Integration / Agent profile / runtime defaults
```

The intended experience is similar in spirit to Stripe Minion: fast intake,
clear Agent execution ownership, and reviewable output without turning Mystra
into a competing Agent or workflow engine.

## Users

- Internal operators who provision and observe Runners.
- Internal engineers or Agents that create Tasks and Sessions through HTTP,
  CLI, remote MCP, or the secondary Web client.
- Reviewers who inspect repository artifacts.
- Future hosted operators managing many Teams and Projects.

Public hosted multi-tenancy is not part of the MVP.

## MVP scope

In scope:

- Next.js control plane with canonical Task, Session, Runner, Project, Issue,
  Integration, Repository, and review-handoff contracts.
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
- Stable pull-based Runner enrollment, credential rotation, heartbeat,
  eligibility, capacity, claim, cancellation, and terminal completion.
- Direct Docker sandbox and Agent execution with test, build, preview, branch,
  commit, review, and `waiting_for_review` evidence.
- Thin CLI, MCP, and secondary Web clients over the canonical API.
- Internal structured execution facts needed for recovery and diagnosis.

Out of scope:

- Caller authentication, logs API or log persistence, retry API, callbacks, or
  quality-fix loops.
- Public activity timeline or a public internal-fact collection.
- Claude CLI, Kubernetes sandboxes, cross-Runner shared caches, per-repository
  secret management, and public hosted database administration.
- OAuth, webhooks, Issue write-back, Integration management UI, public hosted
  Team administration, or GitLab as an enabled intake Integration.
- A workflow provider, workflow DSL, workflow marketplace, standing orders, or
  platform-owned orchestration above the Agent.

## Success measures

- A Task remains valid and inspectable with zero Sessions.
- Ten sibling Sessions can coexist without coupled lifecycle changes.
- Repeating identical Issue dispatch returns the same Task/initial Session pair;
  contradictory dispatch fails explicitly.
- A stable Runner can claim one Session, execute it, release capacity, and
  persist review evidence transactionally.
- API, MCP, CLI, Web, persistence, and Runner protocol use only the canonical
  Task/Session/Runner model without compatibility aliases.
- The system retains durable execution truth while preserving a path from a
  private single-node deployment to many Team/Project lanes.

## Source documents

- `README.md`
- `PLATFORM.md`
- `PROCESS.md`
- `specs/038-task-session-model/`
- `docs/ARCHITECTURE.md`
- `docs/RUNNER-ENVIRONMENT.md`
