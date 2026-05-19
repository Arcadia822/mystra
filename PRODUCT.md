# Mystra Product

> Orchestration of the coding agents, for the coding agents, by the coding agents.

## Purpose

Mystra is a self-use coding-agent orchestration platform. It uses the Open Agents project as a source-authoritative framework baseline and reference architecture, then defines Mystra-owned interfaces and SDK surfaces at the seams where upstream does not provide a reusable contract. The initial implementation replaces cloud-first infrastructure providers with local-first providers.

The first useful outcome is simple: an internal caller or remote MCP client can create a job for a repository project, Mystra assigns it to a runner, the runner executes the configured workflow inside the selected sandbox with the selected agent, and the platform returns a reviewable repository artifact.

Mystra should remain a **headless orchestration control plane** with pull-based runners. In architecture terms, it is closer to Jenkins / Salt / Nomad than to a pure file-driven local tool: declarative config can define projects, runtime templates, and workflow defaults, but the system still needs durable execution truth for jobs, runs, events, and artifacts.

## North Star Operating Model

Mystra's long-term operating model is a hosted **Mystra platform** that accepts
many independent software development streams at once. The neutral tenancy term
is **Team**: a Team can hold multiple projects, each with its own
workflow variant, runtime image, product route, user stories, and acceptance
criteria.

The intended user experience is similar in spirit to **Stripe Minion**: a fast,
clear path from task submission to workflow execution to reviewable output,
without collapsing platform contracts into one hardcoded implementation path.

The intended shape is:

```text
Mystra platform
  -> Team
    -> project
      -> product route / user stories / acceptance criteria
      -> workflow variant derived from shared platform primitives
      -> runtime image / execution contract
      -> jobs / runs / artifacts
```

This does not change the MVP boundary. It clarifies the direction that current
interfaces should preserve: Mystra should not hardcode a forever-single-project
or single-workflow operating model.

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
- Mystra-owned local workflow interface and first local implementation for the lifecycle orchestration path.
- Pull-based runner daemon over outbound long polling.
- Sandbox task execution on the runner host.
- Project-owned runtime configuration for Docker image, context bundles, mounts, ports, caches, and secret references.
- Shared platform-owned sandbox provider capacity that can be allocated across multiple Teams and projects.
- Agent execution through provider adapters.
- Repository artifact delivery through repository providers.
- Remote MCP server entrypoint for other agents and skills to submit user journeys and implementation requests.
- Structured lifecycle events and final run results.
- Workflow execution through a configurable runtime workflow path.
- Resolution of project/runtime/template inputs into execution contracts before runner-side execution.

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
- Hosted RDB provider implementation (PG/Supabase SqliteRdbProvider is MVP; SupabaseRdbProvider is post-MVP, but the interface must not leak SQLite dialect).
- Adoption of any external workflow or coding-agent SDK as an MVP requirement.

## Success Measures

- A fake runner can complete the full queued-to-terminal lifecycle through the control plane.
- The local SQLite provider can persist and recover job/run state without cloud services.
- The RdbProvider interface does not leak SQLite-specific semantics; a future PG implementation is a new class, not a rewrite.
- The Mystra-owned local workflow implementation can drive the MVP lifecycle deterministically on one machine.
- A real runner can claim a job, execute the configured workflow, and produce a reviewable repository artifact.
- Job/run state remains explainable from structured database records, without relying on transient container logs.
- Platform capabilities stay separate from per-job project configuration.
- Project runtime image configuration is explicit under `Project.runtime.image`; runner execution uses a resolved runtime contract.
- Project, runtime, and template inputs can grow declarative over time, but runners execute against resolved contracts rather than repeatedly consulting mutable config during the hot path.
- Other agents and skills can send work through Mystra remote MCP without needing direct runner or sandbox access.
- Documentation remains good enough for future agents to continue work from repository artifacts alone.
- The architecture can evolve from one local project path toward many Team/project lanes without rewriting core product contracts.
- The system can keep durable execution truth while still moving toward a shared-nothing scaling model that minimizes shared mutable hot-path state.

## Source Documents

- `README.md`
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/ADR-0004-open-agents-local-provider-boundary.md`
- `docs/ADR-0005-open-agents-source-baseline.md`
- `docs/RUNNER-ENVIRONMENT.md`
