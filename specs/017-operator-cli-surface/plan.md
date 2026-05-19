# Implementation Plan: Operator CLI Surface

**Branch**: `017-operator-cli-surface` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-operator-cli-surface/spec.md`

## Summary

Ship a shell-first operator CLI that reuses Mystra's canonical management API for
project inspection, run inspection, result retrieval, and failure-context
retrieval. Keep the implementation boring: a repo-local Node script plus tests
and docs, not a new package, binary release pipeline, or competing API surface.

## Technical Context

**Language/Version**: JavaScript CLI on Node.js 24, existing TypeScript 5.9 monorepo  
**Primary Dependencies**: Native `fetch`, existing management HTTP routes in `apps/control-plane`, shared contract definitions in `packages/shared`, Vitest 4  
**Storage**: N/A for the CLI itself, reads durable SQLite-backed state through the existing management API  
**Testing**: `pnpm --filter @mystra/control-plane test`, `pnpm --filter @mystra/control-plane typecheck`, `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/shared build`  
**Target Platform**: Debian-hosted operator shell, plus local developer machines invoking the same repo-local script  
**Project Type**: TypeScript pnpm monorepo with a repo-local Node CLI wrapper under `scripts/`  
**Performance Goals**: One HTTP call per operator action, no fan-out reads in the CLI, readable output for routine shell use  
**Constraints**: Reuse canonical management API truth, stay inside current MVP scope, avoid introducing a new distributable artifact, keep output explicit and failure states distinguishable  
**Scale/Scope**: One repo-local operator CLI entrypoint, six core commands, JSON and human-readable output modes, and no packaging/publishing pipeline in this feature

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design.*

- **Specification Owns Product Boundaries**: PASS. This plan stays within the
  shell-first operator surface and does not introduce caller auth, logs API,
  retry flows, or new hosted distribution promises.
- **Typed Contracts at Service Boundaries**: PASS. The CLI consumes the frozen
  management API shapes and preserves the existing error vocabulary instead of
  inventing new backend semantics.
- **Providers Are Replaceable Boundaries**: PASS. The CLI talks to HTTP only and
  does not bind itself to SQLite, Docker, or provider-specific internals.
- **Runner Isolation and Secret Hygiene**: PASS. The CLI reads operator state and
  never introduces new secret movement or runner-host coupling.
- **Verification And Documentation Before Delivery**: PASS. The feature includes
  CLI behavior tests, docs, and focused package validation before closeout.

## Step 0 Scope Challenge

1. **What already exists**
   - `scripts/submit-job.mjs` already proves the repo uses small Node operator
     scripts instead of a packaged CLI.
   - `GET /api/projects`, `GET /api/projects/{slug}`, `GET /api/jobs`, and
     `GET /api/jobs/{id}` already expose the management truth this CLI needs.
   - `packages/shared/src/management.ts` already defines the project and run
     payload shapes plus the machine-readable management error vocabulary.
   - `docs/LOCAL-USAGE.md` already documents the operator runbook and can absorb
     CLI usage without creating a second manual.
2. **Minimum change that achieves the goal**
   - Add one repo-local CLI entrypoint in `scripts/operator-cli.mjs`.
   - Add one convenience script in root `package.json`.
   - Add one focused test file covering parsing, formatting, and outcome mapping.
   - Update feature docs and the local operator runbook.
3. **Complexity check**
   - Keep this feature below the smell threshold. One entrypoint script and one
     test file is enough. No new package, no service class hierarchy, no CLI
     framework dependency.
4. **Search / tool check**
   - Live repository inspection was sufficient for planning because the touched
     surface is small and already well-bounded by `014` and `015`.
   - GitNexus planning evidence is therefore recorded as a deliberate fallback:
     direct code inspection over routes, shared schemas, and the existing submit
     script gave enough confidence for this slice.
5. **Completeness check**
   - The complete version includes both human-readable output and `--json`, plus
     distinguishable missing / not-ready / unavailable outcomes. Shipping only a
     happy-path wrapper would fail the feature.
6. **Distribution check**
   - This feature intentionally does **not** create a new binary package or CI
     publish path. The operator surface ships as a repo-local script invoked via
     `pnpm operator:cli -- ...`. Packaging is explicitly out of scope.

**Scope verdict**: Keep it repo-local and boring. The user wants an operator
surface, not a productized CLI distribution story yet.

## Project Structure

### Documentation (this feature)

```text
specs/017-operator-cli-surface/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── operator-cli-commands.md
│   └── operator-cli-outcomes.md
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
└── operator-cli.mjs

apps/control-plane/src/lib/
└── operator-cli.test.ts

package.json
docs/LOCAL-USAGE.md
```

**Structure Decision**: Keep the executable entrypoint in `scripts/` beside
`submit-job.mjs`, keep tests in the existing control-plane Vitest surface, and
reuse the already-documented local operator runbook.

## Complexity Tracking

This slice stays appropriately engineered if it adds:

1. One repo-local entrypoint script.
2. One focused test file.
3. One package.json alias and local docs updates.

If implementation starts adding a new workspace package, custom HTTP client
framework, or binary packaging pipeline, stop and reduce scope.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. The canonical management API already exposes the project and run truth needed
   by the operator CLI.
2. `scripts/submit-job.mjs` is the right delivery precedent. Adding another
   repo-local script is cheaper and more honest than creating a package.
3. The CLI must provide both human-readable output and `--json` so it works for
   shell operators and scripted handoffs.
4. Missing, not-ready, unavailable, and failed outcomes need explicit mapping in
   the CLI, not implicit interpretation by the operator.
5. Workflow and lane/context facts are already present in project detail and job
   snapshots, so the CLI should project them rather than adding endpoints.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/operator-cli-commands.md](./contracts/operator-cli-commands.md)
- [contracts/operator-cli-outcomes.md](./contracts/operator-cli-outcomes.md)

The implementation slice for `017` should:

1. Add `scripts/operator-cli.mjs` with explicit subcommands:
   `projects list`, `projects inspect`, `runs list`, `runs inspect`,
   `runs result`, and `runs failure`.
2. Default to human-readable shell output, with `--json` returning structured
   payloads suitable for piping and tooling.
3. Map management API errors and snapshot-derived edge states to explicit
   operator outcomes and stable exit codes.
4. Reuse the existing management API routes exactly as they are today, with no
   CLI-specific backend endpoint.

### Data Flow Diagram

```text
operator shell
  -> pnpm operator:cli -- <command>
    -> scripts/operator-cli.mjs
      -> fetch canonical management API
        -> /api/projects
        -> /api/projects/{slug}
        -> /api/jobs
        -> /api/jobs/{id}
      -> normalize success / operator outcome
        -> human-readable stdout
        -> structured JSON stdout
        -> exit code
```

### Command Coverage Diagram

```text
projects list
  -> GET /api/projects

projects inspect <slug>
  -> GET /api/projects/{slug}
    -> current lane / workflow / runtime facts

runs list
  -> GET /api/jobs

runs inspect <jobId>
  -> GET /api/jobs/{jobId}
    -> run state + current project view + frozen lane snapshot

runs result <jobId>
  -> GET /api/jobs/{jobId}
    -> terminal result summary
    -> RESULT_NOT_READY if run not terminal
    -> RESULT_UNAVAILABLE if terminal but no result payload

runs failure <jobId>
  -> GET /api/jobs/{jobId}
    -> failure summary + error context for failed/canceled/timed_out/needs_human_review
    -> RESULT_NOT_READY if still active
    -> RESULT_UNAVAILABLE if succeeded or terminal without failure context
```

## What Already Exists

- `scripts/submit-job.mjs`: reused as the command-shape and distribution
  precedent, not replaced.
- `apps/control-plane/app/api/projects/route.ts`: reused directly for project
  listing.
- `apps/control-plane/app/api/projects/[slug]/route.ts`: reused directly for
  project inspection and lane/context facts.
- `apps/control-plane/app/api/jobs/route.ts`: reused directly for run listing.
- `apps/control-plane/app/api/jobs/[id]/route.ts`: reused directly for run
  inspection, result retrieval, and failure-context retrieval.
- `packages/shared/src/management.ts`: reused as the backend contract source,
  even though the repo-local script does not import it at runtime.

## NOT In Scope

- Publishing a standalone binary or npm package, because this feature only needs
  a repo-local operator surface.
- Adding new management API endpoints, because `014` and `015` already expose
  the required truth.
- Mutating operations such as run cancel or project edit, because the spec is
  bounded to inspection and retrieval.
- Auth, remote install UX, and multi-platform packaging, because they belong to
  later surface-hardening work.

## Code Evidence

- `scripts/submit-job.mjs` already handles argument parsing, HTTP fetches, wait
  loops, and JSON output in a small Node script. That is the cheapest operator
  CLI precedent in this repo.
- `apps/control-plane/app/api/projects/route.ts` returns canonical `{ projects }`
  payloads suitable for `projects list`.
- `apps/control-plane/app/api/projects/[slug]/route.ts` returns project detail
  with `project.lane`, which already contains workflow/context/runtime facts.
- `apps/control-plane/app/api/jobs/route.ts` returns canonical `{ jobs }`
  payloads suitable for `runs list`.
- `apps/control-plane/app/api/jobs/[id]/route.ts` returns the canonical run
  snapshot, including `run.result`, `project`, `lane`, and `workflow`.
- `docs/LOCAL-USAGE.md` already documents curl-based operator inspection, which
  this feature can simplify rather than replace.

## Failure Modes

| Codepath | Realistic failure | Test required | Error handling | User-visible outcome |
|---|---|---|---|---|
| `projects list` | Control plane returns a management error or invalid JSON | yes | yes | explicit operator error with non-zero exit |
| `projects inspect` | slug missing or archived project hidden | yes | yes | `PROJECT_NOT_FOUND` / management error |
| `runs list` | control plane unreachable | yes | yes | transport error with clear stderr |
| `runs inspect` | unknown job id | yes | yes | `JOB_NOT_FOUND` |
| `runs result` | run still active | yes | yes | `RESULT_NOT_READY` with distinguishable exit code |
| `runs result` | run terminal but `run.result` absent | yes | yes | `RESULT_UNAVAILABLE` |
| `runs failure` | successful run queried for failure context | yes | yes | `RESULT_UNAVAILABLE`, not a fake failure |
| any command with `--json` | human formatter leaks into machine mode | yes | yes | strict JSON only |

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| CLI contract/docs | `specs/017-operator-cli-surface/`, `docs/` | — |
| CLI implementation | `scripts/`, root package metadata | CLI contract/docs |
| CLI tests | `apps/control-plane/src/lib/` | CLI command shape |

- **Lane A**: CLI contract/docs → CLI implementation (sequential, shared command semantics)
- **Lane B**: CLI tests after command shape settles (mostly independent, but depends on final command surface)

Launch Lane A first. Then run Lane B. This is mostly sequential because the test
file depends on the command and output contract settling.

## Implementation Order

1. Freeze command names, output modes, and operator outcomes in spec artifacts.
2. Add CLI behavior tests for command parsing, success output, and error mapping.
3. Implement the repo-local CLI entrypoint and package alias.
4. Refresh the local operator runbook and feature quickstart.
5. Run focused package validation and update status artifacts.

## Verification Plan

| Surface | Evidence |
|---|---|
| CLI parsing and formatting | `pnpm --filter @mystra/control-plane test` |
| Shared contract drift check | `pnpm --filter @mystra/shared test` and `pnpm --filter @mystra/shared build` |
| Type safety for touched package | `pnpm --filter @mystra/control-plane typecheck` |
| Operator documentation truth | quickstart commands in `specs/017-operator-cli-surface/quickstart.md` and `docs/LOCAL-USAGE.md` |

## Risks And Mitigations

- **Risk**: The CLI silently diverges from the management API by reshaping fields.
  **Mitigation**: keep raw JSON mode close to API payloads and test human
  formatting separately from data retrieval.
- **Risk**: The script grows into an accidental framework.
  **Mitigation**: one file, explicit subcommands, no new dependency.
- **Risk**: Operators cannot distinguish not-ready from unavailable.
  **Mitigation**: explicit operator-outcome mapping and exit-code coverage.
- **Risk**: The feature accidentally promises installation/distribution work.
  **Mitigation**: document repo-local invocation and keep packaging in NOT in scope.

## Post-Design Constitution Check

- **Specification Owns Product Boundaries**: PASS. No new product boundary is introduced.
- **Typed Contracts at Service Boundaries**: PASS. The CLI remains an API consumer.
- **Providers Are Replaceable Boundaries**: PASS. HTTP remains the seam.
- **Runner Isolation and Secret Hygiene**: PASS. Read-only operator surface.
- **Verification And Documentation Before Delivery**: PASS. Tests and docs are first-class deliverables.
