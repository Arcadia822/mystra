# Verification Checklist: 标准执行提示词与可选 Agent 上下文

**Feature**: [spec.md](../spec.md)
**Created**: 2026-08-12

## Baseline

- [x] 记录Node/pnpm版本
- [x] 记录051 shared/control-plane/agent-cli/runner focused baseline
- [x] 区分已有失败与052引入失败

Evidence (2026-08-12 11:40 CST):

- Runtime: Node `24.14.0`; pnpm由Corepack使用仓库固定版本。
- Command: `corepack pnpm exec vitest run packages/shared/src/harness.test.ts apps/control-plane/src/lib/tasks/task-production-service.test.ts apps/control-plane/src/lib/sessions/session-service.test.ts apps/control-plane/src/lib/tasks/agent-execution-service.test.ts apps/runner-daemon/src/session/session-worker.test.ts packages/agent-cli/src/cli.test.ts packages/agent-cli/src/journey.test.ts`
- Result: 7 test files passed, 24 tests passed, 0 failed。该结果是052实现前的未提交051工作树baseline。

## Contract

- [x] 100个无Agent attempt全部为明确null snapshot且无default/sentinel数据
- [x] 100个selected Agent Session全部包含Standard Prompt和正确revision context
- [x] omitted/null同intent；empty/foreign/archived拒绝
- [x] Harness、Session、workload identity与prompt evidence optional snapshot一致
- [x] API、operator CLI、MCP、Web和Runner使用同一optional语义

Evidence (2026-08-12 12:27 CST):

- SQLite `RdbProvider` contract: 20 tests passed；包含100-case no-Agent matrix、100-case selected-Agent matrix、replay、null→UUID conflict及Agent更新后的snapshot冻结。
- Standard Prompt version: `sha256:2afef43c1b5c60921d70f939bc4e4acc02099ab088a7f2a69a0205af8fff380a`。
- Review regression: Optional Agent system prompt包含 `<`、`>`、`&` 时先失败复现，修复后保持snapshot校验并转义delimiter-shaped文本。

## Static Gates

- [x] Prisma clients regenerated
- [x] SQLite/PostgreSQL schema parity passed
- [x] focused tests passed
- [x] `pnpm typecheck` passed
- [x] `pnpm test` passed
- [x] `pnpm build` passed
- [x] 052-scoped `git diff --check` passed
- [x] terminology/default Agent audit passed

Evidence:

- `corepack pnpm --filter @mystra/control-plane db:generate`: SQLite与PostgreSQL clients生成成功。
- `corepack pnpm typecheck`: 5/5 applicable workspaces passed。
- `corepack pnpm test`: shared 151、control-plane 361、agent-adapters 9、agent-cli 5、runner-daemon 31；合计557 tests passed，20 PostgreSQL-gated tests skipped。
- `corepack pnpm build`: shared、control-plane Next.js production build、agent-cli、agent-adapters、runner-daemon全部通过；route manifest包含 `/api/tasks/[id]/production/start`且不含旧assign route。
- `node scripts/audit-task-session-terminology.mjs`: 523 files inspected，passed。
- `git diff --check -- . ':(exclude)screenlog.0'`: passed。全工作树 `git diff --check`仅被owner已有 `screenlog.0:5954-5973` 的20行尾随空格阻断；052未修改该文件。

## Runtime Evidence

- [x] Isolated SQLite Control Plane service and Runner HTTP command/timestamp recorded
- [x] No-Agent Task/Harness/Session identities and prompt version asserted
- [x] Optional-Agent Task/Harness/Session identities, Agent revision and prompt version asserted
- [x] Idempotent replay verified without duplicate Harness/Session
- [x] Historical evidence unchanged after Agent update

Evidence (2026-08-12 12:25 CST):

- Command: `corepack pnpm --filter @mystra/control-plane exec vitest run src/lib/sessions/session-execution.e2e.test.ts`。
- Result: 3 tests passed。两条 canonical production Start journey分别使用 omitted Agent与显式active Agent；动态生成的Task/Harness/Session UUID在测试内断言关联一致，replay返回同一Harness/Session，HTTP claim/event ingest完成到`ready`。
- Standard-only journey断言Runner assignment含上述Standard Prompt且不含未选择Agent prompt；selected journey断言冻结Agent ID/name/revision/systemPrompt并包含相同Standard Prompt version。
- 未启动机器级LaunchAgent，也未调用真实Provider、`linctl`或`gh`；本验证使用本地fake Provider response，避免污染owner数据库、仓库分支或外部账号。

## Environment Boundaries

- [x] PostgreSQL contract explicitly marked unverified because `MYSTRA_TEST_POSTGRES_URL` is absent
- [x] No external `linctl`/`gh` credential or result verification claim was made

## Review

- [x] GitNexus detect_changes reviewed
- [x] Project-local code-review-and-quality completed
- [x] Spec View rendered and status refreshed

Evidence:

- Fresh CLI index: 9,290 nodes、16,525 edges、300 flows；`gitnexus detect-changes --repo mystra --scope all`报告71 files、166 symbols、22 affected flows、CRITICAL。该结果覆盖owner未提交的051+052组合工作树，不能单独归因于052；重点流程RDB contract、Task/Session API、Task detail与Runner链路均已纳入全量测试。
- MCP detect_changes在CLI重建后暴露LadybugDB storage version 42/40不兼容；使用同一fresh CLI index完成第二次detect-changes核验。
- 五轴review发现并修复1个required correctness问题：delimiter-shaped Optional Agent prompt会被安全转义却遭evidence refinement误拒绝。未发现未解决Critical/Important问题；无新增依赖、secret输出、N+1或无界查询。
- `render-spec-view.mjs`已刷新 `index.html`；status-report显示052 artifacts齐全、56/56 tasks complete；Spec-Kit doctor对052全部OK，仅报告既有042缺少plan/tasks的2条repo-wide note。
