# 工程评审：Session 发起、多消息执行与状态回报

**评审日期**: 2026-08-10
**状态**: 通过
**置信度**: 高

## Step 0: Scope Challenge

049 必然跨 shared contract、RDB、control-plane service、runner protocol 与 Provider adapter，超过 8 个文件。这里不是把简单功能做复杂，而是同一个 durable execution transaction 的完整闭环。缩成只写 Session 表会留下不可执行的假接口，因此保留完整范围，但不引入新的 package、消息队列、capacity subsystem 或 ACP transport。

### What already exists

| 现有能力 | 结论 |
| --- | --- |
| feature 048 `resolveSessionAttachment` | 直接复用；049 不重算 repository/Issue policy，不创建第二种 Workspace。 |
| feature 044 Runtime + Provider discovery + liveness | 直接复用；launch 用 derived liveness，claim 再校验 runner/runtime/provider。 |
| feature 046 `resolveActiveAgent` | 直接复用并冻结 revision/system prompt snapshot。 |
| `RdbProvider` + dual Prisma clients | 在现有边界新增原子 Session operations，不创建 `packages/db`。 |
| `@mystra/agent-adapters` Codex/Copilot command builders | 直接扩展为 session-capable adapter；不在 runner 内复制 provider command policy。 |
| runner workspace loop + safe opaque ref mapping | 复用轮询、重试和 safe-root 模式；Session loop 不接受绝对路径。 |
| legacy shared Session/Runner schemas | 直接替换并更新调用者/测试；pre-0.1 不保留 alias、dual read 或 fallback。 |

## Architecture Review

### GitNexus blast radius

- `RdbProvider`: CRITICAL, 71 impacted symbols, 20 direct dependants, 41 processes. Mitigation: additive Session methods only plus complete provider contract regression.
- `PrismaRdbProvider`: CRITICAL, 113 impacted symbols, 2 direct dependants, 47 processes. Mitigation: preserve all existing methods and verify all control-plane tests.
- `sessionStateSchema`, `sessionEventSchema`, `ProviderAdapter`, `runDaemon`, `resolveSessionAttachment`: LOW. `ProviderAdapter` is a lower-bound interface result, so concrete adapter tests remain mandatory.

1. **[P0, 10/10] 初始事件计数矛盾**：spec 同时要求三个初始事件和 `workspace_attached`。已修为 Session + 四个初始事件同事务。
2. **[P1, 10/10] 错误模块路径**：计划引用不存在的 `packages/db`。已改为真实 `apps/control-plane/src/lib/db` 边界。
3. **[P1, 9/10] Provider session 能力缺口**：现有 adapter 只构造一次性进程命令。方案是在 `@mystra/agent-adapters` 增加 ProviderSessionAdapter/Handle，并实现 Codex/Copilot CLI continuation；runner 只负责进程生命周期和事件映射。
4. **[P1, 9/10] 双 Session 合同风险**：shared 仍有 003/038 的 terminal single-run Session/Runner schema。049 必须直接替换这些 schema 与死调用者，不能并列新增 `sessions/*` 后继续导出旧合同。
5. **[P1, 9/10] launch TOCTOU**：service 在事务前读取 Runtime/Provider/Agent/Task/Project/Workspace，RDB create transaction 必须按 id/revision/status/attachment identity 重验 persisted facts；ephemeral liveness 在 launch 与 claim 各验证一次。
6. **[P1, 9/10] claim/lease 语义**：lease 仅 ownership/auth。runner 可并发启动 Session worker，worker 在 response 完成后从 active execution set 移除，但可继续轮询同 Session 的后续消息；没有 slot/count 字段。
7. **[P2, 8/10] enabled Provider 与 ACP 范围漂移**：当前 enabled set 是 Codex/Copilot。049 实现这两个 concrete adapter，保留 provider-neutral boundary；ACP concrete transport deferred。

## Code Quality Review

1. Session state transition 与 event projection 只实现一次，放在 shared reducer；service 与 Prisma provider 不各写一套 switch。
2. event payload 使用 kind-discriminated Zod schemas，metadata 仍限制为 JSON object；禁止 generic stdout/stderr event。
3. runner 只构造共享 typed payload；control-plane ingest 再执行共享 schema、敏感值、长度与 binary 限制，违规 payload fail closed 或转 Artifact reference。
4. `launchPayload` 以规范化 JSON 保存在内部 persistence input，用于 sessionId replay 比较；不增加 fingerprint/hash 固定列。
5. Runtime routes 使用 runner identity/runtime claim headers；event ingest 还要求 Team、runner 与 lease token 同时匹配。operator Session authorization 不与 runner auth 混用。

## Test Review

```text
CODE PATH COVERAGE PLAN
=======================
launch
  -> validate Team/Task/Project/Runtime/Provider/Agent/Workspace
     -> [TEST] missing/cross-Team/inactive/offline/mismatch
  -> assemble prompt with escaped untrusted context
     -> [TEST] fixed order, injection delimiters, frozen snapshot
  -> create Session + 4 events transaction
     -> [TEST] happy path, rollback, 20-way same/different replay

sendMessage
  -> ready/new_message interrupted
     -> [TEST] accepted, same replay, conflicting replay
  -> busy/terminal/wrong Team
     -> [TEST] stable rejection and zero partial writes

runner claim
  -> resolve runner/runtime/provider + atomic lease
     -> [TEST] correct Runtime, foreign Runtime, race, expiry
  -> first/pending message delivery
     -> [TEST] first message needs no second operator call

event ingest
  -> schema/size/redaction/lease/source sequence
     -> [TEST] accepted, replay, gap, stale token, oversized/secret/binary
  -> reducer + projection + append transaction
     -> [TEST] every legal/illegal transition, rollback, 10k events

provider execution
  -> Codex/Copilot start/continue + process event mapping
     -> [TEST] fake process and command contract
  -> response complete/cancel/fail
     -> [TEST] ready release, closed/failed terminal, provider id on lease only

USER FLOW COVERAGE
==================
Task Workspace ready -> launch -> first response -> ready -> 3 messages -> ready
  -> [E2E] fake Provider, real SQLite, runner HTTP protocol
interrupt -> resume_message/new_message -> response
  -> [E2E] both continuation modes
handoff -> accepted/completed; close; Runtime loss
  -> [E2E] state and event history
```

共享 reducer、service、RDB contract、runner 与真实 SQLite/HTTP E2E 均有 positive/negative coverage；未用虚构的 branch 数量替代实际测试证据。

## Failure Modes

| Failure | Test | Handling | Caller outcome |
| --- | --- | --- | --- |
| RDB fails after Session insert | transaction rollback | normalized RDB error | explicit failure, no partial Session |
| duplicate sessionId/messageId race | 20-way race | unique constraint + payload compare | replay or stable conflict |
| Runtime goes offline after launch | liveness/lease test | claim refusal then lease/loss failure event | Session failed with code |
| provider process cannot start | adapter fake | response_failed/session.failed event | durable explicit failure |
| duplicate/gapped source sequence | replay/gap tests | idempotent replay or conflict | explicit 409, no projection drift |
| event contains secret/oversize/binary | schema tests | redact or reject; Artifact ref required | explicit validation failure |
| workspace ref resolves missing directory | runner integration | 048 unavailable path + session failure | explicit `workspace_missing` |
| runner crashes after Provider side effect before report | lease expiry/runtime loss E2E | lease 到期后按 Runtime liveness 收敛；不声称跨进程 exactly-once | Session 明确失败，不自动重放不确定副作用 |

## Performance Review

1. Claim uses indexed `(runtimeId,state,createdAt,id)` ordering and compare-and-set update, not a full table scan.
2. Event append batch is capped at 100 events and 256 KiB; one transaction allocates contiguous global sequences and updates one projection.
3. Session event reads use `(sessionId,globalSequence)` keyset pagination, never offset pagination.
4. Launch/read paths fetch bounded single rows; no per-event Agent/Task/Project lookups.
5. 10k-event test verifies ordering and replay correctness. Event archival remains out of scope.

## Parallelization

Sequential implementation is preferred because shared contracts gate RDB, services, routes and runner. After contracts land, RDB tests and adapter tests can be authored in parallel conceptually, but this worktree uses one implementation lane to avoid schema/export conflicts.

## NOT in scope

- Project-only/standalone Workspace preparation.
- Runtime capacity, slot, quota or scheduler policy.
- ACP concrete transport and hosted remote agents.
- Operator Web/CLI/MCP surfaces, owned by 050.
- Global event feeds, stdout/stderr logs, search, archive/export and cross-Runtime migration.

## Completion Summary

- Verification: shared 139、agent-adapters 9、control-plane 326、runner 31 tests passed；四个 workspace packages recursive typecheck passed。
- Persistence: SQLite/PostgreSQL Prisma validate + generate passed；real PostgreSQL/Supabase connectivity 未提供，因此没有虚构运行证据。
- Runtime evidence: real migrated-SQLite + local HTTP E2E covers first message, two continuations, resume/new-message interruption, handoff, duplicate report, close, and offline Runtime loss.
- Code intelligence: fresh GitNexus index completed；detect-changes reports 37 files / 122 symbols / 4 affected flows, medium risk, confined to expected Session/RDB execution surfaces.

- Step 0: scope accepted as-is, with ACP transport removed from enabled-provider implementation.
- Architecture Review: 7 issues found, all resolved in plan/spec.
- Code Quality Review: 5 rules fixed in the execution plan.
- Test Review: diagram produced；shared、service、RDB、runner 与 SQLite/HTTP E2E 已覆盖关键 positive/negative paths。
- Performance Review: 5 controls required.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0, all deferred items already have explicit owner/scope.
- Failure modes: crash-after-side-effect 明确按 at-least-once 边界失败收敛，不伪造 exactly-once 保证。
- Outside voice: skipped because local Codex executable is unavailable; repository and official Provider docs were inspected directly.
- Parallelization: 1 sequential lane.
- Lake Score: 10/10 complete option selected.
