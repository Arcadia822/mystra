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
- Framework foundation: Open Agents project.
- App framework: Next.js route handlers for the control plane.
- RDB provider, first implementation: local SQLite.
- Workflow provider, first implementation: local dummy workflow.
- Runner daemon: Node.js TypeScript service under systemd on bare metal.
- Sandbox provider, first implementation: single-machine Docker task containers.
- Validation: Zod schemas shared across services.
- Test runner: Vitest.
- Agent CLIs: Codex CLI and GitHub Copilot CLI.
- Repository provider in MVP: GitLab only.

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
- The dummy workflow provider is orchestration only, not business storage.
- Runner hosts initiate outbound connections only.
- Runner daemon may access the host Docker socket; task containers must not mount it.
- Runner caches are performance aids only and must fall back to cold clone/install.
- Secrets must be injected at runtime through environment variables or read-only files.
- Do not bake Codex auth, Copilot tokens, proxy credentials, or runner secrets into images.
- Project runtime config owns per-project execution settings such as Docker image, context bundles, mounts, exposed ports, cache policy, and secret references.
- `Project.runtime.image` is the first-version Docker image contract; there is no top-level `Project.image` compatibility field.
- `JobSpec` carries task identity and optional policy-limited runtime overrides, not platform capabilities.
- Runner claim responses include a resolved runtime contract; runner daemons execute that contract instead of independently interpreting Project fields.

## Provider Boundary

Mystra reuses Open Agents as the framework and defines provider seams where the original project uses managed services.

```text
RdbProvider        local SQLite first; cloud RDB later
WorkflowProvider   local dummy first; Vercel Workflow or WDK later
SandboxProvider    single-machine Docker first; Vercel Sandbox or stronger isolation later
RepoProvider       GitLab first
AgentProvider      Codex CLI and GitHub Copilot CLI first
```

Provider implementations must be replaceable without rewriting product contracts or feature specs.

## Runner Host Facts

The current development runner is `10.106.2.127` on Debian 12 with Docker, Codex CLI, GitHub Copilot CLI, and Mihomo proxy setup. Details live in `docs/RUNNER-ENVIRONMENT.md`.
