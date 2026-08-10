# Research：Feature 050 关键裁决

## D1. 不设计 Session view

**决定**：Task list 与 Session detail 直接返回/使用 049 Session；event history 直接使用 049 SessionEvent。

**理由**：Summary/Detail DTO 曾要求 objectiveLabel、createdAt、terminalSummary、lastEventSequence 等 049 不拥有的字段，会形成第二套投影和同步责任。050 只增加查询过滤、分页与展示 reducer。

## D2. 第一条 user message 属于 049 launch

**决定**：`launchForTask` 只负责把 Task 页面选择映射为 049 SessionLaunchRequest。system prompt 与 canonical first user message 由服务端组装，并在 049 同一事务持久化。

**理由**：避免创建空 Session 后再追加消息的部分成功窗口。

## D3. ready 不是终态

**决定**：ready 展示“本次响应完成，可继续”；closed/failed 才是 Session 终态。050 在 ready 停止自动轮询，是因为首期没有后续消息输入 UI，不是因为 Session 结束。

## D4. updatedAt keyset

**决定**：Session list 使用 049 现有 updatedAt/id 降序，不凭空要求 createdAt。时间线中的精确创建/开始/结束时间来自 SessionEvent。

## D5. Event presentation 是纯函数

**决定**：展示 reducer 接受原始 049 SessionEvent，输出临时 UI model；unknown kind 安全降级，不持久化 summary。

## D6. Session-scoped history 可读取

**决定**：050 提供 latest/before/afterSequence 窗口和有界轮询，允许查看 049 全部类型化事件。跨 Session 搜索、全局 activity 和 arbitrary logs 仍排除。

## D7. Runtime capacity 不进入 UI

**决定**：050 不显示或限制 slot/capacity。Runtime locked 只来自 048 Workspace affinity。

## D8. 只实现 Task-bound Session

**决定**：050 不设计 Project-only 或 standalone Session。后续这些场景仍复用同一 Workspace/attachment 合同，只改变准备逻辑，不创建 parallel temporary Workspace。
