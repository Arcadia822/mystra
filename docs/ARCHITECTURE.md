# Mystra Architecture

## Shape

Mystra is a headless control plane with stable pull-based Runners.

```text
API / MCP / CLI / Web
        |
  control plane
  - Integrations
  - Task / Session / Runner management
  - RdbProvider
        |
     SQLite

stable Runner --outbound claim--> control plane
      |
 SandboxProvider -> AgentProvider -> RepoDeliveryProvider
```

## Ownership boundaries

- Project owns remote Repository identity and runtime defaults.
- Task owns immutable work intent and the frozen Repository/Issue context.
- Session owns one independent execution contract and lifecycle.
- Runner owns stable capacity identity and performs claimed Session work.
- `RdbProvider` owns durable business state; SQLite is only its first adapter.
- Internal execution facts are persistence/protocol details, not management
  resources.

## Data and control flow

Issue dispatch resolves current Integration data and atomically persists a Task
plus initial Session. Manual API/MCP creation may persist a Task with no Session.
Each subsequent Session inherits immutable Task/Project context while selecting
its own objective, Agent, branch, and permitted runtime override.

Runner registration is separate from Session claims. Re-registration rotates a
credential without changing Runner identity. Claims are atomic, capacity-bound,
eligible by Project/runtime, and return Task context with one Session.

Terminal completion is a single database transaction covering Session state,
result, internal facts, and released Runner capacity. Cancellation affects only
the target Session. Stale detection fails only active assignments and does not
retry or reassign.

## Replaceable providers

- `RdbProvider`: SQLite now, hosted relational adapter later.
- `IntegrationPlugin`: named RepoProvider and/or IssueProvider capabilities.
- `SandboxProvider`: local Docker now, stronger isolation later.
- `AgentProvider`: Codex/Copilot adapters.
- `RepoDeliveryProvider`: branch push and review delivery.

No provider may force dialect- or vendor-specific fields into canonical
Task/Session/Runner contracts.

## Scaling direction

The MVP is private and single-node. Future hosted operation can add Team scope,
more control-plane replicas, and shared provider pools while preserving stable
business contracts. Workspace always means Session-scoped execution storage,
never tenancy.
