# Mystra Platform

## Runtime Shape

Mystra is a TypeScript pnpm monorepo.

```text
apps/control-plane    Next.js route handlers, MCP endpoint, state-facing APIs
apps/workflows        Workflow provider implementations and orchestration adapters
apps/runner-daemon    Bare-metal runner service
packages/shared       Zod schemas, state machine, events, result contracts
packages/agent-adapters
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
- Runner daemon: Node.js TypeScript service under systemd on bare metal.
- Sandbox provider, first implementation: single-machine Docker task containers.
- Validation: Zod schemas shared across services.
- Test runner: Vitest.
- Agent CLIs: Codex CLI and GitHub Copilot CLI.
- Repository provider contract in MVP: GitLab and GitHub review delivery.

## North Star Topology

Mystra should be designed as a hosted **Mystra platform** that can serve many
independent workstreams at once. The neutral tenancy unit is **workspace**.

```text
Mystra platform
  -> workspace
    -> project
      -> workflow variant
      -> runtime image / execution contract
      -> jobs / runs
```

MVP may implement only one concrete local path, but contracts should preserve
room for workspace-scoped defaults, project-scoped overrides, and shared
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
```

Useful focused commands:

```sh
pnpm --filter @mystra/shared test
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/control-plane dev
```

## Architectural Constraints

- Provider interfaces isolate local-first and cloud implementations.
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
- Platform resource pools such as `SandboxProvider` capacity should remain platform-owned and allocatable across many workspaces and projects rather than being modeled as project-private infrastructure.
- Workflow contracts should support a shared base plus workspace/project-specific variants instead of assuming one global hardcoded lifecycle forever.

## Provider Boundary

Mystra uses Open Agents as a source-authoritative baseline and defines provider seams where the original project uses managed services or does not expose a reusable package/interface boundary. Mystra owns the actual interface and SDK definitions at those seams.

```text
RdbProvider        local SQLite first; cloud RDB later
WorkflowProvider   Mystra-owned local implementation first; external adapters later if earned
SandboxProvider    single-machine Docker first; Vercel Sandbox or stronger isolation later
RepoProvider       GitLab and GitHub contract scope first
AgentProvider      Codex CLI and GitHub Copilot CLI first
```

For repository delivery, 004 treats GitLab and GitHub as MVP contract scope.
Provider-specific realization lives in `specs/010-repo-provider-contracts/` so
workflow, runner, and agent surfaces do not hardcode one host as the only valid
target.

Provider implementations must be replaceable without rewriting product contracts or feature specs.

## Tenancy And Resource Direction

- **Mystra platform** owns shared providers, control-plane policy, and resource pools.
- **Workspace** is the neutral coordination scope for groups of projects and product inputs.
- **Project** owns repository identity, default runtime contract, and workflow customization inputs.
- **Run-time allocation** should allow one shared sandbox provider pool to serve many workspaces and projects safely.

## Runner Host Facts

The current development runner is `10.106.2.127` on Debian 12 with Docker, Codex CLI, GitHub Copilot CLI, and Mihomo proxy setup. Details live in `docs/RUNNER-ENVIRONMENT.md`.
