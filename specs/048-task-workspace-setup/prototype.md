# 原型：Project Default branch 与 Task Workspace Setup

## 入口

打开 [mockups/index.html](./mockups/index.html)。这是独立、无依赖的交互原型。

## 设计 Intake

- **目标用户**：管理 Project repository 配置、为 Task 准备执行目录的 Team 操作者。
- **首要行动**：读取 remote branches 并保存 Project Default branch；随后在 Task 上显式 Setup Workspace。
- **参考**：Mystra 当前 Project detail、Task detail 与 050 Task Session drawer 的信息层级。
- **硬约束**：RepoProvider 不承载 branch API；branch 读取失败可退化为文本配置；Setup 对不存在 branch fail closed；Task Session 使用 locked Runtime 与 shared-mutable Workspace。
- **变体范围**：只验证 Project 配置和 Task Workspace 状态，不设计完整 Session history。

## 覆盖页面与状态

1. **Project repository settings**：repository identity、Default branch picker、remote symbolic `HEAD`、refresh、branch read failure、文本配置退化、保存反馈。
2. **Task detail / Workspace**：absent、preparing、ready、failed、unavailable；Setup/Retry；Runtime、base branch、work branch、opaque ref；shared-mutable 提示。
3. **049/050 consumer preview**：Workspace 非 ready 时 `New Session` disabled；ready 后可用，Runtime 只读锁定。它只展示依赖关系，不是 048-owned Session UI。
4. **窄屏**：设置行和 Workspace facts 自动改为单列。

## 交互说明

- 顶部切换 `Project config` 与 `Task Workspace`。
- Project 页面可模拟 branch 读取成功/失败；失败后 branch picker 退化为文本输入，但不会伪造空列表。
- Task 页面使用原型控制切换状态；`Setup Workspace` 会短暂进入 preparing，再进入 ready。
- ready 状态显示 locked Runtime、base commit、work branch 和 shared-mutable 警告。

## 当前限制

- 原型使用静态 fixture，不调用 standard Git reader、Project API、Task Workspace API 或 runner。
- 状态切换控件只用于评审，不是生产 UI。
- Task-bound Session launch/history 属于 049/050；Project-only 与 standalone
  launch deferred。本原型只证明 ready attachment 前置条件和 Runtime lock。

## 验收门

- [x] 独立 HTML 已通过本地 HTTP 在 Codex In-app Browser 打开（2026-08-10）。
- [x] branch read failure 明确退化为保留当前值的文本配置，并提供 Retry read。
- [x] absent/preparing/ready/failed/unavailable 均已通过真实 DOM 状态验证。
- [x] 049/050 consumer preview 的 only-ready gating、locked Runtime 与 shared-mutable 提示正确；该静态预览不计作 048 Session UI 实现。
- [x] 320px 与桌面宽度无不可恢复水平溢出；320px 下 `scrollWidth === clientWidth === 305`，console error/warn 为 0。

## 浏览器验证证据

- **页面**：`http://127.0.0.1:4178/specs/048-task-workspace-setup/mockups/index.html`
- **桌面**：Project config 与 Task Workspace 两个场景均完成截图和 DOM 检查。
- **交互**：Setup 从 absent 进入 preparing，随后进入 ready；ready 前 New Session 不可用，ready 后可用。
- **失败语义**：branch reader 失败后显示普通文本输入；Workspace failed 显示 `repository_unavailable` 与 no-fallback 文案；unavailable 阻止 Session launch。
- **可访问结构**：页面存在 level 1/2 headings，导航、按钮、combobox/textbox 均具有可读名称。
- **控制台**：全流程未观测到 warning 或 error。

## Production UI verification

2026-08-10 又在真实 control-plane 页面和独立 SQLite fixture 上验证了实现，而不是把静态原型当作运行证据：

- Project repository branch reader 因 fixture connection 无 credential 明确失败；页面保留错误状态并显示普通文本配置，随后成功保存 `release/0.1`。
- ready Task 页面显示 locked Runtime、configured base、exact commit、working branch 与 `shared-mutable`，且 Setup action disabled。
- 320px viewport 的页面 `clientWidth/scrollWidth` 为 `309/309`，无水平溢出。
- 重新打开干净浏览器标签页后，console error/warning 均为 0。

浏览器验证同时发现并修复了两项真实构建边界：Turbopack 对新 control-plane 本地模块要求 extensionless import；客户端组件必须从 browser-safe `@mystra/shared/task-workspace` subpath 导入。随后 production build 通过。
