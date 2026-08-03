# Mystra

> Orchestration of the coding agents, for the coding agents, by the coding agents.

Mystra is an open-source coding-agent orchestration platform.

It provides a headless control plane for submitting work through HTTP, CLI or MCP,
a local-first persistence layer, pluggable Issue/runtime/repository seams, and
pull-based runners that execute agents in sandboxes and return structured review
handoffs.

Mystra uses [Open Agents](https://github.com/vercel-labs/open-agents) as a
**source-authoritative baseline and reference architecture**, while keeping
Mystra-owned interfaces at provider and execution seams.

## Current status

Mystra is in active MVP development.

Today the repository is focused on proving a local-first path with:

- a Next.js control plane
- SQLite behind `RdbProvider`
- GitHub `RepoProvider` + repository-scoped `IssueProvider`, and read-only
  Linear `IssueProvider`, behind composable Integrations
- a pull-based runner daemon
- Task intent with independent child Session → Sandbox → Agent execution
- repository delivery for GitLab and GitHub
- agent execution through current provider adapters
- canonical API with CLI, remote MCP, and Web clients
- completed Control Plane, Task, Runner, and Project inspection pages while the
  final `025-webui` operator shell is consolidated

The MVP is primarily for self-use. The long-term direction is to provide a
developer experience similar in spirit to **Stripe Minion**: fast Issue intake,
clear execution ownership, reviewable outputs, and strong platform boundaries
between runtime, agent and repository delivery. Optional orchestration may return
later as an agent hook plugin; it is not an active runtime dependency.

## Why Mystra exists

Mystra is designed for teams that want a platform-shaped way to run coding agents on infrastructure they control, while preserving clean contracts between:

- control plane and runner
- Issue intake and persistence
- sandbox runtime and agent adapters
- platform capabilities and project-specific configuration

The architecture should remain **headless by default**: Mystra should have a first-class single-node shape, and later grow into a **shared-nothing clustered architecture** without redefining the product model. The same control-plane and runner contracts should survive the move from one local machine to remote hosts and pooled execution.

This makes Mystra closer to a **control-plane-and-runner system** in the Jenkins / Salt / Nomad family than to a pure file-driven local tool. Declarative configuration may grow over time, but Mystra still needs durable Task, Session, Runner, result, and repository-artifact truth.

The long-term direction is a hosted **Mystra platform** that serves many **Teams**
and projects, each with its own runtime and agent configuration, while sharing
platform-owned provider pools. A workspace is Session-scoped execution storage, not
tenancy.

## Architecture at a glance

```text
apps/control-plane    Next.js route handlers, state-facing APIs, MCP endpoint
apps/runner-daemon    Pull-based runner service
packages/shared       Zod schemas, state machine, events, result contracts
packages/agent-adapters
plugins/mystra
plugins/supabase
supabase
```

```mermaid
flowchart LR
    Caller[MCP client / API caller] --> CP[control-plane]
    CP --> DB[(RdbProvider)]
    CP --> Integration[IntegrationPlugin]
    Integration --> Issue[IssueProvider]
    Integration --> Repository[RepoProvider]
    Runner[runner-daemon] --> CP
    Runner --> Sandbox[SandboxProvider]
    Sandbox --> Agent[AgentProvider]
    Agent --> Repo[RepoDeliveryProvider]
    Shared[packages/shared] --> CP
    Shared --> Runner
```

### Provider seams

| Provider | Current implementation | Direction |
|---|---|---|
| `RdbProvider` | SQLite | Hosted/cloud RDB later |
| `IntegrationPlugin` | GitHub and Linear | Additional capability compositions later |
| `RepoProvider` | GitHub remote repository discovery | GitLab and other repository integrations later |
| `IssueProvider` | GitHub repository-scoped; Linear read-only | Additional issue integrations later |
| `SandboxProvider` | Local sandbox path | Stronger isolation / cloud sandbox later |
| `RepoDeliveryProvider` | GitHub and GitLab | Additional delivery hosts or variants later |
| `AgentProvider` | Current agent adapters | Additional agent providers later |

## Quick start

### Prerequisites

- Node.js 24.x
- pnpm

### Install and verify

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

### Start the local loop

Start the control plane:

```sh
pnpm dev:control-plane
```

Start a local runner in another terminal:

```sh
MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 pnpm dev:runner
```

If you want the shortest operator path on this machine, use:

```sh
./scripts/start-local.sh
pnpm run doctor
```

For a full local protocol walk, MCP examples, restart-durability checks, and development-machine deployment notes, see [docs/LOCAL-USAGE.md](docs/LOCAL-USAGE.md).

## Core commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages/apps |
| `pnpm typecheck` | Execute TypeScript checks across the repo |
| `pnpm lint` | Execute repo lint/type lint commands |
| `pnpm test` | Execute the test suite |
| `pnpm doctor` | Execute local preflight checks |
| `pnpm dev:control-plane` | Start the control plane |
| `pnpm dev:runner` | Start the local runner |
| `pnpm lsp:typescript` | Start the repo-local TypeScript language server |
| `pnpm run deploy:dev` | Deploy to the configured development machine |
| `pnpm operator:cli -- tasks list` | Inspect canonical Task resources |
| `pnpm preview -- list` | Inspect retained preview environments |

## Code navigation

- Use `pnpm lsp:typescript` for TypeScript symbol-local questions such as
  definitions, references, diagnostics, and rename preparation.
- Use GitNexus for graph-aware questions such as execution flow, impacted
  callers, and blast radius.
- Use both together when you start from one symbol and then need to understand
  wider repository behavior.

## MVP scope

### In scope

- control-plane APIs and MCP entrypoint
- GitHub remote repositories and repository-scoped Issues, plus read-only
  Linear Issues, behind composable Integrations
- immutable provider-resolved remote repository snapshots for every Project
- stable pull-based Runner registration, credential rotation, and Session claim
- internal execution facts and final Session results
- project-scoped runtime configuration
- direct Docker sandbox and Agent execution with test/build/preview evidence
- GitHub PR review delivery and durable `waiting_for_review` handoff
- thin CLI, remote MCP, and secondary Web clients over the canonical API
- Control Plane, Task, Session, Runner, and Project object pages as the
  secondary operator Web client
- provider seams that keep local-first and future hosted implementations replaceable

### Out of scope

- control-plane caller authentication
- logs API or log persistence
- retry API
- callback URLs
- quality-gate fix loops
- OAuth, webhooks, Issue write-back, or Integration management UI
- public hosted multi-tenancy or Team administration
- per-repository secret management
- Kubernetes sandbox workloads
- hosted cloud RDB implementation
- GitLab as an enabled/default Integration (its existing runner-side delivery
  provider remains available behind the delivery contract)
- standing orders or platform-owned workflow automation above the Agent

## Documentation map

- [docs/LOCAL-USAGE.md](docs/LOCAL-USAGE.md) — local usage, smoke paths, and operator runbook
- [docs/DEMO-FLOW.md](docs/DEMO-FLOW.md) — live demo script and capability-tour framing
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture notes
- [docs/SPEC.md](docs/SPEC.md) — product and engineering boundaries
- [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) — phased implementation plan
- [docs/repoindex/overview.md](docs/repoindex/overview.md) — repository overview for brownfield onboarding
- [docs/ADR-0001-control-plane-runner.md](docs/ADR-0001-control-plane-runner.md) through [docs/ADR-0005-open-agents-source-baseline.md](docs/ADR-0005-open-agents-source-baseline.md) — architecture decision records

## Project context

Mystra keeps durable repository context in the 5xP files:

- [PRODUCT.md](PRODUCT.md)
- [PLATFORM.md](PLATFORM.md)
- [PROCESS.md](PROCESS.md)
- [PROFILE.md](PROFILE.md)
- [AGENTS.md](AGENTS.md)

These files describe product boundaries, platform constraints, development-process rules, and agent-facing repository conventions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

In short:

1. Fork the repository.
2. Create a branch from `main`.
3. Make a focused change.
4. Execute `pnpm typecheck && pnpm test`.
5. Open a pull request that explains the motivation and scope.

## License

[MIT](LICENSE)
