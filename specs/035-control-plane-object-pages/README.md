# 035 Control Plane Object Pages

本功能以 `main@bc50ac3` 的 Issue → Job/Run → Runner → Review 模型为权威，
替换 `025-webui` 中已经过时的用户旅程设计。

评审入口：

- [功能规格](./spec.md)
- [交互原型](./mockups/index.html)
- [页面/API/CLI 契约](./contracts/object-surfaces.md)
- [实现计划](./plan.md)
- [验证手册](./quickstart.md)

核心对象只有三个：

1. Control Plane：单一概览页；
2. Runner：列表与详情页；
3. Task：列表与详情页，底层复用现有 Job/Run。

Linear Integration 不是本功能的测试依赖。本功能不会读取或修改远端 Linear 数据。

## Completion Evidence

- API/CLI focused suite: 26 tests passed.
- Repository suite: 321 tests passed.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
- Control Plane, Runner list/detail, Task list/detail, and Task cancel were
  verified against an isolated SQLite database through both Web and CLI.
- Codex Plugin handoff returned the exact internal-browser Task URL.
- Browser validation covered real network responses, keyboard Escape handling,
  and a 320 px layout with no horizontal overflow.
- GitNexus staged change detection covered 37 files and 28 affected flows; the
  `CRITICAL` breadth result was reviewed across layout, resource refresh, API,
  and CLI dispatch paths.
- No Linear request was made during validation.
