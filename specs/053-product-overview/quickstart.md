# Quickstart：053 产品概览

## 目标

验证 Overview 只有一组五态数字和一个 Task-deduplicated attention 列表；时间范围按 Task `createdAt` 筛选 counts，Session attention 不改写 Task 状态。

## 前置 Gate

实施前先验证 canonical Task 状态已经是：

```text
pending in_progress blocked done canceled
```

若仍存在 `waiting_for_review` 或 Task `interrupted|failed`，停止 053 implementation，不添加 UI alias。

## Focused Verification

```bash
fnm use
corepack use pnpm@10.25.0
corepack pnpm --filter @mystra/control-plane db:generate

corepack pnpm --filter @mystra/shared exec vitest run src/overview.test.ts
corepack pnpm --filter @mystra/control-plane exec vitest run \
  src/lib/overview/overview-read-service.test.ts \
  app/api/overview/route.test.ts \
  app/_components/overview-page.test.tsx

corepack pnpm --filter @mystra/control-plane typecheck
```

RdbProvider contract 必须同时覆盖 SQLite；PostgreSQL 需要 `MYSTRA_TEST_POSTGRES_URL` 才能作为真实 runtime proof。

## Contract Cases

1. `createdAt == observedAt - 7d` 被 7d 纳入；更早 1ms 不纳入。
2. 同一 Task 多次历史转换，只按当前状态计一次。
3. `in_progress` Task 有 running + interrupted + failed Sessions：生产中 +1，attention 只一行。
4. done/canceled Task 的旧 failed Session 不触发 attention。
5. Task blocked 本身触发 attention，并显示为待接手。
6. 7d → 30d → all 只改变 counts，attention Task 集合不变。
7. unknown Task status 使 snapshot unavailable，不返回五个零。
8. cursor 跨 Team 使用返回 `overview_cursor_invalid`。

## Browser Acceptance

1. 顶部只有一组五卡，顺序：未执行、执行中、待接手、已完成、已取消。
2. 卡片只含 label + number；没有 subtitle、code、趋势或小字。
3. 默认 7 天；30 天/全部切换只更新数字。
4. attention 表格复用 054 基础 Table 的 stacked mode 与默认 Task row anatomy；一 Task 一行，混合 Session 状态不重复 Task。
5. 行点击只进入 `/tasks/{taskId}`。
6. 页面不存在 Runtime、当前生产、Projects 列表。
7. 320px 时五卡组横向滚动，顺序不变。
8. 页面没有 `Task 状态`、筛选规则、observed time、刷新按钮或 attention scope 说明文字。

## Static Checks

```bash
rg -n 'Runtime readiness|Current production|当前生产|Projects|projectSummaries|availableProviders' \
  specs/053-product-overview apps/control-plane/app/_components/overview* 

rg -n 'waiting_for_review|productionStatus.*interrupted|productionStatus.*failed' specs/053-product-overview
git diff --check -- specs/053-product-overview
```

预期：旧状态只出现在明确的 migration/blocker 说明中；删除的列表只出现在 out-of-scope/negative assertions 中。

## Taco Review

```bash
node .specify/extensions/taco/bin/taco.mjs pack \
  specs/053-product-overview \
  --project-root "$PWD" \
  --json

$speckit-taco-review specs/053-product-overview/053-product-overview.taco.html
```
