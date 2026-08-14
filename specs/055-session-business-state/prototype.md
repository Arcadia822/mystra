---
title: "Prototype：Session 四态业务状态"
taco_scope: spec
---

## 入口

- 运行：`pnpm dev:prototype`
- Route：<http://localhost:3010/055-session-business-state>
- 通用起点：<http://localhost:3010/starter>
- Feature composition：`apps/spec-prototype/app/_components/session-business-state-prototype.tsx`
- Transition model：`apps/spec-prototype/app/_components/session-business-state-model.ts`
- 可复用 shell：`apps/spec-prototype/app/_components/prototype-shell.tsx`

## UX Intent

- **Experience problem**：现有 Session 状态把 Runtime/Provider 管线阶段暴露为产品语言，用户必须理解 `queued`、`dispatched`、`message_pending`、`ready` 与两个 interruption 状态之间的实现差异。
- **Intent**：让操作者只判断 Session 是否尚未离开首次初始化、正在推进、需要外部介入或当前工作已结束。
- **Affected surfaces**：Session 列表状态标签、Session detail 当前状态、筛选项，以及依赖同一公开合同的 API/CLI/MCP 消费者。Prototype 只演示一个 Session detail review surface，不模拟所有生产入口。
- **Reuse**：页面直接使用 `PrototypeShell`，并从生产与 prototype 共同依赖的 `@mystra/ui` 导入 `UiSurface`、`UiSurfaceHeader`、`UiSurfaceBody` 与 `UiButton`。没有复制 production DOM、SVG、theme 或 popup 行为。
- **Responsive and accessibility**：状态转换使用原生 button；当前状态通过文本与 `aria-live` 表达，不仅依赖颜色；320px 下转换 action 自动纵向排列，页面保留 8px shell inset 和 8px section gap。
- **Risk**：`DONE` 不是终态，若文案仍使用 Completed/Closed，操作者会误认为不能继续；`INTERRUPTED` 合并多种原因后必须继续从事件事实提供原因。

## 覆盖状态与交互

- 初始显示 `INIT`，可进入 `RUNNING`、`INTERRUPTED` 或 `DONE`。
- 一旦离开 `INIT`，所有转换 action 中都不再出现 `INIT`。
- `RUNNING`、`INTERRUPTED`、`DONE` 可通过可见 action 两两转换。
- 当前状态区解释四态业务语义，并明确 `DONE` 可继续。
- “Internal execution facts” 区域显示 `queued`、`dispatched`、`message_pending`，但明确标记为 internal only / not Session state。
- Transition history 是 prototype-local review state，只用于观察交互，不代表新的持久化模型。

## Mock 与边界

- 使用单个固定 Session fixture，不调用 Mystra API，不写数据库，不修改 Task/Harness/Workspace/Runtime。
- Prototype 不模拟失败、lease、Provider 启动或 event ingestion；这些只以内部事实标签说明边界。
- 页面不新增可生产复用的 Session status primitive；四态视觉映射仍需在 planning 中决定是否进入 `packages/ui`。
- Prototype 证明共享 shell/theme/surface/action 的代码级复用和四态迁移可理解性，不证明生产合同已经修改。

## 验证

- Transition model test 穷举 `INIT` 出口、禁止返回 `INIT`、其余三态两两迁移。
- Source contract test 确认 composition 使用共享 shell 与 UI primitives，并把三个旧启动状态限制在 internal-facts 区域。
- `@mystra/spec-prototype` typecheck 与 build 验证 route 可编译。
- 浏览器验收应覆盖键盘操作、当前状态 announcement，以及 320/768/1024/1440px 宽度。

