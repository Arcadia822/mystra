# ADR-0004: Open Agents Framework With Local-First Providers

## Status

Accepted

## Context

Mystra should align more directly with the Open Agents project instead of merely borrowing architectural inspiration from it. Open Agents provides a useful framework shape for coding agents: control surface, agent workflow, and sandbox execution are separate concerns.

The first Mystra implementation should not depend on cloud services for its core development loop. Early cloud dependencies make local iteration harder, blur provider boundaries, and can turn infrastructure choices into product assumptions before the contract is stable.

## Decision

Reuse the Open Agents project as Mystra's framework foundation, then adapt the provider layer for local-first execution.

Mystra's MVP keeps Codex CLI and GitHub Copilot CLI execution inside the task
container. That is an explicit divergence from the upstream Open Agents
agent-outside-sandbox model and must remain documented until a later feature
replaces it with a different contract.

The first provider implementations are:

- `RdbProvider`: local SQLite.
- `WorkflowProvider`: local dummy workflow implementation.
- `SandboxProvider`: single-machine Docker.
- `RepoProvider`: GitLab and GitHub review delivery behind a Mystra-owned
  repository contract.
- `AgentProvider`: Codex CLI and GitHub Copilot CLI.

Cloud services remain future provider implementations, not MVP requirements. Hosted RDB, Vercel Workflow/WDK, Vercel Sandbox, AI Gateway, or other managed services can be added later behind the same provider contracts if they earn their complexity.

The local dummy workflow provider is not equivalent to managed durable workflow infrastructure. It may drive deterministic MVP lifecycle transitions, but it must not claim long-lived replay, months-long pause/resume, or managed retry semantics unless those behaviors are actually implemented.

## Consequences

Positive:

- Local development can run without cloud database or workflow dependencies.
- Provider contracts are forced early, before cloud integrations can leak into product logic.
- Open Agents remains the framework reference while Mystra keeps control over runtime placement.
- Single-machine Docker keeps the first sandbox implementation concrete and testable.
- Remote MCP submission is a Mystra-owned control-surface extension, not a claim
  that the upstream web surface is reused unchanged.

Negative:

- The local dummy workflow provider has weaker durability than managed workflow systems.
- SQLite is appropriate for the first local implementation but not necessarily for multi-runner production scale.
- Some existing Supabase and Vercel Workflow assumptions must be revised or demoted to future provider work.

## Verification

The decision is validated when:

1. A local SQLite-backed control plane can create, update, and recover task/run state.
2. The dummy workflow provider can drive a queued run through assign, execute, and terminal state transitions.
3. The Docker sandbox provider can execute a single-machine task without cloud workflow or hosted RDB services.
4. The provider interfaces make a future cloud RDB or Vercel Workflow adapter possible without changing `TaskSpec`.
