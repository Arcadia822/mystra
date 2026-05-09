# Mystra Constitution

## Core Principles

### I. Specification Owns Product Boundaries

Mystra changes must preserve the documented MVP boundary unless the boundary is explicitly amended first. Do not introduce caller auth, logs API, retry API, callback URLs, quality-gate fix loops, Claude CLI, Kubernetes sandbox workloads, cross-runner shared caches, or per-repository secret management as incidental work.

### II. Typed Contracts at Service Boundaries

Control-plane APIs, runner protocol payloads, MCP tools, workflow calls, and persisted run results must use explicit TypeScript and Zod contracts. Platform capabilities, platform defaults, project configuration, and job identity remain separate concepts.

### III. Providers Are Replaceable Boundaries

Mystra reuses the Open Agents framework but owns its provider boundary. RDB, workflow, sandbox, repository, and agent integrations must sit behind explicit provider contracts. The first RDB provider is local SQLite. The first workflow provider is a local dummy implementation. The first sandbox provider is single-machine Docker.

### IV. Runner Isolation and Secret Hygiene

Runner hosts connect outbound to the control plane. Runner daemons may use the host Docker socket; task containers must not mount it. Secrets are injected at runtime through environment variables or read-only files and must not be committed or baked into images.

### V. Verification And Documentation Before Delivery

Every non-trivial change needs evidence. Contract changes need focused tests. Broad changes need `pnpm typecheck` and relevant `pnpm test` coverage. Runner and delivery changes need runtime or integration evidence when practical. Documentation is part of delivery: feature specs, plans, tasks, module docs, tests, and runtime behavior must be reconciled before completion.

## Additional Constraints

- TypeScript and pnpm remain the default implementation stack.
- Open Agents is the framework foundation.
- Cloud services are provider implementations, not product architecture assumptions.
- GitLab and GitHub are MVP repository providers.
- Mystra remote MCP is the primary submission path for other agents and skills.
- Runner output may influence structured events and final results, but stdout/stderr log storage is out of scope.
- Branch names, MR/PR titles, and MR/PR bodies come from task/repository context in the MVP.
- Runner caches improve performance only and must never be treated as source-of-truth state.

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

**Version**: 1.1.0 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-05-09
