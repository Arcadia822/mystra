# 原型：039 GitHub Project Onboarding

## 交互入口

- [打开独立交互原型](mockups/index.html)

## 覆盖范围

原型用于确认两类交互：Settings 中的 GitHub App 连接状态，以及 Add Project Modal 从仓库选择到配置表单的渐进披露。

- Settings 使用 Castrel Settings Modal 的双栏结构和紧凑 setting row anatomy；全局分类固定为 `Account`、`Appearance`、`Team`、`Integrations`，GitHub App 连接只位于 Integrations。
- Add Project 默认选择 GitHub；未来来源显示为不可用占位。
- 未连接状态可跳转到 Settings；连接后可以加载、搜索并选择仓库。
- 选择仓库后，列表隐藏为 Repository 设置行，Project Name、Slug、Default Agent 与 Runtime 随后出现。
- Change 恢复仓库列表但保留其他输入。
- 原型提供 connected/disconnected、loading、empty、error 与 submit error 演示状态。
- 视觉使用 Mystra dark-tech token，不复制 Castrel 颜色、品牌或业务文案。

## 验证步骤

1. 打开 Settings，进入 Integrations，点击 Connect GitHub。
2. 完成模拟连接，确认状态行显示账户、安装和 Reconnect。
3. 关闭 Settings，点击 Add Project，确认背景地址与上下文没有变化。
4. 在仓库列表中搜索并选择 `mystra`，确认列表折叠、配置项出现。
5. 点击 Change，确认回到列表且 Project Name 保留。
6. 使用原型工具条切换 loading、empty、error，检查恢复操作。
7. 调整到窄屏，确认 setting row 由左右布局改为上下布局。

## 限制

- 这是交互和视觉评审产物，不发起真实 OAuth、GitHub API 或 Project 创建请求。
- 示例账户、安装、仓库和错误均为模拟数据。
- 生产实现必须以 canonical API、服务端仓库再解析和 Runner 短期凭据验证为准。
