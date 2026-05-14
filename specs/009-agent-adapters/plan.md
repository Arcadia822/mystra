# Implementation Plan: Agent Adapter Typed Contracts

**Branch**: `009-agent-adapters` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-agent-adapters/spec.md`

## Summary

Replace hardcoded Codex/Copilot command construction in the runner and
`container-task.sh` with typed Mystra-owned adapter contracts in
`packages/agent-adapters`. The implemented slices now cover three layers:
adapter package contracts and tests, runner-side adapter payload generation, and
agent-process result parsing back into workflow execution semantics. The feature
is materially implemented, but its Spec-Kit artifacts were backfilled after the
code slices landed, so this plan records current reality plus the remaining
gaps.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Zod 4, Vitest 4, Node `child_process`, pnpm
workspace packages, `@mystra/shared`  
**Storage**: N/A beyond existing workspace files used by the runner shell for
step outputs  
**Testing**: `pnpm --filter @mystra/agent-adapters test`, `typecheck`, `build`,
plus `pnpm --filter @mystra/runner-daemon test`, `typecheck`, `build`  
**Target Platform**: Linux runner host executing Docker task containers  
**Project Type**: TypeScript monorepo with package contract layer and Node
runner daemon  
**Performance Goals**: Preserve current runner/container behavior while moving
agent-specific command generation and process parsing behind typed boundaries  
**Constraints**: Do not add non-MVP agent support, do not add stdout/stderr log
storage APIs, preserve 005 workflow-step shell model, keep current agent set to
Codex and Copilot only  
**Scale/Scope**: One adapter package, two built-in adapters, one runner
registry, one shell payload-execution contract

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The feature keeps agent
  execution inside the MVP runner boundary and does not widen product scope to
  new agents or extra control-plane APIs.
- **Typed Contracts at Service Boundaries**: PASS. Adapter inputs, process
  results, parsed outputs, and runner step outputs use explicit TypeScript/Zod
  contracts.
- **Providers Are Replaceable Boundaries**: PASS, with one recorded gap. The
  package-level adapter boundary is explicit, but runtime startup extension for
  new adapters is not yet exposed by the runner.
- **Runner Isolation and Secret Hygiene**: PASS. Agent auth still flows through
  existing runtime env and mounted auth directories; task containers do not gain
  new privileged mounts.
- **Verification And Documentation Before Delivery**: PASS after backfill. Code
  slices have focused test evidence and this feature directory now captures the
  missing plan, data model, contracts, quickstart, and tasks.

## Project Structure

### Documentation (this feature)

```text
specs/009-agent-adapters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── agent-adapter.md
│   └── runner-agent-step.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/agent-adapters/
├── package.json
└── src/
    ├── index.ts
    └── index.test.ts

apps/runner-daemon/
├── package.json
├── src/index.ts
├── src/container-task.test.ts
└── assets/container-task.sh
```

**Structure Decision**: `packages/agent-adapters` owns the reusable contract and
agent-specific implementations. `apps/runner-daemon` owns adapter selection,
payload preparation, and workflow result translation. The shell no longer owns
agent-specific branching; it only executes adapter-provided payloads and writes
structured step outputs.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. The adapter boundary belongs in `packages/agent-adapters`, not embedded in
   the runner shell, because the command contract must be typed and reusable.
2. Runner integration should pass serialized command/environment payloads into
   the container instead of hardcoding per-agent shell branches.
3. Adapter `parseOutput` must affect real runner behavior, not remain a unit
   test artifact only.
4. Unsupported-agent hardening was identified in the spec but explicitly pushed
   out of the current MVP slices by owner direction.
5. Runtime startup extension for new adapters and prompt spill-to-file behavior
   were follow-ups at backfill time and are now implemented in this branch.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/agent-adapter.md](./contracts/agent-adapter.md)
- [contracts/runner-agent-step.md](./contracts/runner-agent-step.md)

Implemented slices already landed on this branch:

1. **Contract slice** (`c6d25b6`): add `AgentAdapter`, `CodexAdapter`,
   `CopilotAdapter`, registry creation, Zod schemas, and focused unit tests.
2. **Runner wiring slice** (`c6d25b6`): create runner-side adapter registry,
   emit `MYSTRA_AGENT_COMMAND_JSON`, `MYSTRA_AGENT_ENV_JSON`, and
   `MYSTRA_AGENT_PREPARE_DIRS_JSON`, and execute them in the shell.
3. **Process-parsing slice** (`d0dfe4c`, `ad17bd9`): make `parseOutput`
   defensive, capture agent process results from the shell, and feed those
   results back through adapter parsing in workflow execution.
4. **Runtime extension + prompt spill slice** (working tree): load
   startup-registered adapter modules in the runner and spill oversized prompts
   to file-backed transport (`codex` via stdin, `copilot` via attachment).

## Plan Review Note

This feature did **not** receive a pre-implementation `plan-eng-review` gate.
The plan is being backfilled from implemented code. The owner explicitly
deferred unsupported-agent hardening out of the current MVP, and that decision
is recorded here instead of being smuggled in as an undocumented omission.

## Code Evidence

- `packages/agent-adapters/src/index.ts` now exports real Zod-backed adapter
  contracts and concrete Codex/Copilot implementations.
- `packages/agent-adapters/src/index.test.ts` proves command generation,
  environment generation, registry lookup, timeout environment handling, and
  defensive parsing behavior.
- `apps/runner-daemon/src/index.ts` now creates a runner adapter registry,
  serializes agent payloads into container env vars, and parses agent process
  results back into workflow execution semantics.
- `apps/runner-daemon/assets/container-task.sh` now executes a generic command
  payload, captures stdout/stderr/exitCode, and emits them in structured step
  output.
- `apps/runner-daemon/src/container-task.test.ts` proves the shell no longer
  hardcodes agent-specific branches and that runner text contracts include the
  adapter payload/result path.

## Remaining Gaps

The current implementation satisfies most of the spec, but these gaps remain:

1. **FR-007 / unsupported-agent clarity**: deferred by owner as out of current
   MVP scope. Current behavior fails fast indirectly instead of surfacing a
   dedicated runtime error contract.

## Verification Plan

| Surface | Evidence |
|---|---|
| Adapter package contracts | `pnpm --filter @mystra/agent-adapters test` |
| Adapter type safety | `pnpm --filter @mystra/agent-adapters typecheck && pnpm --filter @mystra/agent-adapters build` |
| Runner adapter payload wiring | `pnpm --filter @mystra/runner-daemon test -- --run src/container-task.test.ts` |
| Runner integration safety | `pnpm --filter @mystra/runner-daemon test && pnpm --filter @mystra/runner-daemon typecheck && pnpm --filter @mystra/runner-daemon build` |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Adapter contract drifts from runner shell behavior | Keep shell output and runner text tests aligned in the same feature |
| Runtime-loaded adapters drift from the built-in adapter contract | Validate startup adapter modules before registration and reject invalid/duplicate exports |
| Process parsing throws on malformed output | Normalize malformed process data before Zod parsing and keep tests for malformed stdout/stderr |
| Oversized prompts break argv transport | Spill large prompts to workspace files and use adapter-specific file/stdin transport |
| Backfilled artifacts diverge from landed code | Base every section on current files and recent commits, not on aspirational design text |

## Post-Design Constitution Re-Check

PASS. The backfilled design remains within MVP boundaries, keeps the agent seam
typed and replaceable at the package boundary, and documents the known deferred
gaps instead of hiding them.
