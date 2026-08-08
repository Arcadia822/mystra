# Mystra Platform

> Ship software with agents.

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
IntegrationConnection, Project and Task; feature 044 additionally persists host
Runtime plus its available-Provider capability. Session/dispatch/Context
persistence is deferred.

```text
Mystra platform
  -> Team
    -> Agent
    -> Project
    -> Task
    -> Session
      -> project? (0..1 reference)
      -> task? (0..1 reference)
      -> stable Runner assignment
      -> sandbox -> Agent -> repository review
```

Task is Team-scoped and persists Mystra-owned title/description plus immutable
optional Project context and exact Issue references. Project is not Task
ownership, and current external Issue information remains provider-resolved
rather than copied into Task snapshots.
Session is independently Team-scoped, owns all execution choices and lifecycle,
and may separately reference `0..1` Project and `0..1` Task. Runner is stable capacity.
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
- Task belongs to exactly one Team and not to Project. It persists title,
  description, an immutable optional Project context reference, and an immutable
  optional exact Issue reference. An Issue reference requires Project context;
  manual creation cannot accept Issue identity.
- One exact Project-scoped Issue maps to at most one Task. Current external Issue
  state remains provider-resolved; Task stores no Issue snapshot or write-back
  state.
- A Task has no requirements state machine, result, Agent, branch, runtime
  allocation, Runner, or Session-launch side effect.
- Every Session belongs to exactly one Team and belongs to neither Task nor
  Project. It may independently reference at most one Task and at most one
  Project; either or both may be absent. Session owns its independent objective,
  selected Runtime, Provider, Agent and Context, plus branch, lifecycle,
  cancellation and result. Agent belongs to the same Team and has no Project relation.
- Runner has stable identity. Enrollment by name rotates credentials without
  creating a new business object.
- Runner claim responses contain the selected Session and resolved runtime;
  optional Task and Project context is included only when explicitly referenced.
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
- Runtime is an execution backend that advertises its available Provider (agent
  CLI) capabilities source-agnostically (host PATH discovery now, image-declared
  later). The host `mystra-runner` is TypeScript (reusing `apps/runner-daemon`),
  registers by configured endpoint without MVP pairing, discovers and confirms
  Provider availability, and reports heartbeat/status; online/offline is judged
  by server receive time. Task dispatch, Context, and Agent config are separate
  follow-up boundaries.
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
IntegrationConnection durable non-secret binding to one provider authorization
SecretProvider        plaintext crypto boundary; RDB persists only encrypted envelopes
RepoProvider          remote repository discovery and identity
IssueProvider         GitHub repository-scoped; Linear read-only
SandboxProvider       single-machine Docker, one Runtime execution backend
RuntimeProvider       execution backend advertising source-agnostic Provider (agent CLI) capabilities; host-bound Runtime enrolled by the TypeScript `mystra-runner` (feature 044)
RepoDeliveryProvider  clone, push, and review delivery
AgentProvider         adapter-backed Agent execution
```

GitLab may remain a replaceable Runner-side delivery implementation. It is not
an enabled/default MVP intake Integration.

GitHub connection methods are deployment capabilities, not merely the presence
of environment variables. Self-hosted Mystra supports explicit personal access
token connections behind `SecretProvider`; the platform-operated Mystra GitHub
App is a hosted capability. The open-source repository retains the GitHub App
adapter, routes, and tests so hosted and local development use one codebase, but
the stock self-hosted public method projection omits GitHub App entirely and
every App start, callback, credential-minting, repository-discovery, and
delivery entry point fails closed with the internal `hosted-only` reason.

Hosted GitHub OAuth is used only to verify that an authenticated actor may bind
an installation to the selected Team. OAuth transactions bind a one-time nonce,
actor, Team, installation intent, expiry, and safe return path in server-side
state. OAuth user tokens are discarded after verification. GitHub App identity
secrets are platform-owned; installation access tokens are minted on demand and
expire quickly. PAT plaintext enters only the deployment's `SecretProvider`;
RDB keeps connection metadata, an opaque secret reference, and envelope-encrypted
ciphertext. A per-secret DEK encrypts the PAT and a KEK outside RDB wraps that
DEK. App and PAT modes never silently fall back to one another, and
repository discovery plus RepoDeliveryProvider clone/push/review always resolve
the exact connection bound by the Project.

Deployment capability checks belong at Integration management and credential
resolution boundaries. They must not make `IntegrationRegistry` return a
different provider graph per deployment. Existing unsupported connection records
remain inspectable, but are never silently treated as operable.

Deployment shape is selected by the server composition root, not by request data
or an operator-facing mode flag. The open-source entrypoint always assembles
self-hosted services — including single-node human username/password
authentication (no email) and Owner/Admin/Member Team RBAC — and does not
construct a GitHub App identity provider. The managed Mystra Cloud entrypoint
adds hosted multi-tenant caller-identity federation, hosted Team administration,
durable OAuth transaction state, managed SecretProvider/KMS, and the platform
GitHub App identity. App environment variables are inputs to that hosted
assembly only; they are not a deployment-mode switch. A partial hosted assembly
reports `PREREQUISITE_UNAVAILABLE` and fails closed.

The Hosted composition root, Cloud-only adapters, infrastructure manifests, and
final image pipeline live in a separate private distribution project. That
project pins an immutable OSS revision and consumes a versioned deployment
contract; it is not a private fork and must not patch OSS source during routine
builds. Published Cloud images record both OSS and distribution revisions.

This is a supported-product boundary rather than copy protection. Because the
source is open, an operator can fork and replace the composition root; the stock
self-hosted distribution nevertheless never advertises or activates the hosted
GitHub App path.

Project creation keeps execution choices out of repository onboarding. Project
does not own, default or persist Agent selection; `MYSTRA_DEFAULT_AGENT` is an
obsolete pre-0.1 direction and MUST NOT return as a Project field or fallback.
Session launch independently resolves Runtime, Provider, Team-scoped Agent and
Context. Its optional Project and Task references do not provide defaults for
those execution choices. Add Project therefore asks only for the exact
connection, repository, Project name, and slug.

## Client surfaces

The Web API is canonical. MCP and CLI are thin adapters; Web is a secondary
operator client. The demo shell exposes New, Search, Inbox, and Issues, followed
by Projects and Team-scoped Tasks. `/new` creates a Task manually; Project is
optional and Issue selection is deliberately absent. Existing Task, Session,
Runner, and Project object routes remain directly reachable. `/automations` is
directly addressable as a Coming soon placeholder and adds no workflow runtime
or persistence contract.

## Deployment direction

| Capability | Self-hosted | Hosted |
|---|---|---|
| GitHub PAT connection | Supported when a SecretProvider is configured | Supported by policy |
| Mystra GitHub App connection | Unsupported; code may remain present | Supported when cloud prerequisites are healthy |
| GitHub App identity secrets | Not distributed | Platform-owned secret/KMS boundary |
| OAuth transaction state | Not used for App connections | Durable, one-time, actor- and Team-bound |
| Installation tokens | Never minted | Short-lived and never durable |

Self-hosted supports SQLite single-node operation and shared PostgreSQL-backed
control-plane replicas; its SecretProvider does not impose node-local storage or
affinity. Self-hosted includes single-node human authentication and
Owner/Admin/Member Team RBAC. Hosted operation adds hosted multi-tenant Team
administration, managed secrets, durable OAuth transactions, and shared provider
pools without changing Task, Session, Runner, or Project repository provenance
contracts.
