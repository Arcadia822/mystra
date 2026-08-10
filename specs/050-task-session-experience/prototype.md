# 原型：Task Session 发起与执行历史

## 状态

旧的独立 HTML fixture 已退役。它在 048/049 落地前创建，包含 per-Session Runtime 与 Project 选择，和当前合同冲突。050 不再维护第二套静态页面；最终验收直接针对真实 Task 与 Session 页面。

## 设计 Intake

- **目标用户**：已登录并具有当前 Team resource access 的操作者。
- **首要行动**：确认/准备 Task Workspace，再从固定 Runtime 发起 Session；随后理解 Session 正在做什么。
- **参考**：Mystra 当前 Task/detail shell；Castrel Session history 的 turn grouping、折叠 process trace、工具分组与按需展开。
- **硬约束**：不引入 Task ownership、聊天继续输入、日志产品或 Castrel 依赖。
- **变体范围**：不创建新 view family，复用现有 shell、panel、form 与 object detail。

## Wireframe 方向

评估过三种结构：

1. **Task 页面内联长表单**：上下文清楚，但会把常用的 Task 阅读/编辑页面永久变成配置页。
2. **独立 New Session 页面**：空间充足，但打断 Task→Session 的短路径，并增加一个不必要路由。
3. **Task 详情 + 右侧 launch drawer + 独立 Session detail**：保留 Task 作为视觉锚点，表单只在需要时出现，创建成功后进入可持续观察的 Session 页面。

采用 Task detail 内嵌 Sessions panel + 独立 Session object route。它用最少新表面覆盖发起与观察，同时保持 Session 的独立对象身份。

## 覆盖页面与状态

- Task 详情：Workspace absent/preparing/ready/failed 状态、Setup/Retry、已有 Session、无 Session、分页入口、New Session。
- Launch panel：锁定 Workspace Runtime、Provider、Agent、来自不可变 Task context 的 Project reference、可选 Manual Context、shared-mutable 提示、提交中与错误槽位。
- Session 详情：状态摘要、执行选择、Context 摘要、message/process/tool/lifecycle/error/unknown event 表现、折叠与展开。
- Live behavior：运行中提示与新增 event；ready 显示“本次响应完成，可继续”并停止 050 自动刷新；closed/failed 使用终态文案。

## 交互说明

- 点击 `New Session` 展开 Task 内的 launch panel。
- Runtime 不可修改；Provider 只来自 Workspace Runtime，避免制造无法访问该目录的选择。
- Task context 始终包含；可选 Project reference 从 Task 不可变 context 派生，不提供第二个 selector。
- 创建成功后真实页面导航到 Session detail。
- Session detail 的 process 与 tool group 可以展开；`Load earlier events` 模拟向前游标分页。

## 已知限制

- 不保留静态 fixture，因此没有脱离实现的伪交互证据。
- 真实页面必须覆盖小屏、键盘路径、最终双语文案、console 与 network。
- 生产实现复用 Mystra token、controls 与状态组件。

## 浏览器验证证据

实现完成后用真实浏览器重新验证 Workspace 状态、locked Runtime、shared-mutable 提示、launch disabled 状态、直接复用 Session 的列表/详情、ready 与 closed/failed 文案差异，以及键盘、窄屏、console/network。旧 fixture 的任何结论均不计入验收。
