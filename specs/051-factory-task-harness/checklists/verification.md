# Verification：051 Factory Task Harness

**Verdict**: PASS WITH DECLARED ENVIRONMENTAL SKIPS
**Date**: 2026-08-11

## Delivered contract

- Task 拥有独立、带 revision 的 productionStatus 与 append-only transition history。
- Assign/Start 原子创建 in_progress transition 与 frozen Harness；Workspace ready continuation 幂等启动唯一 Harness Session。
- `mystra-agent` 仅凭 attempt-scoped execution code 提供 whoami、context 和 allowlisted status transition，不接受任意 Task ID。
- Runtime claim-time 签发 code，RDB 仅保存 SHA-256 hash/expiry；terminal Task 吊销 capability；Provider 输出中的 code 被清理为 `[REDACTED]`。
- Agent 使用宿主机本地 `linctl`/`gh`；PR 与自测 note 明确为 `verified:false`，Mystra 不验证。

## Automated verification

- `corepack pnpm --filter @mystra/control-plane db:generate`: PASS，双 Prisma client 已生成。
- `corepack pnpm --filter @mystra/control-plane db:validate`: PASS，SQLite 与 PostgreSQL schema 均有效。
- `corepack pnpm test`: PASS：shared 147、agent-adapters 9、agent-cli 5、control-plane 350、runner-daemon 31；control-plane 另有 19 项环境条件测试跳过。
- `corepack pnpm typecheck`: PASS。
- `corepack pnpm build`: PASS，Next.js production build 包含新的 production 与 agent-execution routes。
- provider contracts 覆盖 20-way optimistic revision race、idempotent replay、Harness uniqueness、capability expiry/revocation 和 Workspace completion replay。

## Runtime evidence

- 临时 SQLite 数据库迁移全部应用后，通过真实 HTTP 完成 register → Runtime/Agent/Project/Task → Assign → replay → production read → Human cancel。
- Assign replay 返回同一 transition/Harness 且 `created:false`；cancel 进入 revision 3，数据库确认 capability revocation 与两条 append-only transition。
- assign、replay、production read 和 cancel response 均携带 `Cache-Control: no-store`。
- 真实浏览器验证 Task detail 的 production panel、Harness、latest Session、current actor、history 和 canceled sidebar icon；交互前后 console 均无 error/warning。
- agent-cli journey 使用临时本地 fixture `linctl`/`gh` 完成 issue read、PR create/report，并断言只访问 scoped Control Plane URLs。

## Review evidence

- GitNexus fresh index：11,110 nodes、18,483 edges、207 clusters、300 flows；final detect_changes 映射 174 个 changed symbols、11 条 affected processes。
- aggregate change detection 对中心 RDB/provider 改动报告 HIGH；逐符号 impact 已在编辑前审查。高风险来自预期的跨层生产合同，而不是未解释的旁路。
- project-local review 已修正：assignment replay 对 mutable dependencies 的错误重验、Human auth no-store、UI retry idempotency、history ordering/current actor、execution code provider-output 泄漏、Harness prompt mutable context 重复、expiry 合同漂移与 capability scope 校验缺口。

## Declared skips

- 环境未配置 `MYSTRA_TEST_POSTGRES_URL`，未执行 PostgreSQL runtime connectivity；双 schema validate 不能替代该证据。
- 未使用真实 Linear Issue 或创建真实 GitHub PR，因为本次验证没有指定外部目标，也未授权外部副作用。宿主机 `linctl`/`gh` 是 Agent-owned delivery boundary，已用真实进程 fixture journey 验证组合方式。
- 没有实现 PR/自测验真、Harness heartbeat/event subscription、多 Session 或通用 Artifact；这些均为 051 明确排除项。
