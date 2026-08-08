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
- Task owns editable title/description plus immutable optional Project and exact
  Issue references. It does not own frozen external Issue state.
- Session owns one independent execution contract and lifecycle.
- Runner owns stable capacity identity and performs claimed Session work.
- `RdbProvider` owns durable business state; SQLite is only its first adapter.
- Internal execution facts are persistence/protocol details, not management
  resources.

## Data and control flow

Manual API/MCP/CLI/Web creation persists a Task with optional Project context and
no Issue. A Project-scoped GitHub or Linear Issue row resolves current
Integration data and atomically creates or returns the one Task for that exact
Issue. Neither path creates, launches, queues, or configures a Session, and no
external Issue write-back occurs.

Session launch and its relation/default-routing behavior remain a separate
specification. Task and Project context must not be treated as launch
prerequisites by Task APIs.

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
