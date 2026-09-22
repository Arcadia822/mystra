# Architecture Decision Record (ADR) 模板包

适用于记录重要架构决策、背景驱动、技术评估及后续影响的场景。

## 场景定位
- **目标**：保留团队关键技术选型与架构变更的上下文，避免历史信息断层。
- **推荐主入口**：`index.md`。

## 导航推荐结构
1. **决策索引 (ADR Index)**：按状态与序号排列的所有决策列表。
2. **已采纳决策 (Accepted)**：处于生效状态的决策记录。
3. **废弃或替代 (Deprecated / Superseded)**：历史决策及替代指向。

## 包含文件
- `template.md`: 单篇 ADR 规范骨架。
- `bundle.json`: 包含索引与示例 ADR 的最小化 bundle。
- `empty.taco.html`: 开箱即用的空白 ADR Taco。
