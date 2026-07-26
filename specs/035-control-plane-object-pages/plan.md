# 实现计划：Control Plane Object Pages

## Technical Context

- TypeScript 5.9、Node 24、Next.js 16 App Router、React 19、Vitest 4。
- 现有 SQLite/RdbProvider、JobSnapshot、PublicRunnerSession 不变。
- UI 通过 route handlers 访问 canonical API。
- Codex Plugin 复用 `plugins/mystra`，增加 browser handoff skill。

## Constitution Check

- 不新增 MVP 排除项：PASS。
- API/CLI/UI 同源：PASS。
- 不新增持久化或 workflow abstraction：PASS。
- Plugin 可移除且不是执行依赖：PASS。
- 不调用 Linear：PASS。

## Architecture

```text
Codex chat
  -> Mystra Plugin skill
    -> internal browser URL
      -> Next.js object pages
        -> canonical API
          -> existing RdbProvider

Operator CLI
  -> same canonical API
```

## Implementation Slices

1. 新增 Control Plane projection 与 Runner detail route，并添加 route tests。
2. 扩展 Operator CLI 的对象命名与读/取消操作，并添加 injected-fetch tests。
3. 建立共享 AppShell、类型、格式化与数据状态组件。
4. 实现 overview、Runner list/detail、Task list/detail。
5. 更新 `plugins/mystra` manifest，增加打开 Web UI skill 与验证脚本。
6. 使用临时 SQLite fixture 运行 CLI 与浏览器同旅程验收。

## Engineering Review

- **Risk**: Task 术语与 Job/Run API 名称混淆。
  **Mitigation**: 契约明确 Task 是投影，不改 API 路径或持久化。
- **Risk**: overview 在客户端多次请求后与 CLI 计数漂移。
  **Mitigation**: 单一 `/api/control-plane` 聚合。
- **Risk**: Runner detail 需要新 DB 方法。
  **Mitigation**: 通过现有 `listRunners()` 读取，不改 provider interface。
- **Risk**: 旧 Web UI staged/untracked 资产混入提交。
  **Mitigation**: 只 stage 035、运行代码与 Plugin 精确文件。

## Verification

- API/CLI focused tests。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- Plugin validator。
- 浏览器：五个路由、console、network、keyboard、320/768/1024/1440。
- CLI 与 Web 使用同一临时数据库逐项对照。
- GitNexus `detect_changes({scope:"compare", base_ref:"main"})`。
