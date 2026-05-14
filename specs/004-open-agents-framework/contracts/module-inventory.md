# Contract: Module Inventory

This contract records how concrete Mystra packages and provider-facing surfaces
relate to the pinned Open Agents source reference after 004 establishes the
framework boundary.

It works together with:

- `framework-alignment.md` for subsystem-level adoption status
- `provider-seams.md` for Mystra-owned replacement boundaries
- `fork-rules.md` for explicit upgrade paths from extension to fork

## Required Module Inventory Fields

Each module inventory record MUST contain:

- `surface`
- `classification`
- `upstreamReference`
- `localOwner`
- `mappingLink`
- `forkRuleLinks`
- `followOnSpec`
- `notes`

## Allowed Classification Values

- `adopt`: Mystra can point to an upstream source or concept with minimal local
  reshaping.
- `extend`: Mystra keeps the upstream source visible but adds local structure or
  policy around it.
- `fork`: Mystra must own a local contract or implementation because the
  upstream surface cannot satisfy the requirement honestly.
- `defer`: Mystra expects a later feature to make the adoption decision.
- `mystra-only-extension`: the surface has no honest upstream equivalent and
  must be tracked as a local extension.

## Inventory Record Table

Populate one row per MVP-relevant surface:

| surface | classification | upstreamReference | localOwner | mappingLink | forkRuleLinks | followOnSpec | notes |
|---|---|---|---|---|---|---|---|
| control plane | extend | `README.md` (Web layer), `apps/web/app/workflows/chat.ts` | `apps/control-plane/app/api/mcp/route.ts` | `framework-alignment.md: control surface` |  | `007-mcp-server` | The control plane preserves the upstream control-surface role but wraps it in a Mystra-owned MCP/API submission surface. |
| workflows | defer | `apps/web/app/workflows/chat.ts`, `apps/web/app/workflows/chat-post-finish.ts` | `apps/workflows/src/index.ts` | `framework-alignment.md: workflow orchestration` | `fork-rules.md: Rule 3` | `005-workflow-blueprint` | The local workflows package is still a placeholder, so 004 records the intended upstream link but does not let this surface count as the first proof boundary. |
| runner daemon | mystra-only-extension | `apps/web/SANDBOX-LIFECYCLE.md` (conceptual sandbox handoff only) | `apps/runner-daemon/src/index.ts` | `framework-alignment.md: sandbox execution`, `framework-alignment.md: agent execution` | `fork-rules.md: Rule 2` | `011-docker-sandbox-provider` | The pull-based bare-metal runner is a Mystra platform surface with no honest upstream package equivalent, even though it participates in the same lifecycle boundary. |
| shared lifecycle schemas/events | extend | `apps/web/app/workflows/sandbox-lifecycle.ts` | `packages/shared/src/events.ts` | `framework-alignment.md: control surface` |  | `005-workflow-blueprint` | Mystra keeps lifecycle vocabulary in a shared package so the control-plane handoff can be aligned without claiming upstream package reuse. |
| persistence provider | fork | `README.md` (managed persistence assumptions) | `apps/control-plane/src/lib/db/rdb-provider.ts` | `framework-alignment.md: persistence` | `fork-rules.md: Rule 1`, `fork-rules.md: Rule 2` | `003-config-first-runner-durability` | Mystra needs a provider-neutral persistence contract that the upstream app does not expose as a reusable package surface. |
| repository provider | fork | `apps/web/app/workflows/chat-post-finish.ts` | `specs/010-repo-provider-contracts/` | `framework-alignment.md: repository integration` | `fork-rules.md: Rule 1`, `fork-rules.md: Rule 2` | `010-repo-provider-contracts` | MVP review delivery covers GitLab and GitHub, but the host-neutral contract is Mystra-owned and must not masquerade as an upstream reusable package. |
| sandbox provider | fork | `apps/web/app/workflows/sandbox-lifecycle.ts`, `apps/web/SANDBOX-LIFECYCLE.md` | `specs/011-docker-sandbox-provider/` | `framework-alignment.md: sandbox execution` | `fork-rules.md: Rule 1`, `fork-rules.md: Rule 2` | `011-docker-sandbox-provider` | Mystra preserves the sandbox boundary while replacing the managed VM/runtime surface with a local Docker provider contract. |
| agent adapters | fork | `README.md` (agent outside sandbox architecture) | `specs/009-agent-adapters/` | `framework-alignment.md: agent execution` | `fork-rules.md: Rule 1`, `fork-rules.md: Rule 2` | `009-agent-adapters` | Typed agent adapters are required for Mystra's CLI-in-container execution model and cannot be claimed as a direct upstream contract today. |

## Cross-Link Rules

- `mappingLink` MUST reference the corresponding subsystem entry in
  `framework-alignment.md`.
- `forkRuleLinks` MUST be empty only when the surface remains on an honest
  `adopt` or `defer` path.
- `followOnSpec` MUST identify the feature spec that is expected to deepen or
  realize the surface after 004.
- `notes` MUST explain why the classification is true today, not why it might
  become true later.
