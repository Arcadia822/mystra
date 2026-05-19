# Implementation Plan: Coordination Run Summaries

**Branch**: `018-coordination-run-summaries` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-coordination-run-summaries/spec.md`

## Summary

Add a shared compact `CoordinationRunSummary` contract derived from existing durable job/run/event/result state, expose it through a dedicated HTTP route, MCP tool, and CLI status command, and keep the existing full job snapshot surfaces unchanged for diagnostic use. The design should prefer poll-friendly machine-readable status with current phase, current milestone, terminal outcome, and core links rather than raw event history.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 runtime assumptions  
**Primary Dependencies**: Next.js 16 route handlers, Zod 4 shared contracts, Vitest 4, existing fetch-based Node scripts  
**Storage**: Existing SQLite-backed `RdbProvider` state for jobs, runs, results, and events; no new persistence table planned  
**Testing**: `pnpm --filter @mystra/shared test`, `pnpm --filter @mystra/control-plane test`, targeted script smoke checks, relevant typechecks/builds  
**Target Platform**: Headless Mystra control plane, remote MCP callers, and local operator shell usage  
**Project Type**: TypeScript monorepo with Next.js control plane, shared contract package, and Node CLI scripts  
**Performance Goals**: Coordinator polling should avoid returning full event arrays and workflow node histories; summary derivation should remain cheap enough for repeated polling on one control-plane node  
**Constraints**: No logs API, no callback URLs, no UI-first dependency, no fake placeholders for missing review links, and no contract drift between API/MCP/CLI  
**Scale/Scope**: Single-machine MVP with one or more coordinating agents polling many active jobs across the same shared control-plane surface

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The feature stays inside MVP by improving run/result coordination surfaces without adding auth, logs persistence, retry APIs, callbacks, or quality-gate fix loops.
- **Typed Contracts at Service Boundaries**: PASS. The feature is centered on a new shared summary contract across HTTP API, MCP, and CLI.
- **Providers Are Replaceable Boundaries**: PASS. Summary projection is derived from Mystra-owned provider state and does not hardcode a new storage or external workflow dependency.
- **Runner Isolation and Secret Hygiene**: PASS. The feature changes read-side coordination output only and introduces no new secret handling path.
- **Verification And Documentation Before Delivery**: PASS. The plan includes shared-schema tests, control-plane route/tool tests, CLI verification, and Spec-Kit artifacts.

## Project Structure

### Documentation (this feature)

```text
specs/018-coordination-run-summaries/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   ├── cli.md
│   └── mcp.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── index.ts
├── result.ts
├── workflow.ts
└── [new summary contract file]

apps/control-plane/
├── app/
│   ├── api/jobs/[id]/route.ts
│   ├── api/jobs/[id]/summary/route.ts
│   ├── api/jobs/route.ts
│   ├── api/mcp/route.ts
│   └── api/routes.test.ts
└── src/lib/db/
    ├── rdb-provider.ts
    ├── sqlite-provider.ts
    └── sqlite-provider.test.ts

scripts/
├── submit-job.mjs
└── [new job-status script]
```

**Structure Decision**: Keep the existing monorepo split. Put the shared summary schema in `packages/shared/src/` so API, MCP, and CLI all speak the same contract. Keep `RdbProvider` focused on durable records and raw snapshots, then add a dedicated summary query plus a pure control-plane/shared projection layer that turns the lighter query result into `CoordinationRunSummary`. All compact summary surfaces should use the same top-level payload shape. Keep terminal and polling shell affordances in `scripts/`, with one small shared CLI helper reused by both `submit-job.mjs` wait mode and the new status command.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md).

## Phase 1: Design & Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/api.md](./contracts/api.md)
- [contracts/mcp.md](./contracts/mcp.md)
- [contracts/cli.md](./contracts/cli.md)

## Implementation Order

1. Shared compact summary schema and exports.
2. Lightweight summary query plus pure summary projection, with explicit latest-attempt semantics and link-source precedence.
3. HTTP summary route and MCP tool with one shared top-level payload shape and aligned structured not-found behavior.
4. Shared CLI summary helper plus `job:status`, with `submit-job.mjs` wait mode reusing the same helper.
5. Route/tool/script tests and contract verification.

## What Already Exists

| Existing surface | Current role | Plan action |
|---|---|---|
| `GET /api/jobs/{id}` | Full diagnostic job snapshot with run, events, and workflow detail | Reuse as the raw diagnostic surface, do not replace |
| `mystra_get_job` MCP tool | Full diagnostic job lookup for agents | Reuse as the raw MCP diagnostic surface, add a parallel compact summary tool |
| `scripts/submit-job.mjs` | Submission plus ad hoc wait-mode summary for terminal CLI use | Reuse as the existing CLI entrypoint, but replace inline summary polling with a shared compact-summary helper |
| `sqlite-provider.ts` snapshot assembly | Existing provider-owned truth for job/run/workflow aggregation | Reuse as the raw diagnostic path, and add a separate lightweight summary query for poll-heavy reads |
| `RunResult` plus `reviewResult` | Existing terminal result payload with both normalized and legacy review fields | Reuse as the link truth surface, with explicit precedence so compact summaries do not freeze legacy-only fields |

## ASCII Data Flow

```text
Coordinator / operator
   │
   ├── HTTP: GET /api/jobs/:id/summary
   ├── MCP: mystra_get_job_summary
   └── CLI: job:status / submit-job --wait
           │
           v
    compact summary surface
           │
           v
   summary query + pure projector
           │
           ├── run state/result
           ├── latest relevant lifecycle event(s)
           ├── optional workflow pointer
           └── project/review link fields
           │
           v
   CoordinationRunSummary

Raw diagnostics stay separate:

GET /api/jobs/:id  +  mystra_get_job
           │
           v
      full JobSnapshot
```

## Verification Checkpoints

| After | Check | Command / Evidence |
|---|---|---|
| Shared contract | Summary schema validates representative queued/running/terminal cases | `pnpm --filter @mystra/shared test` |
| Summary query + projection | Control-plane tests cover phase matrix for queued, assigned, running, review-ready, succeeded, failed, canceled, timed_out, and stale-marked runs using the lightweight summary read path | `pnpm --filter @mystra/control-plane test` |
| Regression guard | Raw snapshot route/tool behavior still matches the existing diagnostic surface after projector refactor | `pnpm --filter @mystra/control-plane test` |
| API + MCP | HTTP summary route and MCP summary tool return the same top-level payload shape plus aligned structured not-found behavior | `pnpm --filter @mystra/control-plane test` |
| CLI | Shared CLI helper and `job:status` cover wrapped JSON output, wait success, wait failure-like exit, not-found exit code, and timeout exit `124` | `node ./scripts/job-status.mjs --job-id <id>` |
| Changed packages | Type surfaces remain coherent | `pnpm --filter @mystra/shared typecheck && pnpm --filter @mystra/control-plane typecheck` |
| Broad scope | Repository still builds/tests cleanly | `pnpm test && pnpm typecheck && pnpm build` |

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Summary contract drifts across API, MCP, and CLI | Define a shared schema in `packages/shared` and validate outputs at each surface |
| Polling still requires server-side full snapshot work | Add a dedicated summary query statement and keep compact summary derivation on top of that lighter read path instead of forcing full `JobSnapshot` assembly on every request |
| Phase labels become unstable or UI-shaped | Keep `runState` and `phase` separate, and limit `phase` to values that can be derived from existing durable states/events only |
| Terminal links leak fake placeholders or legacy GitLab-only fields | Define link precedence explicitly: normalized review result first, legacy compatibility fields second, preview metadata only when present |
| Retry or rerun semantics get hidden | Include `attempt` in the compact summary and define "latest" as the highest persisted attempt for the job |
| Existing tooling depends on raw snapshots | Keep the current full job routes/tools unchanged and add a new summary surface |

## Failure Modes

| Codepath | Realistic production failure | Test planned | Error handling planned | User-visible result |
|---|---|---|---|---|
| Summary query + projection | Latest relevant event is missing or malformed, causing bad phase derivation | Yes, summary matrix tests | Yes, projector falls back to durable run state and headline defaults | Clear but less detailed current phase, not silent corruption |
| HTTP summary route | Unknown job id | Yes | Yes, structured `job_not_found` | Clear not-found response |
| MCP summary tool | Summary tool drifts from HTTP payload shape or not-found behavior | Yes, parity tests | Yes, shared schema validation at the tool boundary | Clear contract error during tests rather than silent divergence |
| CLI wait mode | Poll loop never reaches terminal before timeout or job lookup fails | Yes | Yes, explicit timeout and not-found exits | Clear timeout or not-found error |
| Raw snapshot regression | Shared projector refactor breaks existing diagnostic route/tool | Yes, explicit regression test | Yes, regression test blocks merge | Existing diagnostic callers stay intact |

## NOT in Scope

- Streaming or push-based progress delivery, because the confirmed job is poll-friendly coordination, not realtime transport.
- Milestone history timelines, because spec18 only needs the current milestone plus terminal outcome.
- Logs API or stdout/stderr exposure, because MVP durable truth remains run state, result, and structured events.
- UI-first dashboard redesign, because management surface priority is API, MCP, and CLI first.
- New persistence tables or cache infrastructure for summaries, because the accepted approach is one dedicated read query over current durable state, not a second stored truth.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|------|-----------------|------------|
| Shared summary contract | `packages/shared/src/` | — |
| Summary query + projector | `apps/control-plane/src/lib/db/`, `apps/control-plane/src/lib/` | Shared summary contract |
| HTTP + MCP summary surfaces | `apps/control-plane/app/api/` | Summary query + projector |
| CLI helper + status command | `scripts/`, root package scripts | Shared summary contract, HTTP summary route shape |
| Test backfill | `packages/shared/src/`, `apps/control-plane/`, `scripts/` | Provider projector, HTTP + MCP summary surfaces, CLI helper |

Parallel lanes:

- **Lane A**: Shared summary contract → Summary query + projector → HTTP + MCP summary surfaces (sequential, shared contract and control-plane modules)
- **Lane B**: CLI helper + status command (starts after summary contract shape is frozen, then independent from control-plane internals)
- **Lane C**: Test backfill (starts once the relevant codepaths land, touches shared + control-plane + scripts)

Execution order:

1. Launch Lane A first.
2. Once the summary contract is frozen, launch Lane B in parallel with the later half of Lane A.
3. Merge A + B, then run Lane C for full verification.

Conflict flags:

- Lanes A and C both touch `apps/control-plane/`, so test-heavy work should wait until API/provider changes stabilize.
- Lanes B and C both touch `scripts/`, so avoid parallel edits there once CLI helper work begins.

## Post-Design Constitution Re-Check

PASS. The design remains headless, contract-first, and inside MVP scope. It strengthens API/MCP/CLI management surfaces without introducing a UI dependency or a new persistence seam.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND | 8 outside-voice findings, major ones folded back into phase model, light-query path, and contract parity updates |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 21 issues/gaps reviewed, 0 critical gaps left open |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL:** Both reviews aligned on one important thing, compact summary should be a real polling surface rather than just a smaller JSON payload. The main disagreement was projector placement, and the accepted direction is a dedicated summary query plus pure projection above raw storage records.

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — ready for task decomposition and implementation.
