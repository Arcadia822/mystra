# Mystra Product

> Issue-driven execution of coding agents, with reviewable evidence.

## Purpose

Mystra is a self-use coding-agent execution platform. It uses Open Agents as a
source-authoritative framework baseline, then owns the interfaces required at
its persistence, Integration, sandbox, Agent, and repository seams.

The first useful outcome is direct: an operator or Agent selects an Issue,
Mystra atomically creates a durable Task and an initial Session, a stable Runner
executes that Session inside a sandbox, and the platform returns tested,
previewable repository evidence for human review.

Mystra remains a headless execution control plane. It owns durable intent,
execution truth, resource boundaries, and review handoff; it does not own a
workflow graph above the Agent.

## Business model

- **Task** is durable work intent. It owns Project and immutable Repository
  context plus optional immutable Issue provenance. It has no execution state.
- **Session** is an independently created child of one Task. A Task may have
  zero or many Sessions for different subtasks. Each Session owns its objective,
  Agent, branch, runtime resolution, lifecycle, cancellation, and result.
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
- `RdbProvider` with SQLite for local development and a dialect-neutral boundary
  for a future PG/Supabase implementation.
- Destructive local development schema migration: precisely recognized obsolete
  schemas may be rebuilt; unknown or mixed schemas fail closed.
- GitHub remote repositories and repository-scoped Issues; read-only Linear
  Issues; immutable provider-resolved Project repository snapshots.
- Atomic Issue dispatch to one Task and its initial Session.
- Explicit creation of zero or many independent Sessions beneath a Task.
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
  secret management, and hosted RDB implementation.
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
