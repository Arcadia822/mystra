# Mystra Platform

> Issue-driven execution of coding agents, with reviewable evidence.

## Runtime shape

```text
apps/control-plane    Next.js management API, MCP, Web, Prisma RDB adapters
apps/runner-daemon    Stable pull-based Runner service
packages/shared       Zod schemas, Session lifecycle, result contracts
packages/agent-adapters
plugins/mystra        MCP and Agent-facing skills
```

The repository uses TypeScript 5.9, Node.js 24.14.0, pnpm 10.25.0, Next.js 16,
React 19, Zod 4, Vitest 4, and `better-sqlite3`.

## Canonical topology

The topology below is directional. The first Prisma RDB milestone persists only
IntegrationConnection, Project and Task; Session/Runner persistence is deferred.

```text
Mystra platform
  -> Team
    -> Project
      -> Task
        -> Session (0..N)
          -> stable Runner assignment
          -> sandbox -> Agent -> repository review
```

The current Task RDB model owns only identity, Project relation, optional Issue
dispatch key and metadata. Source, objective and Issue/Repository snapshots are deferred.
Session owns all execution choices and lifecycle. Runner is stable capacity.
Workspace means the Session-scoped working directory and context-delivery
surface; it is never a tenancy term.

## Commands

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm audit:task-session-terminology
pnpm doctor
pnpm dev:control-plane
pnpm dev:runner
pnpm lsp:typescript
```

## Architectural constraints

- Open Agents is a source-authoritative reference baseline, not an assumed
  packaged runtime dependency.
- Every Project binds one IntegrationConnection plus a provider-stable remote Repository external ID.
  Mutable repository metadata is not Project persistence; Repo Info retrieval/cache is separately specified.
  Local paths and caller-supplied clone URLs are invalid inputs.
- Task does not persist source, objective or Issue/Repository snapshots. Current external information will use a
  future Integration-owned cache contract; 040 does not define that cache.
- A Task has no state, result, Agent, branch, runtime allocation, or Runner.
- Every Session belongs to exactly one Task and owns its independent objective,
  Agent, branch, resolved runtime, lifecycle, cancellation, and result.
- Runner has stable identity. Enrollment by name rotates credentials without
  creating a new business object.
- Runner claim responses contain parent Task context plus the selected Session
  and resolved runtime.
- Internal execution facts support diagnostics and transactional persistence but
  have no independent management API, MCP tool, CLI group, or Web object page.
- Headless operation is mandatory; Web remains a secondary client.
- SQLite, PostgreSQL, and Supabase-backed PostgreSQL are selectable at process
  startup behind `RdbProvider`; the provider contract must not leak database
  dialect, Prisma-generated types, connection URLs, or pool handles.
- Supabase uses the PostgreSQL Prisma client and migration history. Runtime may
  use a pooler URL while migration commands use an explicit direct URL.
- Database provider selection is startup configuration. Hot switching a live
  process between databases is not supported.
- Runner hosts initiate outbound connections. Sandbox containers never mount
  the host Docker socket or host home.
- Runtime secrets are injected through environment variables or read-only files.
- Caches are disposable performance hints and must fall back to cold setup.
- Core execution is direct: sandbox, Agent, quality, preview, repository
  delivery. There is no workflow graph above the Agent.
- Shared-nothing is a future scaling direction, not permission to discard
  durable Task, Session, Runner, result, or artifact state.

## Provider boundaries

```text
RdbProvider           SQLite, PostgreSQL, or Supabase-backed PostgreSQL
IntegrationPlugin     named repository and/or Issue capabilities
RepoProvider          remote repository discovery and identity
IssueProvider         GitHub repository-scoped; Linear read-only
SandboxProvider       single-machine Docker first
RepoDeliveryProvider  clone, push, and review delivery
AgentProvider         adapter-backed Agent execution
```

GitLab may remain a replaceable Runner-side delivery implementation. It is not
an enabled/default MVP intake Integration.

## Client surfaces

The Web API is canonical. MCP and CLI are thin adapters; Web is a secondary
operator client. Current object navigation exposes Control Plane, Tasks,
Runners, and Projects. Task detail owns child Session creation/listing; Session
detail owns lifecycle and review evidence.

## Deployment direction

The MVP is a real private single-node product shape. Future hosted operation may
add Team-scoped defaults and shared provider pools without changing the
Task/Session/Runner contracts.
