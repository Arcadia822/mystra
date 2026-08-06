# 功能说明：039-github-project-onboarding

## 摘要

039 把 GitHub Project onboarding 收敛为一条完整链路：先在 Settings 绑定一个经验证的 GitHub App 安装连接，再从 shell 的 Add Project Modal 中选择该安装可访问的仓库，最后以同一连接完成 Runner 的 clone、push 与 PR 交付。

它修正了当前两个割裂点：Project 创建不再作为 `/projects` 的内联表单，仓库发现也不再依赖与 Runner 交付不同的个人令牌。

## 功能地图

- Settings / Integrations 展示 GitHub App 的 disconnected、connecting、connected、error 状态。
- OAuth 只用于确认操作者有权绑定安装；App 安装是持久连接对象。
- Add Project 在当前页面打开 Modal，GitHub 是默认且当前唯一可用来源。
- Modal 使用 App 安装范围加载、筛选和选择仓库。
- 选仓库前显示候选列表；选仓库后折叠为 Repository 设置行并展开其他配置。
- 设置项复用 Castrel Settings Modal 的业务 anatomy 与密度：左说明、右控件、紧凑分组；颜色与 token 仍归 Mystra。
- Project 创建时服务端再次解析仓库，并保留来源连接引用。
- Runner 使用短期安装凭据完成 GitHub 交付；没有个人令牌回退。

## 边界

- 本功能不是 caller login，也不建立公开 Team 管理。
- 本功能不是通用 Integration catalog；只实现 GitHub App 连接表面和可扩展 provider seam。
- 不实现 webhooks、Issue 写回、安装卸载同步、每仓库 secret UI 或调用者提供 clone URL。
- App 私钥不进入 UI；用户 OAuth token 与安装 token 不进入持久状态。
- `/projects` 继续承担 Project 列表和对象入口，不承担创建表单。

## 交付切片

1. 连接模型与 GitHub App 授权校验。
2. Settings / Integrations 连接体验。
3. Add Project Modal 与仓库选择状态机。
4. Project 来源连接绑定与创建期再校验。
5. Runner 短期凭据交付链。
6. 静态、契约、浏览器和私有仓库端到端验证。
