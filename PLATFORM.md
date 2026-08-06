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
IntegrationConnection durable non-secret binding to one provider authorization
SecretProvider        protected credential material resolved by opaque reference
RepoProvider          remote repository discovery and identity
IssueProvider         GitHub repository-scoped; Linear read-only
SandboxProvider       single-machine Docker first
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
expire quickly. PAT plaintext is stored only behind the deployment's
`SecretProvider`; RDB keeps non-secret connection metadata and an opaque secret
reference. App and PAT modes never silently fall back to one another, and
repository discovery plus RepoDeliveryProvider clone/push/review always resolve
the exact connection bound by the Project.

Deployment capability checks belong at Integration management and credential
resolution boundaries. They must not make `IntegrationRegistry` return a
different provider graph per deployment. Existing unsupported connection records
remain inspectable, but are never silently treated as operable.

Deployment shape is selected by the server composition root, not by request data
or an operator-facing mode flag. The open-source entrypoint always assembles
self-hosted services and does not construct a GitHub App identity provider. The
managed Mystra Cloud entrypoint assembles hosted caller authentication, Team
authorization, durable OAuth transaction state, managed SecretProvider/KMS, and
the platform GitHub App identity. App environment variables are inputs to that
hosted assembly only; they are not a deployment-mode switch. A partial hosted
assembly reports `PREREQUISITE_UNAVAILABLE` and fails closed.

The Hosted composition root, Cloud-only adapters, infrastructure manifests, and
final image pipeline live in a separate private distribution project. That
project pins an immutable OSS revision and consumes a versioned deployment
contract; it is not a private fork and must not patch OSS source during routine
builds. Published Cloud images record both OSS and distribution revisions.

This is a supported-product boundary rather than copy protection. Because the
source is open, an operator can fork and replace the composition root; the stock
self-hosted distribution nevertheless never advertises or activates the hosted
GitHub App path.

Project creation keeps execution defaults out of repository onboarding. The
control plane resolves `MYSTRA_DEFAULT_AGENT` (default `copilot`) and
`MYSTRA_DEFAULT_DEV_IMAGE` (default `mystra-runner:local`) server-side and
persists the resolved values. Add Project therefore asks only for the exact
connection, repository, Project name, and slug.

## Client surfaces

The Web API is canonical. MCP and CLI are thin adapters; Web is a secondary
operator client. The demo shell exposes New, Search, Inbox, Issues, and
Automations, followed by Project-grouped Tasks whose icons show latest Session
state. Existing Task, Session, Runner, and Project object routes remain directly
reachable. The Automations menu item is presentation-only and adds no workflow
runtime or persistence contract.

## Deployment direction

| Capability | Self-hosted | Hosted |
|---|---|---|
| GitHub PAT connection | Supported when a SecretProvider is configured | Supported by policy |
| Mystra GitHub App connection | Unsupported; code may remain present | Supported when cloud prerequisites are healthy |
| GitHub App identity secrets | Not distributed | Platform-owned secret/KMS boundary |
| OAuth transaction state | Not used for App connections | Durable, one-time, actor- and Team-bound |
| Installation tokens | Never minted | Short-lived and never durable |

Self-hosted is a real single-node product shape, not a simulation of Mystra
Cloud. Hosted operation adds Team authorization, managed secrets, durable OAuth
transactions, and shared provider pools without changing Task, Session, Runner,
or Project repository provenance contracts.
