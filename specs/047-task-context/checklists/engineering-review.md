# Engineering Review: 047 Task Context

**Date**: 2026-08-08
**Branch**: `047-task-context`
**Decision**: APPROVED FOR TASK GENERATION

## Step 0 — Scope Challenge

- The plan touches more than eight files, but this is not eight new concepts. It replaces one already-consumed Task contract across existing shared, RDB, HTTP/MCP/CLI and Web boundaries.
- A database-only or UI-only reduction would leave the old contract active in another canonical client and violate the requested complete spec. Scope remains as written.
- Exactly one new service is justified: exact Issue resolution plus Task composition. No new package, repository wrapper, queue, event bus or Session placeholder is introduced.
- Existing `RdbProvider`, ProjectIssuesService, provider reads, auth/RBAC, UI resources and shell components are reused.
- No `TODOS.md` exists and no deferred item blocks 047. No new TODO is justified; the explicit non-goals remain in the spec.

## Architecture Review

```text
manual clients --------------------+
                                    v
                           shared Task contracts
                                    |
Issue row -> exact source/provider -+-> RdbProvider -> Prisma
                                    |
                                    +-> Task response -> UI/MCP/CLI
```

- **[P1 resolved] (confidence 10/10)** Persisting only `issueDispatchKey` cannot prove exact source after Project source changes. Plan now stores provider + connection + scope + external ID and compares before provider access.
- **[P1 resolved] (confidence 9/10)** UI-submitted Issue title/ID alone could create an orphan after source revocation. Plan now performs provider GET before the atomic local write.
- **[P1 resolved] (confidence 9/10)** A remote provider failure must not make an existing Task unreadable. Detail response separates durable Task from transient Issue availability.
- **[P2 resolved] (confidence 9/10)** Manual double-click protection in React is insufficient for retries. Team-scoped persisted idempotency is now required.
- **[P1 resolved] (confidence 9/10)** A Project-filtered Issue-link query misses the same exact source bound by another Project. Plan now uses one exact-source-scoped external-ID batch lookup.
- No unresolved architecture issue remains. No distribution pipeline is needed because 047 adds no new artifact type.

## Code Quality Review

- Strict public create/update schemas replace metadata interpretation and prevent mass assignment.
- Provider-specific single Issue lookup stays in existing integration adapters; Task service composes but does not own credentials.
- `TaskIssueReference` is a typed value, not another CRUD business object.
- The pre-0.1 table is replaced instead of supporting old and new shapes.
- Inline ASCII comment recommended only in Task service above the source-verify → provider-read → DB-create pipeline. Prisma model and UI components do not need commentary diagrams.
- No unresolved code-quality issue remains.

## Test Review

Detected framework: Vitest 4 with repository `vitest.config.ts`; real browser validation is additionally required.

```text
CODE PATH COVERAGE PLAN
=======================
[+] shared Task schemas
    ├── [PLANNED ★★★] manual/issue/update happy paths
    ├── [PLANNED ★★★] strict unknown fields + length boundaries
    └── [PLANNED ★★★] partial Issue fingerprint rejection

[+] RdbProvider
    ├── [PLANNED ★★★] no-Project and Project create
    ├── [PLANNED ★★★] manual replay + 20-way Issue race
    ├── [PLANNED ★★★] cross-Team/archived Project failure
    └── [PLANNED ★★★] mutable text only; refs unchanged

[+] exact Issue Task service
    ├── [PLANNED ★★★] GitHub and Linear exact match
    ├── [PLANNED ★★★] source mismatch before network fallback
    └── [PLANNED ★★★] 404/timeout/invalid response; no local write

[+] HTTP/MCP/CLI
    ├── [PLANNED ★★★] active Team derivation and strict bodies
    ├── [PLANNED ★★★] create/list/get/update adapters
    └── [PLANNED ★★★] relation mutation rejected

USER FLOW COVERAGE PLAN
=======================
[+] /new manual create [->E2E]
    ├── [PLANNED ★★★] no Project + Project + retry + validation
    └── [PLANNED ★★★] scoped draft clear/recovery/team switch

[+] Issue row create/open [->E2E]
    ├── [PLANNED ★★★] stay on list, success/error, refresh Open Task
    └── [PLANNED ★★★] provider link retained; explicit navigation only

[+] Task discovery/edit [->E2E]
    ├── [PLANNED ★★★] No project/Project grouping exactly once
    └── [PLANNED ★★★] edit text; immutable reference presentation

PLANNED COVERAGE: 18/18 paths (100%)
E2E-worthy critical flows: 3
Critical regressions guarded: old Project-required New flow and issue row provider link
```

The QA artifact is stored at `~/.gstack/projects/mystra/arcadia-047-task-context-eng-review-test-plan-20260808-195142.md`.

## Performance Review

- Task create/update is one serializable DB operation with bounded conflict retry.
- Issue list decoration uses one exact-source-scoped batch Task-link query per remote page, not one query per Issue and not a Project-only filter.
- Exact Issue create performs one source lookup and one provider GET before DB write; no pagination scan is used for validation.
- Task detail may perform one provider GET only when the stored source fingerprint still matches current source.
- Existing Team Task list is unbounded for the current self-use MVP. 047 does not add a second unbounded join; pagination remains outside this spec because the shell contract requires complete grouping and the owner did not define list paging.
- No unresolved performance issue remains.

## Failure Modes

| Path | Production failure | Test | Error handling | User-visible |
| --- | --- | --- | --- | --- |
| manual create | duplicate network delivery | provider/API concurrency test | unique + reread | same Task / created false |
| Project create context | Project archived after render | provider/API test | fail closed | recoverable form error |
| Issue create | source revoked/switched | service/API test | compare before provider read | row error, stays list |
| Issue create | provider timeout/invalid body | provider/service test | IntegrationFailure | row error, stays list |
| Task detail | Issue deleted | service/API test | availability projection | Task visible, Issue unavailable |
| Task update | relation field injected | schema/API test | strict parse | validation error |
| New draft | localStorage unavailable | UI model/component test | guarded read/write | current-tab state remains |
| Issue row | repeated click | UI + DB concurrency test | disabled state + DB unique | one Task |

Critical silent gaps: 0.

## Worktree Parallelization

| Step | Modules | Depends on |
| --- | --- | --- |
| contracts | `packages/shared` | — |
| persistence | `apps/control-plane/prisma`, `src/lib/db` | contracts |
| issue resolution | `src/lib/integrations`, `src/lib/tasks` | contracts |
| programmable adapters | `app/api`, MCP, CLI | persistence + issue resolution |
| Web UI | `app/_components`, pages, CSS | contracts + API |

Potential lanes exist after contracts, but this execution has no authorized sub-Agent. Sequential order avoids shared generated-client and API test conflicts.

## NOT in scope

- Session creation/launch/defaults/auto-routing — owned by a future Session spec.
- Issue state/priority/assignment/write-back/cache — external provider remains authoritative.
- Task status machine, archive/delete/history — explicitly excluded by 047.
- Mystra Issue detail page or Issue-to-Task wizard — owner requires a single row button.
- Task templates/subtasks/automation/search ranking — not needed for the context-container contract.

## Completion Summary

- Step 0 Scope Challenge: scope accepted as-is; reduction would violate end-to-end contract replacement.
- Architecture Review: 5 issues found, all resolved in plan.
- Code Quality Review: 0 unresolved issues.
- Test Review: diagram produced, 18 planned paths, 0 gaps.
- Performance Review: 0 unresolved issues.
- NOT in scope: written.
- What already exists: written in plan and review.
- TODOS.md updates: 0 proposed.
- Failure modes: 0 critical gaps.
- Outside voice: skipped; no delegation authorized and no unresolved decision warrants it.
- Parallelization: 4 dependent lanes; sequential execution selected.
- Lake Score: 5/5 complete recommendations adopted.

No engineering decision blocks `/speckit.tasks`.
