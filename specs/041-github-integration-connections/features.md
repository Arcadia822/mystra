# 功能说明：GitHub Integration 多连接与凭据配置

## 摘要

Mystra 将 GitHub 从单一状态升级为部署感知的连接集合。Self-hosted 正式支持 PAT；Hosted Mystra 额外支持平台运营的 GitHub App。开源代码保留 App adapter，但运行时不会把“代码存在”或“环境变量齐全”误判为 self-hosted 支持。每个 Project 固定绑定一条连接，发现与交付始终使用同一授权来源。

## 功能地图

- Integrations 列表：GitHub 行显示连接数量与健康摘要，并进入 Detail。
- GitHub Detail：查看全部连接；stock self-hosted 只显示 PAT 添加方式；Hosted 可添加 App 或 PAT；支持重连、替换 token、删除未被引用的连接。
- Add Project：选择连接，再选择该连接可访问的 repo；选定后只填写 Project Name 和 Slug。Agent 与开发镜像由平台全局默认配置解析。
- 执行链：Project 保存精确 connection reference；clone、push、PR 不跨连接 fallback。
- 安全边界：RDB 只保存非秘密元数据与不透明 secret reference；PAT 明文只经过受保护的秘密边界。
- 部署边界：capability 由可信服务端策略统一决定；UI、OAuth routes、repo discovery 和 Runner credential 必须一致 fail closed。
- Hosted OAuth：一次性 transaction 绑定 actor、Team、安装意图和安全 return path；OAuth user token 验证后立即丢弃。

## 边界

- 本功能不引入通用 Integration catalog、GitLab intake、Issue write-back 或自动连接 failover。
- PAT 是与 GitHub App 并列的显式方式，不是 App 失败后的隐藏回退。
- 连接仍被 Project 引用时不能删除；失效连接必须显式恢复。
- Self-hosted GitHub App、bring-your-own App registration 不属于支持范围。
- Hosted caller auth、Team administration、RDB/KMS 与 lifecycle webhook 是明确后续阶段，不伪装成当前已实现能力。

## 分阶段能力图

1. Shared deployment capability contract 与 self-hosted 全入口 fail-closed。
2. GitHub Detail Hosted-only 状态、PAT 和 Add Project 可用连接过滤。
3. Hosted caller/Team、OAuth transaction、managed RDB/SecretProvider prerequisites。
4. Hosted App installation activation、single-Team ownership 与 exact credential delivery。
5. Hosted GA lifecycle webhook、审计/告警与真实 provider 验证。
