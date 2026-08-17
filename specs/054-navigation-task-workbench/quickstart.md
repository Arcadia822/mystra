---
title: "Quickstart: 验证主导航与 Task 工作台"
taco_scope: tasks
---

## 基线

```bash
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm typecheck
pnpm lint
pnpm test
```

实现前已知基线：Spec Prototype 有 3 个失败断言（旧 `.taskComposer` selector、旧 footer height、旧 Create Session fields）。实现第一 slice 必须先把这些测试与批准后的 prototype 合同对齐。

2026-08-14 pre-development review evidence：Spec Prototype typecheck 通过；054 Navigation Task Workbench targeted tests 7/7 通过；完整 Spec Prototype tests 34/37 通过，失败项仍仅为上述 3 个已记录基线断言。Metadata 合同变更未引入新失败。

## Focused verification

```bash
pnpm --filter @mystra/shared test
pnpm --filter @mystra/ui test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/spec-prototype test
pnpm audit:task-session-terminology
```

## Browser journeys

1. 根入口在 053 缺失时只显示 Overview placeholder，不显示 New Task page。
2. sidebar 展开/收起/320px 下 New Task 与 Search 各只有一个可聚焦实例。
3. Tasks Table/Kanban 在相同 filters 下拥有相同 Task IDs；load more 保持条件。
4. provider 正常/超时/不可用时，Project/Issue external identifiers 均稳定且 provider requests 不随 rows 增长。
5. New Task 成功/validation/API error/double submit；`/new` 不再提供页面。
6. Task detail New Session 成功/precondition/error/close，Task/TaskExecutionAttempt 状态无副作用。

## Completion gates

- SQLite/PostgreSQL schema parity 与 RdbProvider contracts 全绿。
- `Task.metadata` 在 shared Task、双 Prisma schema、create/update/list/detail API 和前端 Task model 中保持同一 JSON-object 合同；Task 外 `labels` 与 TaskLabel/ordinal/normalized columns 为 0。
- Task object、shared schema/type、API、RDB、双 Prisma schema、CLI 与 UI 统一使用 `status`；current code 中 Task `productionStatus`、`production_status`、`TaskProductionStatus`、`taskProductionStatusSchema` 及兼容 alias 为 0。
- TaskExecutionAttempt 仅作为 Start/Workspace/首个 Autopilot Session 链路的 internal coordination record；主导航、Tasks workbench、Task detail UI、TaskWorkbenchItem 与用户 create/update contract 中 TaskExecutionAttempt 暴露数量为 0。
- Metadata presentation order 只由前端处理；query-time case-insensitive match 在 SQLite/PostgreSQL parity fixtures 中通过。
- `waiting_for_review` 在 Task contract/CLI/prompt/UI/tests/docs 的 current surface 中为 0。
- production/prototype 都只从 `@mystra/ui` 消费标准 components/styles。
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全绿。
- 054 Taco 已在 owner review 后进入 implementation；完成后再次刷新并保留全部 review threads。

## Implementation evidence — 2026-08-17

### Static and automated gates

- `pnpm typecheck`：通过。
- `pnpm lint`：通过。
- `pnpm test`：136 个 test files 通过、1 个 test file 跳过；646 个 tests 通过、21 个 tests 跳过。
- `pnpm build`：通过；Control Plane production route manifest 不包含 `/new`。
- Focused suites：Shared 153/153、UI 30/30、Control Plane 380/380（另 21 skipped）、Spec Prototype 37/37、Agent adapters 9/9、Agent CLI 5/5、Runner daemon 32/32。
- `pnpm audit:task-session-terminology`：通过，检查 591 个 current files。
- `git diff --check`：通过。
- SQLite/PostgreSQL Prisma schema validate/generate、schema parity、RdbProvider contracts 与 10k Task performance assertion：通过；10k query gate `< 500ms`。

### Browser acceptance

为避免破坏 owner 的旧本地数据库，浏览器验收使用副本 `/tmp/mystra-spec054-browser.UUuPjG/mystra.db`；原数据库只读检查后未修改。

- 根入口 HTTP 200，title 为 `Mystra`，显示 053 replacement seam 的 Overview placeholder。
- 1440/1024/768/320px 下 expanded/collapsed shell 均只有一个可见 New Task 与一个 Search；320px 页面 `scrollWidth === innerWidth`。
- New Task、Search、Create Session 的 Escape/backdrop/Close 均关闭并把焦点还给触发器；显式 Escape handler 修复后复测通过。
- Tasks 初始页 50 条，第二页累计 100 条，第三页累计 101 条且 Load more 消失；Table/Kanban 使用相同 101 个 Task ID。
- Kanban 五列计数为 pending 22、in_progress 20、blocked 20、done 20、canceled 19；列表请求均 HTTP 200，观察值约 5–240ms，低于 500ms gate。
- Task detail Main 只显示 Sessions；Right Panel 显示 repository external ID、Issue identifier、Task metadata 与 status history；完整 Session UUID 可见，panel 可收起/恢复。
- Task detail 320px 页面无横向溢出；Sessions 列表保留自己的内部横向 viewport，不扩张页面。
- 手动 New Session 成功后导航到 canonical Session；数据库证据为 Session 1→2、TaskExecutionAttempt 0→0、Task.status 保持 pending、Task.metadata 保持 `{}`。
- Workspace not ready 时显示明确 inline error、禁用 Provider/Create，并可恢复关闭；New Task 成功只创建一个 pending Task，metadata 默认 `{}`。
- 应用 console 无错误；浏览器工具自身一次 Statsig timeout 不属于应用页面日志。
