# Mystra Constitution

## Core Principles

### I. Specification Owns Product Boundaries

Mystra changes must preserve the documented MVP boundary unless the boundary is explicitly amended first. Do not introduce caller auth, logs API or persistence, retry API, callback URLs, quality-gate fix loops, OAuth/webhooks/Issue write-back, Integration management UI, public hosted multi-tenancy, Claude CLI, Kubernetes sandbox workloads, cross-runner shared caches, per-repository secret management, hosted RDB, standing orders, or platform-owned workflow automation as incidental work.

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
- GitLab is not an enabled/default Integration or control-plane RepoProvider.
  Its existing runner-side RepoDeliveryProvider may remain as a replaceable
  delivery implementation.
- Every Project binds one provider-resolved immutable remote repository
  snapshot; local paths and caller-supplied clone URLs are invalid Project
  repository inputs.
- Mystra remote MCP is the primary submission path for other agents and skills.
- Web API is the canonical management implementation; CLI and MCP are thin adapters over the same contracts.
- Web UI is a secondary client. Its current object navigation exposes Control
  Plane, Tasks, Runners, and Projects; Task detail creates child Sessions and
  Session detail owns lifecycle and review evidence.
- Runner output may influence internal execution facts and final Session
  results, but public activity timelines and stdout/stderr storage are out of scope.
- Branch names and review titles/bodies belong to Session execution context.
- Runner caches improve performance only and must never be treated as source-of-truth state.
- Optional Agent plugin/hooks may extend Agent behavior, but they must remain removable packages and cannot become required platform orchestration.

## Amendment Notes

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

**Version**: 2.2.0 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-08-03
