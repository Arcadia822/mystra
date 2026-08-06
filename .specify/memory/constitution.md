# Mystra Constitution

## Core Principles

### I. Specification Owns Product Boundaries

Mystra changes must preserve the documented MVP boundary unless the boundary is explicitly amended first. GitHub connection methods are deployment-aware: self-hosted Mystra supports explicit PAT connections behind `SecretProvider`; the platform-operated Mystra GitHub App is hosted-only. The open-source tree may retain hosted App code and tests, but self-hosted entry points must report a stable unavailable capability and fail closed. Hosted OAuth verifies that an authenticated actor may bind an installation to a Team; App installation tokens remain short-lived; PAT plaintext stays behind a protected SecretProvider boundary while durable relational state stores only non-secret metadata and opaque references. Every Project binds one exact connection and connection modes never silently fall back. Do not introduce logs API or persistence, retry API, arbitrary callbacks, quality-gate fix loops, webhooks, Issue write-back, a general-purpose Integration management catalog, Claude CLI, Kubernetes sandbox workloads, cross-runner shared caches, arbitrary per-repository secret management, standing orders, or platform-owned workflow automation as incidental work. Hosted caller authentication, Team authorization, managed RDB/secrets, and installation lifecycle handling are prerequisites owned by explicit hosted phases, not capabilities that self-hosted code may assume already exist.

### II. Typed Contracts at Service Boundaries

Control-plane APIs, CLI payloads, Runner protocol payloads, MCP tools, Integration capabilities and persisted Session results must use explicit TypeScript and Zod contracts. Task intent, Session execution, stable Runner identity, Project configuration, and external Issue identity remain separate concepts.

### III. Providers Are Replaceable Boundaries

Mystra uses Open Agents as a source-authoritative framework baseline but owns its provider and execution boundaries. RDB, Issue, sandbox, repository, and Agent integrations must sit behind explicit Mystra-owned contracts. The MVP RDB provider is local SQLite. GitHub supplies the active remote RepoProvider and repository-scoped IssueProvider; Linear supplies a read-only IssueProvider. The MVP sandbox provider is single-machine Docker. The platform core must not define a WorkflowProvider, workflow blueprint, workflow node graph or workflow DSL above the Agent.

### IV. Runner Isolation and Secret Hygiene

Runner hosts connect outbound to the control plane. Runner daemons may use the host Docker socket; task containers must not mount it. Secrets are injected at runtime through environment variables or read-only files and must not be committed or baked into images.

### V. Verification And Documentation Before Delivery

Every non-trivial change needs evidence. Contract changes need focused tests. Broad changes need `pnpm typecheck` and relevant `pnpm test` coverage. Runner and delivery changes need runtime or integration evidence when practical. Documentation is part of delivery: feature specs, plans, tasks, module docs, tests, and runtime behavior must be reconciled before completion.

## Additional Constraints

- TypeScript and pnpm remain the default implementation stack.
- Open Agents is a source-authoritative baseline and reference architecture, not an assumed packaged SDK.
- Cloud services are provider implementations, not product architecture assumptions.
- GitHub and Linear are the enabled MVP Integrations: GitHub provides remote
  repositories and repository-scoped Issues; Linear provides read-only Issues.
- GitHub repository discovery and delivery MUST use the exact App or PAT
  connection bound by the Project. OAuth user tokens are verification-only and
  MUST not be persisted; installation access tokens are short-lived and MUST
  NOT appear in durable state, logs, public responses, or evidence. PAT
  plaintext MUST remain behind `SecretProvider` and MUST NOT enter RDB, public
  responses, URLs, logs, or evidence. App and PAT modes never silently fall
  back to each other.
- GitHub App capability MUST be derived from trusted server deployment policy,
  not from client input or the mere presence of App environment variables.
  Self-hosted App management, callback, token minting, discovery, and delivery
  entry points MUST fail closed. Hosted OAuth transactions MUST be one-time,
  time-bounded, and bound to an authenticated actor and exact Team.
- GitLab is not an enabled/default Integration or control-plane RepoProvider.
  Its existing runner-side RepoDeliveryProvider may remain as a replaceable
  delivery implementation.
- Every Project binds one provider-resolved immutable remote repository
  snapshot; local paths and caller-supplied clone URLs are invalid Project
  repository inputs.
- Mystra remote MCP is the primary submission path for other agents and skills.
- Web API is the canonical management implementation; CLI and MCP are thin adapters over the same contracts.
- Web UI is a secondary client. Its demo shell exposes New, Search, Inbox, and
  Issues, followed by Projects and Project-grouped Tasks with latest-Session
  status icons. Existing Task, Session, Runner, and Project object routes remain
  directly reachable. `/automations` remains directly addressable as a Coming
  soon placeholder, is not a primary menu entry, and does not create
  platform-owned workflow orchestration.
- Runner output may influence internal execution facts and final Session
  results, but public activity timelines and stdout/stderr storage are out of scope.
- Branch names and review titles/bodies belong to Session execution context.
- Runner caches improve performance only and must never be treated as source-of-truth state.
- Optional Agent plugin/hooks may extend Agent behavior, but they must remain removable packages and cannot become required platform orchestration.

## Amendment Notes

- 2026-08-06: Made the platform-operated Mystra GitHub App a hosted-only
  capability. Self-hosted Mystra supports PAT connections and may retain the
  hosted App implementation in source, but all App entry points fail closed by
  deployment policy. Hosted activation additionally requires caller identity,
  Team authorization, one-time server-side OAuth state, and platform-owned App
  secrets. Feature 041 owns the capability contract and phased architecture.
- 2026-08-06: Removed Automations from the primary menu while preserving
  `/automations` as a directly addressable Coming soon placeholder. This keeps
  unimplemented workflow orchestration out of the primary operator journey.
- 2026-08-06: Replaced the single-active-GitHub-App rule with multiple explicit
  GitHub App installation and PAT connections. Every Project binds one exact
  connection; GitHub App OAuth remains verification-only; PAT plaintext is a
  connection-scoped SecretProvider exception and never becomes RDB or Project
  state. Feature 041 owns migration from feature 039 without cross-connection
  fallback.
- 2026-08-05: Approved a narrow GitHub App installation connection exception
  for Project onboarding. OAuth is limited to installation-owner verification;
  repository discovery and Runner delivery share short-lived installation
  tokens without a personal-token fallback. Caller auth, webhooks, Issue
  write-back, and a general Integration management catalog remain excluded.
- 2026-08-05: Updated the 025 demo shell taxonomy to the owner-approved
  Castrel-inspired menu and Project-grouped Task list, while keeping existing
  object routes reachable and preserving the exclusion of platform-owned
  workflow automation.
- 2026-08-03: Reconciled the durable MVP boundary with landed features 033,
  035, 036, and 037 and the remaining 025 UI work. Current intake uses GitHub
  and Linear Integrations, every Project repository is remote and
  provider-resolved, GitLab remains delivery-only, and the 025 shell is the
  sole unfinished MVP UI scope. Removed workflow/standing-order specs require
  no runtime migration because platform-owned orchestration is already absent.
- 2026-08-03: Replaced the former coupled execution model with Task intent,
  loose one-to-many child Sessions, and stable Runner identity. Compatibility
  aliases are intentionally absent; recognized local development schemas are
  rebuilt destructively. Public activity-timeline semantics remain undecided.
- 2026-07-23: Removed the WorkflowProvider/blueprint/node model from the product
  core. Mystra owns Issue intake, durable Task/Session state, sandbox allocation,
  direct Agent execution, repository delivery, and Review handoff.

## Development Workflow

Use 5xP files for durable project context and Spec-Kit for feature-level work.

1. Load `AGENTS.md` and the smallest relevant 5xP files.
2. Use `/speckit.specify` for non-trivial features or product/contract changes.
3. Use `/speckit.clarify` before planning when requirements are ambiguous.
4. Use `/speckit.plan` and `/speckit.tasks` before substantial implementation.
5. Implement in small slices and verify each slice.
6. Keep documentation, specs, tests, and runtime behavior aligned.
7. Add or update nearby submodule documentation when a change introduces new commands, configuration, contracts, or invariants.

## Governance

This constitution overrides casual prompt preferences when repository behavior is at stake. Amendments require a documented reason, a migration note for affected specs/templates, and verification that existing docs do not contradict the new rule.

**Version**: 2.5.0 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-08-06
