# Engineering Review：薄 Task 生产状态机与 mystra-agent CLI

**Reviewed**: 2026-08-11
**Plan**: [plan.md](../plan.md)
**Status**: CLEAR

## Step 0 — Scope Challenge

- [x] 复用 047 Task、048 Workspace、049 Session/lease、050 Task detail；没有 parallel lifecycle/runtime。
- [x] 最小完成面仍必然跨 shared contracts、RDB、services、API、Runner、CLI 与 Task UI；超过 8 files/2 services 是端到端边界的结果，不是可删的抽象。
- [x] owner 已明确 051 必须完成从 Assign 到 PR handoff 的 journey；减少 CLI、Runner capability 或 Human closeout 任一项都会使 journey 不成立，因此 scope accepted as-is。
- [x] 旧 004 gstack design doc 与 051 无关，不作为本评审 source of truth；051 spec/plan 与 5xP 为当前依据。
- [x] 仓库无 `TODOS.md`；没有 deferred item 阻塞本计划，也不新增模糊 TODO。
- [x] 新 CLI 的分发已定义为 Runner-bundled private workspace artifact；独立 npm/release channel 明确不在自用 MVP。

## Architecture Review

1. **[P1] (confidence 10/10) Workspace completion -> Session launch gap**
   现有 `WorkspacePreparationService.report` 把重复 attempt 当 stale。若 Workspace ready 已提交而 continuation 失败，Runner retry 无法再次触发 launch。计划已改为同 attempt/同 payload completion 幂等，不同 payload继续 fenced；continuation使用预分配 Session IDs。

2. **[P1] (confidence 9/10) Assign post-commit setup failure lacked durable diagnosis**
   Assign transaction提交后 remote base/workspace setup 可能失败。Task按规格保持 in_progress，但没有事实解释。Harness增加 bounded `setupFailureCode/setupFailureMessage` diagnostic，不增加 lifecycle state。

3. **[P1] (confidence 9/10) Frozen revision without frozen prompt is insufficient**
   Agent definition没有 revision history table；只保存 revision 后无法在 Agent更新后恢复旧 prompt。Harness保存 Agent system prompt snapshot，并让 Harness launch不再二次 resolve current Agent。

4. **[P1] (confidence 9/10) Control Plane cannot truthfully return host workspace path**
   048只保存 opaque workspaceRef。计划已把 logical context留在 server，最终 CLI用实际 cwd补 `workspace.root`，不扩散 Runtime-private facts。

5. **[P1] (confidence 9/10) execution code handoff timing**
   Assign时没有 Session，launch时没有 Runtime ownership。claim-time issuance复用现有 lease transaction，hash indexed persistence、expiry/reclaim rotation、terminal revocation；明文只返回一次。

6. **[P2] (confidence 9/10) CLI distribution could silently fail**
   仅创建 package 不会保证 Provider child 能调用 bare command。计划要求 Runner production dependency + exported bin path + PATH prepend，并纳入 runner build/deploy tests；独立发布延后。

## Code Quality Review

7. **[P2] (confidence 8/10) Avoid duplicating transition rules across DB/API/CLI**
   allowlist、note rule 和 allowedTransitions 放在 shared pure transition policy；DB仍做 authoritative concurrency/idempotency，Human/workload services只提供 actor scope。CLI不复制业务规则，只解析命令和服务响应。

8. **[P2] (confidence 8/10) Standard prompt must not retain mutable Task context**
   Harness launch使用 runtime/provider/frozen agent/bootstrap四组件；Task/Project/Issue数据只通过 `mystra-agent context get` 暴露。普通非 Harness Session保留049现有 assembler，避免无关行为变化。

9. **[P1] (confidence 10/10) Planned Session identity cannot be a not-yet-valid FK**
   Assign先于 Workspace/Session creation；Harness若把预分配 ID直接建成 required Session FK，两个 dialect都会拒绝插入。数据模型改为 unique `plannedSessionId` 非外键 + nullable actual `sessionId`，ready launch成功后绑定。

## Test Review

```text
Task policy matrix
  +-- legal human/agent transitions
  +-- note/terminal/allowedTransitions
  +-- projection clearing
        |
        v
RDB contract
  +-- assign tx atomicity + replay + 20-way race
  +-- projection/history tx + stale revision
  +-- workspace completion replay fencing
  +-- harness/session uniqueness
  +-- capability hash/expiry/revocation/scope
        |
        v
Service/API/CLI
  +-- Human RBAC + actor audit
  +-- workload bearer-only + no arbitrary IDs
  +-- stable HTTP/CLI errors + JSON limits
  +-- cwd-composed context + secret exclusions
        |
        v
Runner/E2E
  +-- PATH/endpoint/code env merge
  +-- no prompt/event/log/database code leakage
  +-- workspace-ready recovery + single Session
  +-- fixture linctl -> edit/test -> fixture gh -> review status
  +-- failed Session != Task state
```

Coverage additions required in tasks：shared unit、RdbProvider contract、SQLite integration、optional PostgreSQL contract、service unit、route tests、CLI tests、runner worker tests、HTTP/Runner E2E、Task detail runtime/browser test。未发现 silent + unhandled + untested critical gap after plan corrections。

## Failure Modes

| Codepath | Production failure | Test | Handling/user signal |
| --- | --- | --- | --- |
| Assign transaction | concurrent pending claims | race test | one success; stable conflict/replay |
| post-commit setup | Git remote/runtime unavailable | service/E2E | durable Harness diagnostic; Task remains in_progress |
| ready continuation | launch throws after ready commit | replay E2E | same report retries continuation |
| capability claim | response lost/lease reclaimed | lease test | new code rotates; old code invalid |
| workload auth | expired/revoked/foreign scope | API contract | uniform fail-closed error, no context |
| status update | stale revision/timeout replay | service/API/CLI | conflict or same transition result |
| Provider child | CLI bin missing/PATH wrong | runner test | Provider can report failure; deployment test fails |
| external CLI | linctl/gh unauthenticated | fixture E2E | Agent reports blocked; no fallback |
| Agent exits silently | no final status call | E2E | Task intentionally remains in_progress |
| Human review | note contains false URL/tests | presentation test | displayed as unverified Agent report |

**Critical gaps:** 0

## Performance Review

- [x] Assign/status use short Prisma transactions with no remote/network I/O.
- [x] `TaskStatusTransition(taskId,revision)` and `(taskId,idempotencyKey)` unique indexes support conflict/replay paths.
- [x] `SessionDispatchLease.executionCodeHash` indexed unique lookup avoids scans.
- [x] status history is limit bounded; Task list reads projection only.
- [x] randomBytes/hash work is constant small input and not a throughput concern for single-node MVP.
- [x] no new poller, queue, event bus or unbounded retry loop。

## What Already Exists

| Existing | Reuse decision |
| --- | --- |
| `TaskWorkspaceService.setup/resolveSessionAttachment` | reused; no second Workspace |
| Workspace Runner claim/report loop | reused; completion becomes safe replay trigger |
| `SessionService.launch` + initial events | reused through frozen Harness launch variant |
| `RuntimeSessionService.claim` + lease token hashing | reused for execution capability lifecycle |
| Provider command environment merge | reused for endpoint/code/PATH injection |
| Human auth/RBAC subject with user ID | reused for Human transition actor |
| Task detail Workspace/Sessions panels | extended; no new top-level Harness application |

## NOT in Scope

- Full Harness orchestration/heartbeat/subscriptions/multi-Session: needs separate state-machine specification。
- Retry/reopen/second attempt: v1 terminal semantics and one-Harness uniqueness intentionally avoid undefined policies。
- Generic artifact and delivery verification: Mystra currently cannot validate it。
- Linear/GitHub proxy/fallback: would change credential and Integration boundaries。
- Standalone CLI release channel: Runner-bundled self-use delivery is sufficient for MVP。
- Workflow/Recipe/Skill selection, triage, review automation and quality gates: not required for accepted journey。

## Worktree Parallelization

Sequential implementation, no safe parallelization opportunity. Shared schemas/RDB contracts gate services; services gate both API and CLI; Runner claim schema gates environment handoff. Parallel worktrees would repeatedly touch `packages/shared` and control-plane DB modules and add merge risk without reducing critical path。

## Completion Summary

- Step 0: scope accepted as-is; every major surface is journey-critical。
- Architecture Review: 7 issues found, all incorporated into plan。
- Code Quality Review: 2 issues found, both resolved by shared policy and Harness-only prompt path。
- Test Review: diagram produced, 2 original gaps fixed, 0 remaining critical gaps。
- Performance Review: 0 unresolved issues。
- NOT in scope: written。
- What already exists: written。
- TODOS.md updates: 0 proposed；deferred product features already live in spec boundary。
- Failure modes: 0 critical gaps。
- Outside voice: skipped；current review is code-evidence-backed and product decisions are owner-approved。
- Parallelization: sequential, 0 parallel lanes。
- Lake Score: 9/9 recommendations use the complete recoverable option。

**Unresolved decisions:** 0

**Verdict:** CLEAR — proceed to `/speckit.tasks`。
