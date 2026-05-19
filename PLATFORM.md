# Mystra Platform

> Orchestration of the coding agents, for the coding agents, by the coding agents.

## Runtime Shape

Mystra is a TypeScript pnpm monorepo.

```text
apps/control-plane    Next.js route handlers, MCP endpoint, state-facing APIs
apps/workflows        Workflow provider implementations and orchestration adapters
apps/runner-daemon    Pull-based runner service
packages/shared       Zod schemas, state machine, events, result contracts
packages/agent-adapters
plugins/mystra        Mystra MCP workflow plugin skills
plugins/supabase      Supabase plugin skills for future/cloud provider work
supabase              Migrations, seed, generated database types
```

## Core Stack

- Language: TypeScript.
- Package manager: pnpm `10.25.0`.
- Framework baseline: Open Agents as source-authoritative reference architecture, with Mystra-owned interfaces and SDK surfaces at reusable seams.
- App framework: Next.js route handlers for the control plane.
- RDB provider, first implementation: local SQLite.
- Workflow interface, first implementation: Mystra-owned local workflow implementation.
- Runner daemon: Node.js TypeScript service.
- Sandbox provider, first implementation: single-machine sandbox task containers.
- Validation: Zod schemas shared across services.
- Test runner: Vitest.
- Agent provider contract: current adapter-backed agent execution.
- Repository provider contract in MVP: repository review delivery.
- Architecture posture: first-class single-node deployment first, with a shared-nothing clustered architecture later if scale, isolation, or availability require it.

## North Star Topology

Mystra should be designed as a hosted **Mystra platform** that can serve many
independent workstreams at once. The neutral tenancy unit is **Team**.

```text
Mystra platform
  -> Team
    -> project
      -> workflow variant
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

- Provider interfaces isolate local-first and cloud implementations.
- Mystra must remain operable as a headless system; core execution, workflow, and repository delivery must not depend on an interactive local UI being present.
- SQLite is the first business state source of truth.
- The local workflow implementation is orchestration only, not business storage.
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
- Workflow contracts should support a shared base plus Team/project-specific variants instead of assuming one global hardcoded lifecycle forever.
- Local development may use one machine, but the contract should still read like infrastructure that can scale into shared-nothing control-plane/worker topologies later.
- Project, runtime, and template inputs may be declared centrally, but job submission or assignment should resolve them into immutable workflow/runtime contracts before runner execution starts.
- Shared-nothing is a scaling direction for hot-path coordination, not a claim that Mystra can operate without durable state for jobs, runs, events, results, and artifacts.

## Provider Boundary

Mystra uses Open Agents as a source-authoritative baseline and defines provider seams where the original project uses managed services or does not expose a reusable package/interface boundary. Mystra owns the actual interface and SDK definitions at those seams.

```text
RdbProvider        local SQLite first; cloud RDB later
WorkflowProvider   Mystra-owned local implementation first; external adapters later if earned
SandboxProvider    single-machine sandbox first; stronger isolation later
RepoProvider       review-delivery contract first; provider variants later
AgentProvider      current adapter-backed execution first; more providers later
```

For repository delivery, 004 treats review-delivery provider seams as MVP contract scope, with current implementations targeting GitLab and GitHub.
Provider-specific realization lives in `specs/010-repo-provider-contracts/` so
workflow, runner, and agent surfaces do not hardcode one host as the only valid
target.

Provider implementations must be replaceable without rewriting product contracts or feature specs.

Headless operation is part of that boundary: the control plane, runner, and workflow surfaces should be invokable remotely and observable through APIs or MCP, so UI shells remain optional rather than architectural dependencies.

The intended scaling direction is shared nothing rather than tightly coupled service state. Single-node should stay a real product shape; clustered deployment should extend the same contracts by adding more independent control-plane and worker capacity, not by introducing an entirely different product model.

This also means Mystra is better described as a headless control-plane-and-runner system, closer to Jenkins / Salt / Nomad than to a pure file-driven local tool. A future cluster should reduce shared mutable hot-path state where possible, while preserving durable execution truth.

## Tenancy And Resource Direction

- **Mystra platform** owns shared providers, control-plane policy, and resource pools.
- **Team** is the tenancy and coordination scope for groups of projects and product inputs.
- **Project** owns repository identity, default runtime contract, and workflow customization inputs.
- **Workspace** is the run-scoped working directory and execution-context surface prepared for one run.
- **Run-time allocation** should allow one shared sandbox provider pool to serve many Teams and projects safely.

## Runner Host Facts

The current development runner is one concrete development environment. Details live in `docs/RUNNER-ENVIRONMENT.md`, but 5xP documents should describe platform contracts rather than overfit to one machine profile.
