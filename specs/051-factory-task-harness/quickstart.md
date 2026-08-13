# Quickstart：Task Assign 到 Agent reported PR

## 前置条件

- Node `24.14.0`，Corepack pnpm `10.25.0`。
- Control Plane 与 host `mystra-runner` 可达；Runtime online 且报告 `codex` 或 `copilot` provider。
- host Runner 用户 PATH 中有可执行且已认证的 `linctl`、`gh` 和对应 Agent provider CLI。
- 已存在同 Team active Agent、Project-bound pending Task；Project repository/base branch 可准备 Workspace。

## 本地验证流程

1. 生成 Prisma clients 并准备数据库：

   ```bash
   corepack pnpm --filter @mystra/control-plane db:generate
   corepack pnpm db:migrate:dev
   ```

2. 启动 Control Plane 与 Runner：

   ```bash
   corepack pnpm dev:control-plane
   MYSTRA_RUNNER_ENDPOINT=http://127.0.0.1:3000 corepack pnpm dev:runner
   ```

3. 在 Task detail 选择 Agent、Runtime/provider 并执行 Assign/Start。预期：

   - Task 立即为 `in_progress`；
   - 出现一条 Human transition 和一个 Harness；
   - Workspace queued/preparing/ready；
   - ready 后出现且只出现一个 Session。

4. Runner claim 后，Provider workload 只获得：

   ```text
   MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000
   MYSTRA_EXECUTION_CODE=<redacted>
   ```

   以及 PATH 中的 `mystra-agent`。prompt 不包含 execution code。

5. workload bootstrap：

   ```bash
   mystra-agent whoami
   mystra-agent context get
   linctl issue get <identifier-from-context>
   # edit and test in current working directory
   gh pr create --fill
   mystra-agent task status get
   mystra-agent task status set waiting_for_review \
     --expected-revision 2 \
     --idempotency-key delivery-1 \
     --note "PR: https://github.com/example/repo/pull/1; tests: corepack pnpm test"
   ```

6. Human 在 Task detail 看见 `waiting_for_review` 与 “Agent reported; not verified by Mystra”，选择 done 或退回 in_progress。

## 必须观察到的隔离

- 手工把 Session 制造成 failed，Task 仍保持原 productionStatus。
- Task blocked/waiting_for_review 不改变 Session.state。
- 相同 status idempotency key 重放返回同一 transition；换 payload 返回冲突。
- 使用旧 revision、过期 code、其他 attempt code 或任意 Task ID 均失败。
- 数据库、prompt、SessionEvent 和普通 Runner logs 中检索不到 execution code 明文。
- fixture `linctl`/`gh` 失败只导致 Agent 自主报告 blocked；Mystra 不调用 Integration credential fallback。

## 验证命令

```bash
corepack pnpm --filter @mystra/shared test
corepack pnpm --filter @mystra/control-plane test
corepack pnpm --filter @mystra/agent-cli test
corepack pnpm --filter @mystra/runner-daemon test
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

真实 PostgreSQL/Supabase connectivity 仅在配置 `MYSTRA_TEST_POSTGRES_URL` 时验证；SQLite 结果不得被描述为 PostgreSQL runtime proof。

## 2026-08-11 收口证据

- 全仓测试通过：shared 147、agent-adapters 9、agent-cli 5、control-plane 350（另 19 项按环境跳过）、runner-daemon 31。
- 全仓 typecheck 与 production build 通过；SQLite/PostgreSQL Prisma schema 均通过 validate。
- 使用临时 SQLite 数据库完成真实 HTTP smoke：注册、Runtime/Agent/Project/Task 创建、Assign、相同 key 重放、production read、Human cancel 和 terminal capability revocation 均符合合同，相关 response 均为 `Cache-Control: no-store`。
- 使用浏览器完成 Task detail smoke：观察 in_progress、Harness/history/current actor，执行 Human cancel 后观察 canceled revision 与 sidebar productionStatus icon；控制台无 error/warning。
- fixture journey 实际执行本地 `linctl`/`gh` 替身并完成 scoped context/status/PR-report 流程；未对真实 Linear/GitHub 产生外部副作用。
- 当前环境未配置 `MYSTRA_TEST_POSTGRES_URL`，因此没有 PostgreSQL runtime connectivity 证据；这不影响双 schema 静态一致性结论。
