# Implementation Plan: Workflow Blueprint Architecture

**Branch**: `005-workflow-blueprint` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-workflow-blueprint/spec.md`

## Summary

Replace the runner-owned `container-task.sh` lifecycle script with a Mystra-owned
workflow interface and SDK surface in `apps/workflows` that executes a
Zod-validated blueprint for the MVP coding loop. The MVP goal stays the same,
but the implementation path is now explicit: design the extensible contracts
directly for Mystra's runner/control-plane seams, using Open Agents, Stripe
Minions, and other coding-agent harnesses as reference architectures rather
than adoption targets. The first implementation keeps Mystra's existing
control-plane submission flow, runner claim loop, and agent-in-container
divergence intact while moving lifecycle shape, node ordering, failure handling,
and fix-loop removal into a pluggable workflow contract.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`@mystra/shared`, Node `child_process`, Docker CLI, git CLI
**Storage**: SQLite through `RdbProvider`; workflow execution durability is
captured through structured run events and run/result metadata before any later
provider-specific persistence split
**Testing**: `pnpm --filter @mystra/workflows test`, `pnpm --filter @mystra/runner-daemon test`,
`pnpm --filter @mystra/control-plane test`, focused Vitest integration tests,
and `pnpm typecheck`
**Target Platform**: Mystra control plane plus private Linux runner host with
Docker task containers
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner
daemon, workflow package, shared Zod contracts, and Spec-Kit artifacts
**Performance Goals**: Preserve the existing queued-to-runner control flow,
avoid adding extra control-plane round trips for each node, and keep the MVP
workflow overhead small relative to current script execution
**Constraints**: No quality-gate fix loops in MVP; do not leak Vercel workflow
assumptions into the contract; preserve agent-in-container execution as the
current explicit divergence; keep repository and sandbox behavior behind their
own downstream provider seams; treat external SDKs and harnesses as reference
architectures only, not as adoption requirements
**Scale/Scope**: One pluggable workflow provider interface, one data-defined MVP
blueprint, one local adapter that replaces `container-task.sh`, and the minimum
runner/control-plane integration needed to execute and observe that blueprint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The plan removes the
  out-of-scope fix loop and keeps retries as a post-MVP blueprint extension
  point instead of silently broadening the MVP.
- **Typed Contracts at Service Boundaries**: PASS. The workflow provider,
  blueprint definition, node execution snapshots, and runner handoff all use
  explicit TypeScript and Zod contracts.
- **Providers Are Replaceable Boundaries**: PASS. The plan creates a real
  `WorkflowProvider` contract and keeps `LocalWorkflowProvider` as the first
  implementation rather than the only supported shape.
- **Runner Isolation and Secret Hygiene**: PASS. The runner still owns Docker
  execution and runtime injection; the workflow layer coordinates steps but does
  not widen sandbox privileges or secret exposure.
- **Verification And Documentation Before Delivery**: PASS. The feature will
  ship with blueprint contracts, workflow data model docs, focused tests, and a
  quickstart proving the local adapter replaces the current shell-script path.

## Project Structure

### Documentation (this feature)

```text
specs/005-workflow-blueprint/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── blueprint-schema.md
│   └── workflow-provider.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/workflows/
└── src/
    └── index.ts

apps/runner-daemon/
├── src/index.ts
└── assets/container-task.sh

apps/control-plane/
├── app/api/runner/jobs/route.ts
├── app/api/runner/jobs/[id]/events/route.ts
└── app/api/runner/jobs/[id]/result/route.ts

packages/shared/src/
├── events.ts
├── result.ts
├── schemas.ts
└── state.ts
```

**Structure Decision**: 005 should center new orchestration contracts in
`apps/workflows`, keep the runner as the execution owner, and reuse
`@mystra/shared` for lifecycle/result vocabulary. `container-task.sh` becomes a
thin compatibility surface only if needed during migration; it should stop being
the authoritative lifecycle definition.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. The workflow provider contract should live in `apps/workflows`, not in the
   control plane or runner daemon, because 004 marked workflows as the deferred
   framework surface that 005 now owns.
2. The MVP blueprint should be data-first and Zod-validated, with deterministic
   and agentic node kinds plus explicit dependency edges and typed outputs.
3. The runner remains the execution owner; the workflow layer coordinates node
   order, failure handling, and result assembly, but does not replace the Docker
   or agent seams owned by 011 and 009.
4. The current shell fix loop violates the product boundary and must be removed
   rather than re-expressed as default workflow behavior.
5. Existing run records and structured events are the fastest durable surface
   for node execution snapshots; 005 does not need a brand-new persistence
   provider contract to prove workflow orchestration.
6. Open Agents and Stripe Minions should inform the contract shape, but Mystra
   should own the actual interface and SDK definitions at its runner/control-plane
   seam instead of waiting for an upstream package to exist.
7. GitNexus evidence could not be refreshed in this shell because the available
   CLI bootstrap failed; direct source inspection was used instead and recorded
   here explicitly.

Dependency audit across prior specs:

- `001-project-and-sqlite` still provides the durable `Project` and
  `RdbProvider` ownership model 005 needs, after aligning its older image wording
  to the runtime-contract model introduced later.
- `002-runtime-profile-context` already provides the resolved runtime contract,
  context bundle, and sandbox-compatibility boundaries 005 should consume.
- `003-config-first-runner-durability` already provides the runner claim,
  event/result ingestion, timeout, cancellation, and stale-state boundaries 005
  must orchestrate rather than redesign.
- `004-open-agents-framework` already provides the Open Agents mapping,
  provider-seam catalog, module inventory, and fork rules 005 depends on.
- No additional prerequisite spec work is required before continuing 005 plan
  and workflow-module design.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/blueprint-schema.md](./contracts/blueprint-schema.md)
- [contracts/workflow-provider.md](./contracts/workflow-provider.md)

The first build slice for 005 should be:

1. Add the Mystra-owned workflow provider and blueprint contracts to
   `apps/workflows`.
2. Define the MVP local blueprint as data, not inline shell logic.
3. Introduce a local workflow adapter that executes that blueprint on the runner
   using existing Docker and agent seams.
4. Move quality-gate behavior into a deterministic node and remove the default
   shell-script fix loop.
5. Keep run status, events, and final result vocabulary aligned with
   `@mystra/shared` and 004's lifecycle/control-handoff proof slice.

## Code Evidence

- `apps/workflows/src/index.ts` is currently only `workflowAppName`, so 005 is
  the first feature that gives the package real workflow ownership.
- `apps/runner-daemon/assets/container-task.sh` currently owns clone, agent
  execution, quality gate, push, MR creation, and the out-of-scope quality fix
  loop.
- `apps/runner-daemon/src/index.ts` already provides the runner claim loop,
  Docker launch, event emission, and result publication endpoints that 005 must
  orchestrate rather than replace.
- `apps/control-plane/app/api/runner/jobs/route.ts`,
  `.../[id]/events/route.ts`, and `.../[id]/result/route.ts` already define the
  runner/control-plane handoff that the workflow adapter should consume.
- `packages/shared/src/state.ts`, `events.ts`, `schemas.ts`, and `result.ts`
  already provide run states, lifecycle events, runtime contracts, and result
  shapes that the blueprint system should reuse.

## Implementation Order

1. Define the workflow provider and blueprint data contracts in `apps/workflows`
   and `packages/shared` only where shared vocabulary is genuinely needed.
2. Add local workflow blueprint definitions for the MVP task lifecycle with fix
   loops removed.
3. Refactor the runner daemon to call the workflow adapter instead of invoking
   the full lifecycle directly in `container-task.sh`.
4. Preserve structured event emission and final result publication while adding
   node-level execution snapshots.
5. Retire `container-task.sh` as the lifecycle authority, leaving only a thin
   compatibility layer if absolutely required during migration.

## Verification Plan

| Surface | Evidence |
|---|---|
| Workflow provider contract | `apps/workflows` tests prove load/validate/execute behavior for a blueprint |
| Blueprint schema | Invalid DAGs and unsupported node kinds are rejected by Zod validation |
| Local adapter migration | Runner integration test shows the local adapter replaces the current shell path for clone → agent → gate → push/MR |
| Fix-loop removal | Quality-gate failure produces a terminal failed run with no retry attempts |
| Shared lifecycle alignment | Emitted events and final results remain valid against `@mystra/shared` schemas |
| Type safety | `pnpm typecheck` across touched packages |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Workflow contract leaks shell-script details | Define the provider boundary and blueprint schema before refactoring runner logic |
| Runner and workflow responsibilities blur together | Keep the workflow package responsible for ordering and node execution semantics, while the runner remains execution owner |
| Fix-loop removal accidentally changes terminal semantics | Add focused tests for immediate quality-gate failure and no-retry behavior |
| 005 silently redefines sandbox or repository contracts | Keep those details behind 010 and 011 seams and reference them rather than inlining provider logic |
| Node execution durability expands into a persistence rewrite | Use structured events and run metadata first; defer dedicated persistence redesign unless validation proves it necessary |
| Placeholder workflow package encourages speculative abstractions | Implement the narrow MVP blueprint and local adapter first, then expand from working node contracts |

## Post-Design Constitution Re-Check

PASS. The design keeps the workflow feature inside Spec-Kit artifacts, removes
an out-of-scope fix loop, preserves explicit provider seams, and defines
verification through focused workflow, runner, and shared contract tests.

## GitNexus Note

Process guidance prefers GitNexus during plan phases for cross-package contract
work. In this shell, `npx gitnexus@latest --help` failed during bootstrap, so
the plan relies on direct source inspection of the runner, control-plane, and
shared contract surfaces. That limitation should be revisited before
implementation if the CLI becomes usable.
