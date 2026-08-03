# Mystra Product

> Issue-driven execution of coding agents, with reviewable evidence.

## Purpose

Mystra is a self-use, issue-driven coding-agent execution platform. It uses the Open Agents project as a source-authoritative framework baseline and reference architecture, then defines Mystra-owned interfaces and SDK surfaces at the seams where upstream does not provide a reusable contract. Control-plane state remains local-first for development, while every Project repository is remote and provider-resolved.

The first useful outcome is simple: an operator selects an Issue, Mystra resolves it into an immutable Job/Run, a runner starts the selected Agent inside the selected sandbox, and the platform returns a tested, previewable repository artifact for human review.

Mystra should remain a **headless execution control plane** with pull-based runners. It owns durable execution truth, resource boundaries and review handoff; it does not own a workflow graph above the Agent. Declarative config can define integrations, projects, runtime templates and Agent defaults, while Agent-specific plugin/hooks may extend behavior below the core execution contract.

## North Star Operating Model

Mystra's long-term operating model is a hosted **Mystra platform** that accepts
many independent software development streams at once. The neutral tenancy term
is **Team**: a Team can hold multiple projects, each with its own
Issue source, Agent profile, runtime image, product route, user stories, and acceptance
criteria.

The intended user experience is similar in spirit to **Stripe Minion**: a fast,
clear path from Issue selection to Agent execution to reviewable output,
without turning the platform into a competing Agent or workflow engine.

The intended shape is:

```text
Mystra platform
  -> Team
    -> project
      -> product route / user stories / acceptance criteria
      -> Issue Integration / Agent profile
      -> runtime image / execution contract
      -> jobs / runs / artifacts
```

This does not change the MVP boundary. It clarifies the direction that current
interfaces should preserve: Mystra should not hardcode a forever-single-project,
single-Issue-provider or single-Agent operating model.

The deployment path should stay **single-node first** and later expand into a
**shared-nothing clustered** form where practical. That clustering direction is
about minimizing shared mutable hot-path state, not about pretending Mystra can
operate without durable run state at all.

## Users

- Internal platform operators who provision and observe runners.
- Internal engineers or agents that submit coding tasks through HTTP or Mystra remote MCP.
- Reviewers who inspect the produced repository artifacts.
- Future hosted operators who manage many Teams and project lanes on the same Mystra platform.

Mystra is not a public multi-tenant product in the MVP.

## Product Boundaries

In scope for the MVP:

- Open Agents source-authoritative baseline and reference architecture reuse.
- Next.js control plane.
- RdbProvider interface with SQLite implementation for local dev; interface designed for PG/Supabase compatibility (production target). Schema covers projects, jobs, runs, runner sessions, events, results, and artifacts.
- Composable Integration plugins: GitHub provides remote repositories and
  repository-scoped Issues; Linear provides read-only Issues.
- Project-owned immutable remote repository snapshots resolved through a
  RepoProvider. Local paths and caller-supplied clone URLs are not Project
  repository inputs.
- Pull-based runner daemon over outbound long polling.
- Sandbox task execution on the runner host.
- Project-owned runtime configuration for Docker image, context bundles, mounts, ports, caches, and secret references.
- Shared platform-owned sandbox provider capacity that can be allocated across multiple Teams and projects.
- Agent execution through provider adapters.
- Repository artifact delivery through runner-side RepoDeliveryProviders,
  using the same frozen repository snapshot as Project, Job, and execution
  contracts.
- Remote MCP server entrypoint for other agents and skills to submit user journeys and implementation requests.
- A canonical Web API with CLI, remote MCP, and Web as thin clients of the same
  Integration, Repository, Project, Issue, Job, and review-handoff contracts.
- A secondary internal operator Web surface. Its completion target is the
  `025-webui` shell: primary navigation contains only `Overview`, `Inbox`,
  `New Job`, and `Projects`; `Settings` is a shell action/modal and
  `Recent Jobs` is a secondary route. Existing Control Plane, Task, Runner,
  and Project object pages remain supported during that migration.
- Structured lifecycle events and final run results.
- Direct Job/Run to SandboxProvider, AgentAdapter and RepoProvider execution without a workflow provider, blueprint or node graph.
- Bounded Agent autonomy configured by the selected Agent adapter.
- Resolution of Issue, project, runtime and Agent inputs into execution contracts before runner-side execution.
- A durable `waiting_for_review` handoff that releases runner capacity while retaining review evidence and preview state.

Explicitly out of scope for the MVP:

- Control-plane caller authentication.
- Logs API or log persistence.
- Retry API.
- Callback URLs.
- Quality-gate fix loops.
- Claude CLI adapter.
- Kubernetes sandbox workloads.
- Cross-runner shared caches.
- Per-repository secret management.
- Hosted RDB provider implementation (SQLite is the MVP implementation;
  PG/Supabase is post-MVP, but `RdbProvider` must not leak SQLite dialect).
- Public hosted multi-tenant operation or Team administration surfaces.
- OAuth, webhook, Issue write-back, and Integration management UI.
- GitLab as an enabled/default Integration or control-plane RepoProvider.
  Existing GitLab runner-side `RepoDeliveryProvider` support remains a
  replaceable delivery implementation, not an active repository-discovery
  product surface.
- A core workflow provider, workflow DSL, workflow marketplace or workflow graph above the Agent.
- Standing orders, agent-operated workflow automation, or another platform
  orchestration layer above direct Agent execution.
- Codex plugin/hook implementation as a core execution dependency.
- Adoption of any external workflow SDK as an MVP requirement.

## Success Measures

- A fake runner can complete the full queued-to-terminal lifecycle through the control plane.
- The local SQLite provider can persist and recover job/run state without cloud services.
- The RdbProvider interface does not leak SQLite-specific semantics; a future PG implementation is a new class, not a rewrite.
- GitHub and Linear IssueProviders can resolve an external Issue into a
  traceable immutable Job input without changing the Project repository.
- API is canonical; CLI and Web use the same Integration, Repository, Project,
  Job, and review-handoff contracts.
- A real runner can claim a Job, launch the selected Agent directly in a sandbox, and produce a reviewable repository artifact.
- Job/run state remains explainable from structured database records, without relying on transient container logs.
- Platform capabilities stay separate from per-job project configuration.
- Project runtime image configuration is explicit under `Project.runtime.image`; runner execution uses a resolved runtime contract.
- Issue, project, runtime and Agent inputs can grow declarative over time, but runners execute against resolved contracts rather than repeatedly consulting mutable config during the hot path.
- Other agents and skills can send work through Mystra remote MCP without needing direct runner or sandbox access.
- API is the canonical product implementation and CLI remains a thin client over it.
- Successful machine execution produces test/build evidence, an accessible preview, a repository review artifact and `waiting_for_review` state.
- Documentation remains good enough for future agents to continue work from repository artifacts alone.
- The architecture can evolve from one private single-node deployment toward many Team/project lanes without rewriting core product contracts.
- The system can keep durable execution truth while still moving toward a shared-nothing scaling model that minimizes shared mutable hot-path state.

## Source Documents

- `README.md`
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/ADR-0004-open-agents-local-provider-boundary.md`
- `docs/ADR-0005-open-agents-source-baseline.md`
- `docs/RUNNER-ENVIRONMENT.md`
