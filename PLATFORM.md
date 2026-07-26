# Mystra Platform

> Issue-driven execution of coding agents, with reviewable evidence.

## Runtime Shape

Mystra is a TypeScript pnpm monorepo.

```text
apps/control-plane    Next.js route handlers, MCP endpoint, state-facing APIs
apps/runner-daemon    Pull-based runner service
packages/shared       Zod schemas, state machine, events, result contracts
packages/agent-adapters
plugins/mystra        Mystra MCP and agent-facing skills
plugins/supabase      Supabase plugin skills for future/cloud provider work
supabase              Migrations, seed, generated database types
```

## Core Stack

- Language: TypeScript.
- Package manager: pnpm `10.25.0`.
- Framework baseline: Open Agents as source-authoritative reference architecture, with Mystra-owned interfaces and SDK surfaces at reusable seams.
- App framework: Next.js route handlers for the control plane.
- RDB provider, first implementation: local SQLite.
- Integration capability model: GitHub implements RepoProvider and
  IssueProvider; Linear implements read-only IssueProvider.
- Runner daemon: Node.js TypeScript service.
- Sandbox provider, first implementation: single-machine sandbox task containers.
- Validation: Zod schemas shared across services.
- Test runner: Vitest.
- Agent provider contract: current adapter-backed agent execution.
- Repository contracts in MVP: control-plane RepoProvider discovery and
  identity resolution, plus runner-side RepoDeliveryProvider clone/push/review.
- Architecture posture: first-class single-node deployment first, with a shared-nothing clustered architecture later if scale, isolation, or availability require it.

## North Star Topology

Mystra should be designed as a hosted **Mystra platform** that can serve many
independent workstreams at once. The neutral tenancy unit is **Team**.

```text
Mystra platform
  -> Team
    -> project
      -> Issue Integration / Agent profile
      -> runtime image / execution contract
      -> jobs / runs
```

MVP may implement only one concrete local path, but contracts should preserve
room for Team-scoped defaults, project-scoped overrides, and shared
platform resource pools.

## Important Commands

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm doctor
pnpm dev
pnpm dev:control-plane
pnpm dev:runner
pnpm lsp:typescript
```

Useful focused commands:

```sh
pnpm --filter @mystra/shared test
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/control-plane dev
pnpm lsp:typescript
```

## Code Navigation Tooling

- `pnpm lsp:typescript` starts the repo-local TypeScript language server for
  symbol-local navigation, references, rename preparation, and diagnostics.
- GitNexus remains the graph-aware layer for execution-flow understanding,
  impact analysis, and review risk.
- Use both together when a local symbol question turns into a cross-package or
  blast-radius question.

## Architectural Constraints

- Provider interfaces isolate external integrations and runtime
  implementations.
- Every Project binds exactly one provider-resolved remote repository snapshot.
  Project, Job, execution contract, and runner claim reuse that structure; no
  local-path or job-level repository override is supported.
- Mystra must remain operable as a headless system; core execution and repository delivery must not depend on an interactive local UI being present.
- SQLite is the first business state source of truth.
- Core execution is a direct lifecycle from resolved Job/Run to sandbox, Agent and repository delivery; there is no workflow provider or graph above the Agent.
- Runner hosts initiate outbound connections only.
- Runner daemon may access the host Docker socket; task containers must not mount it.
- Runner caches are performance aids only and must fall back to cold clone/install.
- Secrets must be injected at runtime through environment variables or read-only files.
- Do not bake Codex auth, Copilot tokens, proxy credentials, or runner secrets into images.
- Project runtime config owns per-project execution settings such as Docker image, context bundles, mounts, exposed ports, cache policy, and secret references.
- `Project.runtime.image` is the first-version Docker image contract; there is no top-level `Project.image` compatibility field.
- `JobSpec` carries task identity and optional policy-limited runtime overrides, not platform capabilities.
- Runner claim responses include a resolved runtime contract; runner daemons execute that contract instead of independently interpreting Project fields.
- Platform resource pools such as `SandboxProvider` capacity should remain platform-owned and allocatable across many Teams and projects rather than being modeled as project-private infrastructure.
- Agent-specific automation belongs in optional Agent plugin/hook packages rather than in the platform core; core execution must remain useful when no such plugin is installed.
- Local development may use one machine, but the contract should still read like infrastructure that can scale into shared-nothing control-plane/worker topologies later.
- Issue, project, runtime and Agent inputs may be declared centrally, but dispatch should resolve them into immutable execution contracts before runner execution starts.
- Shared-nothing is a scaling direction for hot-path coordination, not a claim that Mystra can operate without durable state for jobs, runs, events, results, and artifacts.

## Provider Boundary

Mystra uses Open Agents as a source-authoritative baseline and defines provider seams where the original project uses managed services or does not expose a reusable package/interface boundary. Mystra owns the actual interface and SDK definitions at those seams.

```text
RdbProvider           local SQLite first; cloud RDB later
IntegrationPlugin     named composition of repository and/or issue capabilities
RepoProvider          remote repository discovery and identity resolution
IssueProvider         GitHub repository-scoped; Linear read-only
SandboxProvider       single-machine sandbox first; stronger isolation later
RepoDeliveryProvider  runner clone, push and review delivery
AgentProvider         current adapter-backed execution first; more providers later
```

GitHub is the current Project repository Integration. Runner delivery retains
GitHub and GitLab implementations behind RepoDeliveryProvider; delivery
selection uses the frozen repository provider instead of inferring from a URL
hostname.
Provider-specific realization lives in `specs/010-repo-provider-contracts/` so
runner and agent surfaces do not hardcode one host as the only valid
target.

Provider implementations must be replaceable without rewriting product contracts or feature specs.

Headless operation is part of that boundary: the control plane and runner surfaces should be invokable remotely and observable through APIs, CLI or MCP, so UI shells remain optional rather than architectural dependencies.

The intended scaling direction is shared nothing rather than tightly coupled service state. Single-node should stay a real product shape; clustered deployment should extend the same contracts by adding more independent control-plane and worker capacity, not by introducing an entirely different product model.

This also means Mystra is better described as a headless control-plane-and-runner system, closer to Jenkins / Salt / Nomad than to a pure file-driven local tool. A future cluster should reduce shared mutable hot-path state where possible, while preserving durable execution truth.

## Tenancy And Resource Direction

- **Mystra platform** owns shared providers, control-plane policy, and resource pools.
- **Team** is the tenancy and coordination scope for groups of projects and product inputs.
- **Project** owns repository identity, default runtime contract, and Agent execution defaults.
- **Workspace** is the run-scoped working directory and execution-context surface prepared for one run.
- **Run-time allocation** should allow one shared sandbox provider pool to serve many Teams and projects safely.

## Runner Host Facts

The current development runner is one concrete development environment. Details live in `docs/RUNNER-ENVIRONMENT.md`, but 5xP documents should describe platform contracts rather than overfit to one machine profile.
