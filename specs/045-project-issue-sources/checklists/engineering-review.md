# Engineering Review: 045 Project Issue Sources

**Date**: 2026-08-08
**Status**: CLEARED
**Unresolved decisions**: 0
**Critical gaps**: 0

## Step 0: Scope challenge

- Existing IntegrationConnection/SecretProvider/GitHub provider/RBAC/UI primitives are reused.
- Minimum complete change still crosses shared contracts, RDB, services, APIs and UI. More than eight files is inherent vertical-slice work, not evidence for a new framework.
- Scope reductions already accepted: no detail page, dispatch, OAuth, cache, multi-Team or aggregation.
- `TODOS.md` does not exist. Deferred product work is explicitly listed in plan rather than silently creating a vague backlog.

## Architecture review

1. **Resolved P1 (confidence 10/10)**: global `defaultIntegrationRegistry` cannot select exact per-Project credentials and is CRITICAL impact. Plan uses a Project-scoped service instead.
2. **Resolved P1 (confidence 9/10)**: `linearTeamId` alone would allow wrong-credential reuse. Persistence stores exact connection + external Team ID with Team ownership validation.
3. **Resolved P1 (confidence 9/10)**: shared normalized list would violate approved native columns. Public response is a discriminated provider union.

Production failures are mapped: credential revoke -> unauthorized state; Team deletion -> scope unavailable; GraphQL partial 200 -> invalid/upstream failure; stale cursor -> rejected; provider timeout -> isolated retry state.

## Code quality review

- Credential lifecycle mirrors existing GitHub PAT service but uses a Linear-specific validator; no generic credential super-service is introduced.
- Project Issues UI shares orchestration primitives, not provider row schemas.
- Error mapping remains stable and secret-free.
- Complex service pipelines should carry the source-resolution ASCII diagram from `plan.md`; simple React tables should not acquire decorative diagrams.

No unresolved quality issue.

## Test coverage diagram

```text
CODE PATH COVERAGE PLAN
=======================
[+] Linear connection create/replace/delete
    ├── valid create + duplicate identity + multiple connections      [unit/API]
    ├── invalid/401/403/429/timeout/GraphQL errors                    [unit/API]
    ├── replace validates before atomic switch                        [service/RDB contract]
    ├── delete unreferenced removes secret + row                      [service/RDB contract]
    └── delete referenced source conflicts                            [service/API]

[+] ProjectIssueSource persistence
    ├── create/get/idempotent upsert                                  [SQLite+PostgreSQL contract]
    ├── replacement keeps one source                                  [SQLite+PostgreSQL contract]
    ├── cross-Team Project/connection rejected                        [service/API]
    └── removal leaves GitHub repository binding unchanged            [contract/API]

[+] Project issue list
    ├── GitHub exact repo/connection + PR exclusion + native fields   [provider/service/API]
    ├── Linear exact Team filter + native fields/cycle                [provider/service/API]
    ├── no Linear source -> no upstream request                       [service/API]
    ├── stale/scope-mismatched cursor rejected                        [unit/API]
    └── one provider failure does not call/block the other            [component/API]

USER FLOW COVERAGE PLAN
=======================
[+] Settings Linear detail
    ├── Owner/Admin create/replace/delete                             [API + browser]
    ├── Member mutation denied before upstream call                   [authorization API]
    └── key absent from response and DOM                              [security + browser]

[+] Project Issues tab
    ├── configure/replace/remove Linear source                        [browser]
    ├── native GitHub/Linear columns                                  [component + browser]
    ├── independent filters/cursors survive provider switch           [component + browser]
    ├── external provider link only; no detail/dispatch control       [component + browser]
    └── 320/768/1024/1440 + keyboard/focus                            [browser]

[+] /issues Project-first
    ├── no selection -> zero upstream request                         [API/browser]
    ├── select/switch Project clears old provider state               [component/browser]
    └── no active Project -> honest empty state                       [component/browser]
```

Every planned branch has a named test level. There are no LLM/prompt changes and no eval suite requirement.

## Failure mode audit

| Path | Production failure | Test | Handling | User-visible |
|---|---|---|---|---|
| connection validation | invalid/revoked key | yes | fail before write | clear credential error |
| secret replacement | DB transaction failure | yes | rollback old ref/envelope | retryable error |
| Team discovery | GraphQL partial data | yes | reject errors/data | clear upstream error |
| source save | cross-Team/stale connection | yes | authorization/scope reject | clear unavailable state |
| list | timeout/rate limit | yes | stable IntegrationFailure | per-provider retry state |
| list | stale cursor | yes | scope fingerprint reject | reset/reload action |
| UI | provider switched mid-request | yes | abort/ignore stale result | no cross-provider flash |

No failure is both silent and uncovered.

## Performance review

- No N+1: Linear uses one scoped upstream request per visible page. GitHub uses one stable-ID repository resolution plus one Issue list request because mutable repository names are deliberately not Project persistence.
- Hidden provider is not prefetched.
- Team discovery and Issue list remain cursor-paginated.
- No cache in 045, by explicit product decision; rate-limit recovery is surfaced rather than hidden polling.

## Parallelization

Sequential implementation. Shared contracts and RDB schema gate services; services gate API; API contracts gate UI. Parallel worktrees would touch the same shared/DB modules and create merge risk without meaningful latency reduction.

## Completion summary

- Step 0: scope accepted as already reduced by owner decisions.
- Architecture: 3 issues found and resolved in plan.
- Code quality: 0 unresolved issues.
- Tests: full path diagram produced, 0 unassigned gaps.
- Performance: 0 unresolved issues.
- NOT in scope and existing reuse: written.
- TODO proposals: 0; deferred items already explicit and need future specs, not vague TODOs.
- Failure modes: 0 critical gaps.
- Outside voice: skipped; project-local design/spec and GitNexus evidence were sufficient.
- Parallelization: sequential.

## Implementation evidence and final review

### Pre-edit impact record

- `RdbProvider`, `PrismaRdbProvider`, and `defaultIntegrationRegistry`: CRITICAL because they sit on shared persistence and provider-resolution paths.
- `ShellSettings` and `RdbSecretProvider`: HIGH because they affect the shared settings surface and secret storage namespace.
- Project/source/provider-specific helpers and routes: LOW at the individual-symbol level.
- The owner was warned before edits. The design kept Prisma types private, preserved the `RdbProvider` boundary, introduced an explicit Linear secret namespace, and avoided changing the registry into a Project credential resolver.

### Final GitNexus comparison

After refreshing the index, `detect_changes(scope=compare, base_ref=main)` reported 79 changed symbols in 51 indexed files, 18 affected processes, and overall CRITICAL risk. This agrees with the pre-edit record: persistence, connection resolution, settings, and primary navigation are intentionally crossed. The affected boundaries are covered by Prisma parity/contract tests, provider/service/API tests, navigation/model tests, full typecheck/lint/test/build, and real-browser failure isolation. No additional unplanned execution boundary was identified.

### Security and scope audit

- Product code contains no process-level `LINEAR_API_KEY` lookup; API keys enter only through the password input and SecretProvider write path.
- Connection, source, and Issue responses are parsed by secret-free shared schemas.
- Linear Issue requests always resolve one exact Project source and revalidate its Team; GitHub Issue requests resolve the Project's exact connection and stable repository external ID.
- GitHub and Linear rows, filters, cursors, loading, and errors remain provider-discriminated; there is no combined response or combined UI.
- No Mystra Issue detail route, Task creation/dispatch control, write-back action, webhook, OAuth, cache, or multi-Team Project association was added.

### Five-axis code review

- Correctness: provider scope, cursor scope, PR exclusion, Team revalidation, authorization, and reference protection are asserted.
- Security: plaintext credentials remain outside RDB/public outputs; mutation permissions are Owner/Admin only; Member reads remain permitted.
- Reliability: replacement validates before switching, stale cursors fail closed, and provider failures remain isolated.
- Performance: GitHub performs stable repository resolution plus one list call; Linear performs one Team-scoped list call; hidden providers are not prefetched.
- Maintainability: shared Zod boundaries and existing provider/RDB patterns are reused; no compatibility shim or generalized integration catalog was introduced.

Review verdict: no unresolved code defect or acceptance-evidence gap remains. T046/SC-010 passed in connected Chrome with a native keyboard-only journey, visible focus, provider switching, filter-state isolation, retry/error handling, and a clean console.
