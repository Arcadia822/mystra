# 功能说明：Project Issue 来源与分集成浏览

## 摘要

Mystra 为每个 Project 提供边界明确的只读 Issue 浏览。GitHub Issues 自动使用 Project 已绑定的 GitHub connection 与 repository；Linear Issues 由 Project 显式选择一条 Team-owned API-key connection 和一个 Linear Team。两个 Integration 分别展示，不提供融合列表。

## 功能地图

- Settings → Integrations → Linear：添加、验证、替换和检查 API-key connections。
- Project 配置：检查自动 GitHub source；配置零或一个 Linear Team source。
- Project → Issues：在 GitHub 与 Linear 之间切换 provider-specific 表格。
- 主导航 → Issues：先选择 Project，再复用同一浏览体验。
- Issue 行：只打开 provider 原始页面；Mystra Issue 详情页延期。

## 边界

- GitHub 与 Linear 不共享表格列、筛选或分页状态。
- Linear API key 不进入 Project、公共响应、日志或页面 DOM。
- 不跨 Project、Linear Team 或 Integration 聚合。
- 不创建 Task/Session，不提供 dispatch、评论、状态修改或 write-back。
- 不提供 Mystra Issue 详情页或详情 drawer。
- 不持久化 Issue snapshot/cache。

## 分阶段能力图

1. 当前功能：self-hosted Linear API key、Project source 关联、provider-specific 只读列表。
2. 后续独立规格：Task 创建与 Issue dispatch。
3. 后续独立规格：Hosted Linear OAuth。
4. 后续独立规格：Integration cache、离线读取或统一搜索。
