# Feature Specification (Feature Spec) 模板包

适用于通过 Spec-driven 方法开发单一功能特性（Feature / User Story / Milestone）的场景。

## 场景定位
- **目标**：以业务价值和用户旅程为中心定义产品需求、验收测试条件与边界条件。
- **推荐主入口**：`README.md` 或 `spec.md`。

## 字段契约
- `title`: 功能特性全称（展示于 Taco 顶部与卡片）。
- `feature_id`: 逻辑编号（如 `001-user-auth`）。
- `created`: 起草日期（如 `2026-09-16`）。
- `status`: 状态（`Draft` / `Review` / `Approved`）。
- `input`: 用户原始自然语言输入描述。

## 包含文件
- `template.md`: 规范骨架 Markdown，Agent 可直接参考起草。
- `bundle.json`: 该场景最小化完整 bundle 数据，包含预设阶段分组。
- `empty.taco.html`: 开箱即用的空白 Taco 产物，双击即可本地打开或编辑。
