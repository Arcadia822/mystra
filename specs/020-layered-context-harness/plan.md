# Implementation Plan: Layered Context Harness

**Implementation Workspace**: dedicated worktree session on `arcadia822/review-layered-context-harness`  
**Planning Session**: in-place `main` checkout, planning only  
**Date**: 2026-05-18  
**Spec**: [spec.md](./spec.md)

## Summary

Implement the frozen execution-spec handoff that `020-layered-context-harness`
describes. The current code already freezes part of execution state at job
submission by persisting `resolved_runtime`, but it does not yet create,
persist, materialize, and inject a real execution-spec artifact. Runner
execution still centers on `job.spec.prompt`, and context bundles are treated as
metadata plus mount references instead of concrete run-scoped artifacts.

The minimal correct path is to reuse the existing runtime and Context Bundle
machinery instead of inventing a second injection channel. The control plane
should freeze a run-scoped execution-spec artifact at job creation time, attach
it to the run's resolved runtime as a required job-scoped context bundle, and
the runner should materialize that bundle into the workspace before agent
execution. The agent prompt may still exist, but it becomes a pointer to the
frozen artifact, not the primary contract itself.

## Current Code Reality

What already works:

- `apps/control-plane/src/lib/db/sqlite-provider.ts` freezes `resolved_runtime`
  at job creation and stores it on the initial run.
- `apps/control-plane/app/api/runner/jobs/route.ts` returns claimed runtime to
  the runner.
- `apps/runner-daemon/src/index.ts` already threads runtime mounts and emits a
  prompt section describing resolved context bundles.

What is still missing:

- No persisted **Frozen Spec Artifact** object exists yet.
- No runner path materializes context-bundle content into
  `cacheRoot/context-bundles/<slug>` before mounting.
- No run-scoped execution contract reference ties outputs back to the exact
  frozen artifact.
- Runner execution still uses `job.spec.prompt` as the main task input instead
  of an injected artifact-first contract.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24, Next.js 16 route handlers  
**Primary Dependencies**: Zod 4 shared schemas, `better-sqlite3`, existing
runtime/context-bundle contracts, runner-daemon Docker flow  
**Storage**: SQLite via `SqliteRdbProvider`; runner workspace temp directories
and cache root for materialized context bundles  
**Testing**: Shared schema tests, control-plane DB tests, API route tests,
runner-daemon unit tests for bundle materialization and prompt generation  
**Target Platform**: Mystra control plane plus Docker runner daemon  
**Project Type**: cross-package runtime-contract and runner-behavior change  
**Performance Goals**: freeze once per job, materialize only required bundles,
avoid introducing a second source-of-truth channel  
**Constraints**:

- Stay inside current MVP boundaries.
- Reuse Context Bundle as the conveyor into execution space.
- Keep current in-place `main` session planning-only; implement in the dedicated
  worktree.
- Preserve typed contracts at control-plane, runner-claim, and persistence
  boundaries.

## Constitution Check

*GATE: Must pass before implementation.*

- **Specification Owns Product Boundaries**: PASS. This implements an existing
  documented contract instead of expanding the MVP.
- **Typed Contracts at Service Boundaries**: PASS, if the new frozen-artifact
  representation is modeled in shared Zod schemas first.
- **Providers Are Replaceable Boundaries**: PASS, if the execution-spec
  injection stays expressed as Mystra-owned runtime/context-bundle contracts
  rather than Docker-only ad hoc wiring.
- **Runner Isolation and Secret Hygiene**: PASS, if bundle materialization stays
  read-only and workspace-scoped.
- **Verification And Documentation Before Delivery**: PASS, if the code change
  lands with updated tasks, focused tests, and aligned docs.

## Project Structure

### Existing code paths to extend

```text
packages/shared/src/
└── schemas.ts

apps/control-plane/src/lib/
├── db/sqlite-provider.ts
└── runtime/resolve-runtime.ts

apps/control-plane/app/api/
└── runner/jobs/route.ts

apps/runner-daemon/src/
└── index.ts
```

### Existing tests to expand

```text
packages/shared/src/schemas.test.ts
apps/control-plane/src/lib/runtime/resolve-runtime.test.ts
apps/control-plane/src/lib/db/sqlite-provider.test.ts
apps/control-plane/app/api/routes.test.ts
apps/runner-daemon/src/container-task.test.ts
```

**Structure Decision**: do not create a parallel "execution contract injection"
subsystem. Extend the existing shared runtime schema, control-plane job
creation, runner claim payload, and runner bundle materialization path.

## Planning Evidence

Live codebase inspection was enough for this planning pass:

- `resolveRuntimeContract()` resolves bundle refs and mount metadata, but not
  materialized bundle content.
- `createJob()` persists `resolved_runtime`, which gives us the right freeze
  point to extend.
- `runtimeMountSource()` expects context-bundle contents under
  `cacheRoot/context-bundles/<slug>`, but no producer currently writes them.
- `executeDockerJob()` writes prompt files from `job.spec.prompt`, which means
  artifact-first semantics are not yet real.

GitNexus was not required for this pass because the affected execution flow is
small, local, and already confirmed through direct file inspection.

## Handoff Diagram

```text
Collaborative workspace                     Mystra control plane                    Runner workspace
┌──────────────────────────────┐            ┌──────────────────────────────┐        ┌──────────────────────────────┐
│ spec / review / discussion   │            │ createJob()                 │        │ executeDockerJob()           │
│ mutable, can keep evolving   │            │ freeze execution-facing spec │        │ materialize execution bundle │
└──────────────┬───────────────┘            └──────────────┬───────────────┘        └──────────────┬───────────────┘
               │ job submission                             │ persist run + runtime                   │ mount read-only file
               ▼                                            ▼                                         ▼
        approved spec input  ───────────────>  frozen execution-spec artifact  ───────────────>  agent reads artifact
                                                                                                       as primary contract
```

## Proposed Design

### 1. Freeze a run-scoped execution-spec artifact at job submission

At `createJob()` time, derive a frozen execution-spec payload from the accepted
job input:

- task identity and repository target
- branch/base branch
- prompt or approved task description
- merge-request metadata when present
- submission timestamp
- provenance metadata showing this artifact was frozen for this run

Persist it with the run so later claims and reviews can identify exactly which
artifact governed execution.

### 2. Reuse Context Bundle as the execution conveyor

Represent the frozen execution-spec as a required, job-scoped context bundle
instead of inventing a new runner-only payload. That keeps the contract aligned
with `FR-009` and avoids split-brain semantics.

### 3. Materialize bundle content before mount

Add the missing runner-side materialization step so context-bundle mounts point
at actual files or directories before `docker run`. This must cover the new
execution-spec bundle and should remain compatible with existing local-template,
external-artifact, and job-inline source kinds.

### 4. Make the artifact the primary execution contract

The agent prompt can summarize where the frozen artifact is mounted, but the
execution contract must become "read this injected artifact" rather than "trust
the raw prompt string as truth".

### 5. Preserve reviewer traceability

Run metadata and claim surfaces should expose an execution contract reference so
reviewers can answer which frozen artifact produced a result and whether a newer
collaboration revision requires a new job.

## Implementation Order

1. Update `specs/020-layered-context-harness/plan.md` and re-run
   `plan-eng-review`.
2. Regenerate `tasks.md`; the current file is documentation-only and must not be
   treated as the implementation backlog.
3. Extend shared schemas for frozen execution-spec representation and execution
   contract reference.
4. Extend control-plane job creation to freeze and persist the execution-spec
   artifact and thread it into resolved runtime.
5. Extend runner bundle materialization so context bundles become concrete
   mounted inputs.
6. Update runner prompt generation and execution setup to point agents at the
   frozen artifact as the primary contract.
7. Add focused tests across shared schemas, DB/job creation, claim payloads, and
   runner setup.
8. Reconcile docs in `020`, `002`, and `docs/ARCHITECTURE.md` with the
   implemented behavior.

## Verification Checkpoints

| After | Check | Command / Evidence |
|---|---|---|
| Shared schema update | frozen artifact and execution reference are typed and validated | `pnpm --filter @mystra/shared test && pnpm --filter @mystra/shared typecheck && pnpm --filter @mystra/shared build` |
| Control-plane freeze wiring | created jobs persist a frozen execution artifact and surface it in runtime/claim metadata | `pnpm --filter @mystra/control-plane test` |
| Runner materialization | required execution bundle is written before mount and prompt points at mounted artifact | `pnpm --filter @mystra/runner-daemon test` |
| Cross-package reconciliation | changed contracts remain type-safe across packages | `pnpm typecheck` |
| Final delivery | docs, plan, tasks, and runtime behavior agree | focused review of touched specs and code |

## Test Coverage Expectations

New or updated tests must cover:

- successful freezing of an execution-spec artifact at job creation
- failure before execution when the required artifact cannot be built or found
- claim payloads that expose the execution contract reference
- runner materialization of the execution-spec bundle into a mounted path
- prompt generation that references the mounted artifact instead of treating raw
  chat-like prompt content as execution truth
- reviewer-facing traceability from run metadata back to the frozen artifact

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Rebuilding a second injection channel beside Context Bundle | thread the execution-spec through existing runtime/context-bundle contracts |
| Over-engineering full generic artifact storage before the MVP needs it | ship the smallest run-scoped artifact representation that satisfies `020` |
| Runner mounts still point at empty paths | add explicit materialization tests before relying on mount behavior |
| Prompt remains de facto source of truth | force prompt text to reference the mounted artifact, not replace it |
| Tasks stay misleading after replanning | regenerate `tasks.md` only after review and treat the old file as obsolete |

## Review Status

`plan-eng-review` completed on 2026-05-18 for
`arcadia822/layered-context-harness`.

- **Scope decision**: accept the reduced, artifact-first closed loop only. No
  generic artifact registry, no second injection channel, no broader workflow
  redesign.
- **Risk**: MEDIUM. The touched symbols sit on the main submission, claim, and
  Docker execution path, but the blast radius stays limited to shared runtime
  schemas, `createJob()`, and `executeDockerJob()`.
- **Findings**: no architecture blockers. The only review-driven adjustment was
  to keep bundle materialization generic enough for existing source kinds while
  making the execution-spec bundle first-class and required.

## What Already Exists

- `resolveRuntimeContract()` already gives a single freeze point input path.
- `createJob()` already persists `resolved_runtime`, which is the right place to
  attach the frozen artifact.
- runner claim routes already return runtime to execution workers.
- runner mount resolution already has a deterministic path for context bundles,
  but the content producer is missing.

## Not In Scope

- Caller auth, logs API, retry API, callback URLs, or any other MVP-boundary
  expansion.
- A generic artifact registry product surface.
- A hosted RDB redesign.
- Rewriting the entire prompt/execution model beyond making the frozen artifact
  the primary contract source.
