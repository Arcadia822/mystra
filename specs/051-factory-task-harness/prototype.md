# 原型：Task 生产状态与 mystra-agent CLI

## 入口

- [打开独立 HTML 线框原型](mockups/index.html)

## Design Intake

- **目标用户**：观察 Agent 生产进度并人工收口的 Team 操作者。
- **首要行动**：区分 Task productionStatus 与 Session.state，并理解谁能执行下一次迁移。
- **核心信息**：当前状态、revision、Agent note、允许迁移、最新 Session state、transition history。
- **硬约束**：Agent report 不等于 Mystra verification；Agent 不能完成或取消 Task。
- **变体范围**：只验证状态机和薄 CLI，不设计完整 Harness orchestration。

## Wireframe 方向

页面以 Task 状态为主轴。顶部展示 productionStatus 与 revision；中部展示 `mystra-agent` 的 attempt-scoped context/status contract、本地 `linctl`/`gh` 工具边界和独立 Session execution state；底部展示 append-only transition history。waiting_for_review 的 PR 与测试文字明确标注 Agent reported / not verified by Mystra。

## 覆盖状态

- pending：等待 Assign/Start。
- in_progress：Agent 正在生产。
- blocked：Agent 报告无法继续，必须有 note。
- waiting_for_review：Agent 声明可审查，内容未经 Mystra 验证。
- done：Human 接受，终态。
- canceled：Human 取消，终态。

## 交互说明

- 状态切换按钮只用于原型评审，不代表真实权限实现。
- `mystra-agent` 只展示当前 attempt 的 whoami/context/status contract，不允许任意 Task ID。
- `mystra` 明确保留为 Control Plane 管理 CLI；原型内的 workload 命令不使用该名称。
- Linear 读取与 PR 创建分别标注为本地 `linctl` 和 `gh`，Mystra 不代理或验证。
- Session badge 可以独立切换，证明 Session failed 不会自动修改 Task。
- Human actions 只在对应 Task 状态出现。

## 当前限制

- 静态 fixture 不连接真实 API、Runtime、`mystra-agent`、`linctl` 或 `gh`。
- 不表示最终视觉设计。
- 不设计 PR/测试验真、多 Session、心跳、通用 Artifact 或 Production Recipe。
