# Prototype: Task 创建入口

## 入口

- [打开独立 HTML 原型](mockups/index.html)

## 覆盖页面

1. `New Task`：标题、`description`、可选 Project，以及纯 Task 创建动作；不提供 Issue picker。
2. `Project Issues`：GitHub/Linear Issue 行上的 `Create Task`，成功后留在列表并变为 `Open Task`；没有中间 modal、drawer、wizard 或自动跳转。
3. 小屏状态：表单控件纵向排列，Issue 行动作保持可见。

## 使用方式

- 使用页面顶部 `New Task` / `Issue action` 切换两个场景。
- 在 New Task 场景可选择或不选择 Project；页面始终不加载 Issue。
- 点击 `Create Task` 只演示成功反馈，不会发起真实请求或 Session。
- 在 Issue action 场景点击 `Create Task`，按钮会变为 `Open Task`，演示防重后的行级状态。

## 当前限制

- 原型是需求验证产物，不连接 API、权限、provider pagination 或持久草稿。
- New 手动创建后的 Task 对象页仅以成功提示表示，不在本原型中设计；Issue 创建明确留在列表。
- 不展示任何 Session、Runtime、Provider、Agent、Context 或 auto-routing 控件；这不是遗漏，而是边界。
