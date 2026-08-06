# Mystra Platform

> Ship software with agents.

## Runtime shape

```text
apps/control-plane    Next.js management API, MCP, Web, SQLite adapter
apps/runner-daemon    Stable pull-based Runner service
packages/shared       Zod schemas, Session lifecycle, result contracts
packages/agent-adapters
plugins/mystra        MCP and Agent-facing skills
```

The repository uses TypeScript 5.9, Node.js 24.14.0, pnpm 10.25.0, Next.js 16,
React 19, Zod 4, Vitest 4, and `better-sqlite3`.

## Canonical topology

```text
Mystra platform
  -> Team
    -> Project
      -> Task
        -> Session (0..N)
          -> stable Runner assignment
          -> sandbox -> Agent -> repository review
```

Task owns immutable Project/Repository intent and optional Issue provenance.
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
- Every Project binds one provider-resolved immutable remote Repository
  snapshot. Local paths and caller-supplied clone URLs are invalid inputs.
- Task owns that snapshot; Session cannot replace Project or Repository context.
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
- SQLite is the first source of truth behind `RdbProvider`; the provider contract
  must not leak SQLite dialect.
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
RdbProvider           local SQLite first; cloud RDB later
IntegrationPlugin     named repository and/or Issue capabilities
IntegrationConnection durable non-secret binding to one provider installation
RepoProvider          remote repository discovery and identity
IssueProvider         GitHub repository-scoped; Linear read-only
SandboxProvider       single-machine Docker first
RepoDeliveryProvider  clone, push, and review delivery
AgentProvider         adapter-backed Agent execution
```

GitLab may remain a replaceable Runner-side delivery implementation. It is not
an enabled/default MVP intake Integration.

The private single-node MVP has one active GitHub App installation connection.
GitHub OAuth is used only to verify that the operator can access the selected
installation. The OAuth user token is discarded after verification. GitHub App
identity secrets remain server-side configuration; installation access tokens
are minted on demand, expire quickly, and authorize both RepoProvider discovery
and RepoDeliveryProvider clone/push/review. No GitHub personal-token fallback is
part of the active contract.

## Client surfaces

The Web API is canonical. MCP and CLI are thin adapters; Web is a secondary
operator client. The demo shell exposes New, Search, Inbox, Issues, and
Automations, followed by Project-grouped Tasks whose icons show latest Session
state. Existing Task, Session, Runner, and Project object routes remain directly
reachable. The Automations menu item is presentation-only and adds no workflow
runtime or persistence contract.

## Deployment direction

The MVP is a real private single-node product shape. Future hosted operation may
add Team-scoped defaults and shared provider pools without changing the
Task/Session/Runner contracts.
