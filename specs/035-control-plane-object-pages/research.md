# 研究与基线判断

## Decision 1：以 main 与真实 CLI 为权威

- **Decision**: 使用 `main@bc50ac3`、`scripts/operator-cli.mjs` 和当前 API route
  作为用户旅程事实；`025-webui` 仅保留历史价值。
- **Rationale**: main 已移除 WorkflowProvider/blueprint/node，并新增 Issue 驱动的
  直接 Agent 执行、`waiting_for_review` 和 Operator CLI。
- **Alternatives considered**: 继续实现 025 的混合 dashboard；拒绝，因为会恢复已经
  被 main 删除的对象与叙述。

## Decision 2：Task 是 Job/Run 的操作员投影

- **Decision**: 页面和新 CLI 采用 Task 术语，底层继续使用 JobSnapshot。
- **Rationale**: 用户要求核心对象为 Task，但重新建表或状态机会制造第三套真相。
- **Alternatives considered**: 新建 Task persistence；拒绝。

## Decision 3：只增加读模型 API

- **Decision**: 增加 `/api/control-plane` 和 `/api/runners/:id`；Task 操作复用既有
  jobs API。
- **Rationale**: 当前缺少 overview 与 runner detail 的 canonical API；其他能力已经存在。
- **Alternatives considered**: 页面并行 fetch 后自行聚合；拒绝，因为 CLI 无法共享同一聚合。

## Decision 4：Plugin 使用 browser handoff

- **Decision**: 在既有 `plugins/mystra` 增加打开页面的 skill。
- **Rationale**: Codex Plugin 可以封装技能与 MCP；persistent browser surface 的正确
  机制是打开明确 URL，而不是虚构原生 tab placement。
- **Alternatives considered**: MCP App 或 `.app.json`；拒绝，因为用户要求 internal browser。

## GitNexus Evidence

- `Page`、`RootLayout`: LOW，零上游调用。
- CLI `usage`、`parseArgs`、`formatSuccess`、`executeCommand`: LOW，只直接影响 `run`。
- 不修改 Runner claim、RdbProvider、SqliteRdbProvider 或 Run state symbols。
