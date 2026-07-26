# 实现计划：Project Object Pages

## Technical Context

- TypeScript 5.9、Node 24、Next.js 16 App Router、React 19、Vitest 4。
- 复用现有 `Project` / `ProjectRuntimeConfig`、SQLite/RdbProvider 和 Project route handlers。
- Web 页面通过 canonical API 读取；CLI 已通过同一 API 实现 `projects list/inspect`。

## Constitution Check

- Web API 是 canonical 边界：PASS。
- CLI 与 UI 同源：PASS。
- 不新增 persistence、workflow 或 Integration abstraction：PASS。
- 不调用 Linear/GitHub Issue：PASS。
- 保留无关工作区改动：PASS。

## Architecture

```text
Project list page ──────> GET /api/projects ───────┐
Project detail page ────> GET /api/projects/:slug ├─> existing RdbProvider
Operator CLI projects ──> same canonical API ─────┘

Tasks page ──────────────> GET /api/jobs
                         (no Integration Issue request)
```

## Architecture Decisions

1. **只补 Web 投影**：Project API、CLI 和数据库能力已经存在，不修改它们。
2. **详情只读**：与当前 CLI `projects inspect` 对齐；不顺带暴露 create/edit/archive。
3. **删除通用 Issue 面板**：不同 Issue Provider 的浏览与分派逻辑留给独立 Integration 功能。
4. **不读取 secret value**：只展示 Project response 中已有的 reference metadata。
5. **复用现有 UI primitives**：AppShell、data table、definition list、状态组件和 token 不分叉。

## Implementation Slices

1. Project 页面直接使用 `@mystra/shared` 导出的 `Project` type。
2. 增加 Projects 主导航、路由标题和 responsive list grid。
3. 实现 Project list/detail 页面。
4. 从 Tasks 删除 Issue dispatch 面板、引用和相关文案。
5. 使用现有 API/CLI tests、全仓 gates 与真实浏览器完成验收。

## Engineering Review

### Architecture

- **Finding**: 不需要新增 API、CLI 或 persistence。
  **Disposition**: 仅新增 UI consumers，避免第二套 Project contract。
- **Finding**: control-plane 的本地 `Project` interface 字段不完整且只服务于待删除面板。
  **Disposition**: 页面直接 type-import shared `Project`，删除本地重复 type。
- **Finding**: 删除 `IssueDispatchPanel` 会使其文件成为确定的 dead code。
  **Disposition**: 与 Tasks 引用一起删除；不保留兼容 shim。

### Data Flow

- `/projects` 单次读取 active Projects；详情按 URL slug 读取一个 Project。
- 页面不自行聚合远端 Issue、Runner 或 Task 数据。
- Project API 错误通过现有 `useResource` 进入统一 error state。

### Risk

- **Low**: runtime config 存在空数组和可选字段。
  **Mitigation**: 所有集合都有显式 empty 表示，不假设至少一个元素。
- **Low**: repo、image、mount target 可能很长。
  **Mitigation**: 复用 overflow-wrap 与 responsive 单列布局。
- **Low**: secret reference 可能被误当作 secret value。
  **Mitigation**: 只显示 name/mode，不发起任何 secret 读取。

### Test Architecture

```text
Existing route/CLI contract tests
              │
              ▼
     lint + typecheck + test
              │
              ▼
          Next build
              │
              ▼
temporary SQLite fixture
      ├── CLI projects list/inspect
      └── browser list/detail/tasks
              │
              ▼
console + network + responsive evidence
```

### Performance

- Project list 使用现有无分页 endpoint；本次不扩大结果集或增加 N+1 请求。
- 详情只发一个 Project 请求。
- 不增加 client polling；Project 配置不是高频状态面。

### Review Result

**PASS**：范围明确、没有 contract migration、GitNexus pre-change impact 均为 LOW。

## Verification

- Project API/CLI focused tests。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- CLI `projects list/inspect` 与页面字段对照。
- 浏览器 list/detail/tasks、console、network、keyboard、320/768/1024/1440。
- GitNexus `detect_changes` staged review。
