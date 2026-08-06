# 评审清单：039 GitHub Project Onboarding

## Owner 评审

- [x] Add Project 使用 Modal，触发时不跳转页面。
- [x] GitHub 默认选中，并保留未来来源的结构位置。
- [x] 先选择仓库，选中后列表折叠为 Repository 设置项，再展开其余配置。
- [x] Settings 负责连接 GitHub App，发现和交付使用同一安装连接。
- [x] 不保留 `MYSTRA_GITHUB_TOKEN` 或 PAT 回退。
- [ ] 审阅并接受交互原型中的 Settings 行密度、Modal 尺寸和状态切换。

## Spec 就绪度

- [x] 四条 P1 用户故事覆盖连接、选择、创建和交付。
- [x] 明确区分 OAuth 用户验证与 GitHub App 安装授权。
- [x] 明确持久元数据和短期秘密的边界。
- [x] loading、empty、error、retry、reconnect、change 和窄屏状态已定义。
- [x] 成功标准包含用户效率、来源一致性、交付和秘密审计。
- [x] 排除 caller auth、webhooks、Issue 写回、通用 catalog 和每仓库 secret UI。

## 实现 Gate

- [ ] 交互原型已在浏览器验证。
- [ ] `/speckit.plan` 已完成。
- [ ] `plan-eng-review` 已完成，发现已写回计划。
- [ ] `/speckit.tasks` 与 `/speckit.analyze` 已通过。
- [ ] 修改任何 symbol 前已完成 GitNexus upstream impact。
- [ ] 修改 API 前已完成接口 blast-radius 检查。
- [ ] 实现后已完成 focused tests、typecheck、浏览器验证和 GitNexus change detection。
