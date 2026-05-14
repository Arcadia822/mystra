# Implementation Plan: Docker Sandbox Provider

**Branch**: `011-docker-sandbox-provider` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-docker-sandbox-provider/spec.md`

## Summary

Turn Mystra's Docker task-container execution into an explicit `SandboxProvider`
boundary so launch, monitoring, preview-port exposure, cancellation, timeout,
and cleanup stop being spread across runner heuristics and shell-side effects.
The first verified slice should preserve the current Docker MVP path, define the
provider-owned launch/outcome contract, and document which behaviors remain
implementation facts until code is refactored behind the seam.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4, Vitest 4,
`@mystra/shared`, Docker CLI, Node `child_process`, existing runner daemon
logic, shell execution in `container-task.sh`  
**Storage**: SQLite through `RdbProvider`; sandbox lifecycle currently surfaces
through `runs.result`, structured events, and runner-local workspace/container
state  
**Testing**: `pnpm --filter @mystra/runner-daemon test`,
`pnpm --filter @mystra/control-plane test`,
`pnpm --filter @mystra/shared test`, plus `pnpm typecheck`  
**Target Platform**: Private runner host with Docker, task containers, retained
preview containers, and local caches  
**Project Type**: TypeScript monorepo with Next.js control plane, Node runner
daemon, shared schemas, and a shell-driven container task harness  
**Performance Goals**: Preserve current claim-to-container startup behavior and
avoid expensive re-resolution of runtime inputs after claim time; keep preview
port reporting and cleanup checks bounded  
**Constraints**: Do not mount the host Docker socket into task containers; do
not leak host home mounts; keep secrets runtime-injected; preserve caches as
performance aids only; do not widen the MVP into Kubernetes or hosted sandbox
behavior  
**Scale/Scope**: One typed `SandboxProvider` boundary, one Docker first
implementation, one structured sandbox outcome model, and no unrelated
repository-provider or workflow redesign

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The feature formalizes the
  existing Docker MVP path without widening into excluded sandbox products such
  as Kubernetes.
- **Typed Contracts at Service Boundaries**: PASS. The plan defines explicit
  launch, session, port-exposure, and cleanup outcome contracts.
- **Providers Are Replaceable Boundaries**: PASS. Docker becomes a first
  implementation of `SandboxProvider`, not the only imaginable runtime forever.
- **Runner Isolation and Secret Hygiene**: PASS. The plan preserves the existing
  rules against Docker-socket mounts, host-home leakage, and baked-in secrets.
- **Verification And Documentation Before Delivery**: PASS. Delivery includes
  plan artifacts, explicit provider contracts, quickstart validation, and later
  implementation tasks.

## Project Structure

### Documentation (this feature)

```text
specs/011-docker-sandbox-provider/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sandbox-provider.md
│   └── sandbox-outcome.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/runner-daemon/
├── src/index.ts
├── src/container-task.test.ts
└── assets/container-task.sh

apps/control-plane/
└── src/lib/runtime/resolve-runtime.ts

packages/shared/src/
├── schemas.ts
├── result.ts
└── events.ts

docs/
├── RUNNER-DOCKER-MVP.md
└── ARCHITECTURE.md
```

**Structure Decision**: Keep feature-local contract ownership in `specs/011-*`
and treat the runner daemon plus container script as current implementation
evidence. Later code changes may add shared schemas or runner abstractions, but
the planning slice first needs a stable provider boundary and leakage guards.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. `SandboxProvider` should own task-container launch semantics, preview-port
   exposure, cancellation/timeout stop paths, and cleanup outcome reporting.
2. The resolved runtime contract is the sole launch input; Docker-specific flag
   translation belongs inside the provider implementation, not in the shared
   runtime contract itself.
3. Current behavior is split across `apps/runner-daemon/src/index.ts` and
   `apps/runner-daemon/assets/container-task.sh`; formalization must record that
   split explicitly before refactoring code.
4. Retained preview containers are a provider policy/output, not an accidental
   shell side effect.
5. Cleanup failures and exposed ports need a stable structured outcome surface
   instead of being scattered between events and ad hoc metadata fields.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/sandbox-provider.md](./contracts/sandbox-provider.md)
- [contracts/sandbox-outcome.md](./contracts/sandbox-outcome.md)

The first implementation slice for 011 should be:

1. Define a Mystra-owned `SandboxProvider` launch/session/outcome contract.
2. Map the current Docker runner behavior to that contract without claiming the
   refactor is already complete.
3. Normalize preview-port exposure, cancellation, timeout, and cleanup outcome
   reporting.
4. Keep Docker-only mount, env, and CLI details localized to the Docker
   implementation.
5. Update adjacent docs and follow-on features so they depend on the provider
   contract rather than runner heuristics.

### Boundary Diagram

```text
ResolvedRuntimeContract + runner workspace
  -> SandboxProvider.launch()
    -> SandboxSession
      -> inspect()
        -> ports + session metadata
      -> stop() for cancel / timeout
      -> collectOutcome()
        -> SandboxOutcome
          -> run result + lifecycle events

Non-goals for this seam:
  runtime resolution -> control plane
  review delivery -> RepoProvider
  workflow ordering -> WorkflowProvider
```

## Code Evidence

- `apps/runner-daemon/src/index.ts` assembles Docker args, mounts, env, ports,
  secret injection, stop/kill cleanup, and preview-host behavior directly.
- `apps/runner-daemon/assets/container-task.sh` owns container-local execution,
  quality gate, Git push/review steps, and preview service startup.
- `packages/shared/src/schemas.ts` already defines resolved runtime mounts,
  cache, exposed ports, and secrets, which should remain launch inputs rather
  than Docker-specific outputs.
- `packages/shared/src/events.ts` contains runtime lifecycle events such as
  `container.starting`, `container.started`, `cleanup.started`, and
  `run.cleanup_failed`, but no provider-owned session/outcome schema yet.
- `docs/RUNNER-DOCKER-MVP.md` documents retained previews, dynamic ports, and
  quality gate behavior as implementation facts that 011 must now own as a
  formal boundary.

## Implementation Order

1. Define the provider-local data model and outcome vocabulary in feature-local
   contracts.
2. Add shared schemas only for values truly consumed across packages, such as
   port exposure and cleanup outcomes.
3. Refactor runner code so Docker launch/stop/inspect behavior is routed through
   a `SandboxProvider` implementation surface rather than inline branching.
4. Keep container-task behavior aligned with the provider contract but avoid a
   speculative rewrite of unrelated workflow/repository logic.
5. Reconcile docs and tests so preview-port and cleanup semantics come from the
   provider contract rather than ad hoc metadata conventions.

## Verification Plan

| Surface | Evidence |
|---|---|
| Provider-owned contract | `contracts/sandbox-provider.md` and `contracts/sandbox-outcome.md` define launch/session/outcome ownership and leakage guards |
| Runtime launch input | `apps/control-plane` and `packages/shared` tests keep the resolved runtime contract as the provider input |
| Docker first implementation | `apps/runner-daemon` tests map current Docker args, stop/kill behavior, and preview ports to the provider contract |
| Cleanup semantics | Runner tests and shared result/event assertions preserve explicit cleanup failure reporting |
| Broad type safety | `pnpm typecheck` after cross-package contract changes |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Docker flags leak into the shared contract | Keep Docker CLI translation inside the provider implementation and expose only provider-neutral launch inputs/results |
| Provider boundary swallows workflow or repository concerns | Limit the sandbox contract to execution environment ownership: launch, inspect, stop, cleanup, and exposure metadata |
| Cleanup remains split across events and result metadata | Define one structured sandbox outcome model and map events to it deliberately |
| Preview retention stays an undocumented side effect | Model retained-preview behavior as provider-owned policy/output in the contract |
| Refactor expands into broader runner rewrite | Start with an adapter/wrapper slice around the current Docker execution path, then migrate internals incrementally |

## Post-Design Constitution Re-Check

PASS. The plan preserves the Docker MVP boundary, formalizes a replaceable
sandbox seam, keeps isolation and secret-hygiene rules explicit, and defines
verification before code changes claim the provider contract is complete.
