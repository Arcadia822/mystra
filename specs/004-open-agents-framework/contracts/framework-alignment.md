# Contract: Framework Alignment Mapping

This contract defines the minimum durable artifact Mystra must maintain before
follow-on features rely on Open Agents framework reuse.

It works together with:

- `provider-seams.md` for replacement-boundary ownership
- `fork-rules.md` for the explicit triggers that convert "adaptation" into a
  real fork
- `module-inventory.md` for concrete Mystra package and provider-surface
  ownership

## Required Mapping Fields

Each mapping entry MUST contain:

- `subsystem`
- `status`
- `upstreamReference`
- `mystraPaths`
- `dependentFeatures`
- `notes`
- `moduleInventoryLink`

## Allowed Status Values

- `reused`: Mystra uses the upstream concept or code with little or no
  behavioral change.
- `adapted`: Mystra reuses the upstream concept or code but wraps or reshapes
  part of it.
- `replaced`: Mystra keeps the boundary but provides its own implementation
  behind a local seam.
- `deferred`: Mystra intends to align later; the current feature does not claim
  completion for this subsystem.
- `excluded`: Mystra intentionally does not adopt this upstream subsystem in
  the MVP.

## Required Review Questions

Every mapping entry must answer:

1. What exact upstream concept or source path is being mapped?
2. Which local Mystra paths implement or document the mapped subsystem?
3. Is the relationship reused, adapted, replaced, deferred, or excluded?
4. Which downstream specs or ADRs depend on this answer staying true?
5. If the status is not `reused`, what is the reason?

## Mapping Record Table

Populate one row per MVP-relevant subsystem:

| subsystem | status | upstreamReference | mystraPaths | dependentFeatures | moduleInventoryLink | notes |
|---|---|---|---|---|---|---|
| control surface | adapted | `README.md` (Web layer), `apps/web/app/workflows/chat.ts` | `apps/control-plane/app/api/mcp/route.ts` | `006-control-plane-ui`, `007-mcp-server`, `008-mcp-skills` | `module-inventory.md: control plane` | Mystra keeps the control-surface role but expresses it as a Mystra-owned MCP/API submission shim rather than the upstream web UI. |
| workflow orchestration | deferred | `apps/web/app/workflows/chat.ts`, `apps/web/app/workflows/chat-post-finish.ts` | `apps/workflows/src/index.ts`, `apps/runner-daemon/assets/container-task.sh` | `005-workflow-blueprint`, `007-mcp-server` | `module-inventory.md: workflows` | The local workflow package is still a placeholder, and the effective lifecycle still lives in runner-owned shell/script logic until 005 replaces that path. |
| sandbox execution | replaced | `apps/web/app/workflows/sandbox-lifecycle.ts`, `apps/web/SANDBOX-LIFECYCLE.md` | `apps/runner-daemon/src/index.ts`, `apps/runner-daemon/assets/container-task.sh` | `005-workflow-blueprint`, `011-docker-sandbox-provider` | `module-inventory.md: runner daemon`, `module-inventory.md: sandbox provider` | Mystra preserves the isolated-execution boundary but replaces the upstream managed sandbox surface with a Docker-backed local-first seam. |
| persistence | replaced | `README.md` (managed persistence assumptions) | `apps/control-plane/src/lib/db/rdb-provider.ts`, `apps/control-plane/src/lib/db/sqlite-provider.ts` | `002-runtime-profile-context`, `003-config-first-runner-durability`, `007-mcp-server` | `module-inventory.md: persistence provider` | Mystra owns the persistence contract behind `RdbProvider`; SQLite is the first implementation and must not leak into shared contracts. |
| repository integration | replaced | `apps/web/app/workflows/chat-post-finish.ts` | `specs/010-repo-provider-contracts/`, `README.md`, `PRODUCT.md` | `005-workflow-blueprint`, `007-mcp-server`, `010-repo-provider-contracts` | `module-inventory.md: repository provider` | Repository delivery is MVP scope for GitLab and GitHub, but the provider-neutral contract is Mystra-owned and realized later under 010. |
| agent execution | replaced | `README.md` (agent outside sandbox architecture) | `apps/runner-daemon/assets/container-task.sh`, `packages/agent-adapters/src/index.ts` | `005-workflow-blueprint`, `008-mcp-skills`, `009-agent-adapters` | `module-inventory.md: runner daemon`, `module-inventory.md: agent adapters` | Mystra currently executes Codex/Copilot inside the task container, so the agent-execution boundary is a deliberate local replacement rather than an upstream package import. |

## Truthfulness Rules

- A mapping MUST NOT say `reused` when Mystra only shares high-level intent.
- A mapping MUST NOT say `replaced` without naming the local seam owner.
- A mapping MUST NOT omit downstream dependencies for workflow, MCP,
  repository, sandbox, or agent-execution surfaces.
- A mapping MUST be updated before a follow-on feature changes the subsystem's
  relationship to Open Agents.
- A mapping MUST point at the corresponding module inventory entry when the
  subsystem is realized through a concrete Mystra package or provider surface.
