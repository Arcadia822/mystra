# 交互原型：GitHub Integration 多连接与凭据配置

## 原型入口

[打开独立 HTML 原型](mockups/index.html)

## UX Intent

- **目标**：让操作者在现有 Settings Modal 内理解并管理 GitHub 连接集合；创建 Project 时明确连接 provenance。
- **页面族**：Settings 使用固定阅读宽度的双栏 Modal；GitHub Detail 是 Integrations 的同模态下钻，不增加主导航。
- **密度**：复用 Castrel-derived `SettingGroup` / `SettingRow`，32px 区段节奏、36px 字段、紧凑 ghost/soft/solid 操作层级。
- **视觉**：Mystra dark-tech 语义色，平面 surface、quiet hairline、0/2/4/6px 圆角；无渐变、glow、glass 或装饰阴影。
- **响应式**：窄屏隐藏设置左栏，Detail 仍保留返回路径；设置行按标题、说明、控件顺序堆叠。
- **可访问性**：所有交互使用 button/input/select；连接类型和状态均有文本，不只依赖颜色；子流程可关闭并恢复焦点。

## 覆盖页面与状态

原型顶部的 `GitHub Detail`、`Add PAT`、`Add Project` 可切换三个关键流程：

1. GitHub Detail：多条连接、状态、添加连接、删除保护；下一轮原型需覆盖 self-hosted PAT-only 与 hosted App/PAT 两种 distribution projection。
2. Add PAT：方式选择、一次性 token 输入、安全说明与验证动作。
3. Add Project：连接优先、连接范围内 repo 列表；选择 repo 后只保留 Connection、Repository、Project Name 和 Slug。

Detail 中 `Add connection` 可打开方式选择；选择 `Personal access token` 进入 PAT 表单。Add Project 中选择 repo 后，列表隐藏并显示 Connection、Repository、Project Name 和 Slug。Agent 与开发镜像使用平台全局默认配置，不进入此流程。

## 当前限制

- 原型使用静态示例数据，不调用 GitHub 或本地 API。
- OAuth 跳转、PAT 验证、token replacement、删除引用检查只表现交互意图，不模拟秘密生命周期。
- 当前 HTML 原型仍以 hosted App 可用为默认示例；在进入 capability 实现前必须补充 self-hosted Hosted-only 状态并完成 Owner 复核。

## 实现对照

- 真实 Settings → Integrations → GitHub Detail 已在同一 Modal 内下钻；stock self-hosted 只呈现 PAT，Hosted distribution 才呈现 App/PAT，连接集合仍支持替换与删除操作。
- 真实 Add Project 已验证为 Modal；选中 repo 后列表收起，只显示 Connection、Repository、Name、Slug，不显示 Agent 或 image。
- PAT 输入使用非受控 password input；明文不进入 React state，成功提交后立即清空。
- loading、empty、error、disabled 状态由真实 API 驱动。`Add connection` 先打开明确的方法选择；self-hosted 的 App 项保留说明但没有可执行 Continue，Hosted 才提供 OAuth action。
