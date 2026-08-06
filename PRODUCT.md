# Mystra Product

> Ship software with agents.

## Purpose

Mystra is an open-source platform for autonomous software delivery. You describe
what you want built; agents handle the full software development lifecycle —
planning, implementation, testing, and pull request delivery.

Tools that turn ideas into code already exist. They produce prototypes. Mystra
targets serious, shippable software: tested, reviewed, and maintainable.

## Users

- People with ideas who want working software without managing the build process.
- Teams that already use coding agents and want structured dispatch, execution,
  and delivery across projects.
- Organizations that want agent workloads running on infrastructure they control.

## Business model

The north-star is a hosted **Mystra platform** with an open-source core:

- **Open-source self-hosted** — run the full platform on your own infrastructure.
- **Hosted SaaS** — managed execution, no deployment required.

## Core model

- **Task** — durable work intent. Owns Project context and optional Issue
  provenance. Has no execution state.
- **Session** — an independently executable child of a Task. Owns objective,
  Agent, branch, lifecycle, and result. A Task may have zero or many Sessions.
- **Runner** — stable execution capacity with durable identity, health, and
  credential rotation.

## Platform topology

```text
Mystra platform
  → Team
    → Project
      → Task
        → Session (0..N)
          → sandbox → Agent → tested PR
```

Each Team may contain multiple Projects with their own integrations, agent
profiles, and runtime configuration, while sharing platform-owned execution
pools.

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
- One active GitHub App installation connection for the private single-node MVP:
  OAuth verifies the installation owner, durable state stores only non-secret
  installation metadata, and short-lived installation tokens authorize
  repository discovery and delivery.
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
- Caller-login OAuth, webhooks, Issue write-back, a general-purpose Integration
  management catalog beyond the GitHub connection surface, public hosted Team
  administration, or GitLab as an enabled intake Integration.
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
