# 评审清单：Agent 定义与 Session 选择边界

## Owner 评审（非阻塞反馈）

以下项目用于 Owner 后续修改规格，不作为 Specify 完成门禁；未勾选不代表需求缺失或尚未执行验证。

- [x] Owner 已确认 Team 是租户；Agent 直属 Team，不属于 Project。
- [x] Owner 已确认 Session 直属 Team，不属于 Task 或 Project；`taskId?` 与 `projectId?` 均为彼此独立的 `0..1` 可选引用。
- [x] Owner 已确认 Task 直属 Team，不属于 Project。
- [x] 确认 Agent 唯一效果配置为 system prompt；Provider、skills、tools 与模型参数均不进入 Agent。
- [x] 确认 Session 发起使用 `Runtime + Provider + Agent + Context` 四个独立要素。
- [ ] 确认 Agent 更新只影响新 Session，历史 Session 保留 resolved prompt snapshot。
- [ ] 确认首期不做 Agent Web UI、多 Agent 层级或自动 prompt 优化。

## Spec 就绪度

- [x] `spec.md` 已完成且无 `[NEEDS CLARIFICATION]`。
- [x] requirements checklist 已通过并记录 96/100 评分。
- [x] Agent / Provider / Runtime / Context 的职责互斥且可测试。
- [x] Agent 按 Team 隔离且不属于 Project；Session 的可选 Project/Task 引用不参与 Agent 归属。
- [x] 非目标、依赖、失败关闭和历史可复核语义已记录。
- [x] clarify-style 结构化歧义扫描完成；0 个关键问题，剩余细节均适合在 plan/research 决定。
- [x] Specify 阶段完成，下一步为 `/speckit.plan`。

## 后续插件检查

- [ ] `/speckit.plan` 使用 GitNexus 检查历史 `agent` 字段、`agentNameSchema`、Agent adapter 与 Session 输入的 blast radius。
- [ ] `plan-eng-review` 评审持久化、API/MCP/CLI、授权、revision 冲突与 Session snapshot 边界。
- [ ] `/speckit.tasks` 仅在工程评审完成或被明确豁免后生成。
- [ ] 实现前运行 `/speckit.analyze`，检查 044、038 与当前 5xP 术语是否需要同步。
