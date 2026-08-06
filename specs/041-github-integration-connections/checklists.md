# 评审清单：GitHub Integration 多连接与凭据配置

## Owner 评审

- [x] GitHub Detail 位于现有 Settings Modal 内，而不是新增主导航页面。
- [x] Hosted 中 GitHub App 与 PAT 是并列、显式的添加方式。
- [x] Stock self-hosted 的公开方式与 UI 只呈现 PAT；开源代码保留 hosted adapter，但所有 App 入口 fail closed。
- [x] 多条 App/PAT 连接可以同时可用，新增连接不覆盖旧连接。
- [x] Project 固定绑定所选连接，不进行跨连接自动 failover。
- [x] Add Project 不展示 Agent 或 image；它们由平台全局默认配置解析并固化。
- [ ] Owner 审阅交互原型中的 Detail、添加连接与 Add Project 状态。
- [x] Owner 确认 self-hosted PAT-only 与 hosted App/PAT 两种 distribution projection。

## Spec 就绪度

- [x] 用户故事、边界、失败恢复和可测成功标准完整。
- [x] 单连接/无 PAT 的旧产品边界已被标记为需要正式修订。
- [x] PAT 明文禁止进入 RDB、公共响应、URL、日志和证据。
- [x] 技术计划明确 deployment capability、SecretProvider、OAuth transaction、Team ownership、API 和 Runner credential 分派。
- [x] 工程评审覆盖 CRITICAL Registry blast radius、route bypass、OAuth replay、跨 Team 冲突和秘密泄露测试。

## 后续插件检查

- [ ] prototype 产物覆盖 loading、empty、full、error、PAT form 与多连接 Add Project。
- [ ] prototype 增加 self-hosted PAT-only 与 hosted App/PAT 状态。
- [x] plan-eng-review 已处理 CRITICAL `defaultIntegrationRegistry` 影响项：capability 不进入 Registry provider graph。
- [x] Hosted composition root 与最终 image build 归属独立 private distribution project；OSS 不维护 Cloud fork。
- [ ] 使用 `/speckit.tasks` 按新架构重生成 capability / self-hosted enforcement 任务；现有 tasks 只代表此前多连接/PAT 实现。
- [ ] 实现后运行 focused tests、typecheck、全量 test、build 和真实浏览器验证。
