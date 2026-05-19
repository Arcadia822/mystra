# Tasks: Coordination Run Summaries

**Input**: Design documents from `/specs/018-coordination-run-summaries/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Backfill note**: This task list was reconciled against the landed code on
`main` after the original execution checklist drifted. It records the completed
compact-summary slice that now exists in the repository.

## Completed Tasks

- [x] T001 Add and export the shared `CoordinationRunSummary` schema in `packages/shared/src/coordination-run-summary.ts` and `packages/shared/src/index.ts`
- [x] T002 Cover queued/running/terminal summary validation in `packages/shared/src/coordination-run-summary.test.ts`
- [x] T003 Add `getJobSummary()` plus the compact summary projection path in `apps/control-plane/src/lib/db/sqlite-provider.ts`, `apps/control-plane/src/lib/db/rdb-provider.ts`, and `apps/control-plane/src/lib/coordination-run-summary.ts`
- [x] T004 Keep raw diagnostic job surfaces intact while adding the compact HTTP summary route in `apps/control-plane/app/api/jobs/[id]/summary/route.ts`
- [x] T005 Expose the same compact summary through MCP with `mystra_get_job_summary` in `apps/control-plane/app/api/mcp/route.ts`
- [x] T006 Add focused route regressions for HTTP/MCP compact summary behavior in `apps/control-plane/app/api/routes.test.ts`
- [x] T007 Add the shared CLI polling helper in `scripts/lib/job-summary.mjs` and the `scripts/job-status.mjs` entrypoint
- [x] T008 Expose the status command at the repo root with `pnpm job:status` in `package.json`
- [x] T009 Refresh operator docs and Spec-Kit status surfaces after reconciling the landed scope
