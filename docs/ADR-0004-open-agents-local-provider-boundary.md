# ADR-0004: Open Agents Baseline With Local-First Providers

## Status

Accepted, amended 2026-08-03 by the Task/Session/Runner contract migration.

## Context

Open Agents provides a useful source baseline for separating control surfaces,
Agent execution, sandboxing, and delivery. Mystra requires local development
without mandatory cloud services and needs reusable contracts where upstream
does not expose package-level seams.

## Decision

Use Open Agents as a source-authoritative reference architecture, not as an
assumed packaged runtime dependency. Mystra owns these provider seams:

- `RdbProvider`: SQLite first, hosted relational implementation later.
- `IntegrationPlugin`: Repository and/or Issue capabilities.
- `SandboxProvider`: single-machine Docker first.
- `RepoDeliveryProvider`: clone, push, and review delivery.
- `AgentProvider`: current Codex and Copilot adapters.

Mystra's canonical business model is Task intent, independent child Sessions,
and stable Runners. Core execution is a direct lifecycle; no workflow provider,
graph, or managed orchestration layer sits above the Agent.

Cloud services remain future provider implementations rather than MVP
requirements. Provider-specific assumptions must not leak into canonical
Task/Session/Runner contracts.

## Consequences

- Local development needs no hosted database or managed workflow service.
- Provider boundaries are explicit before future infrastructure is added.
- SQLite is appropriate for the private single-node MVP but not presumed to be
  the hosted production implementation.
- Remote MCP remains a Mystra-owned control surface.

## Verification

1. SQLite can persist and recover Task, Session, Runner, result, and artifact state.
2. A stable Runner can claim and complete a Session locally.
3. Docker execution and review delivery work without hosted orchestration.
4. A future RDB or sandbox adapter can be added without changing business-object contracts.
