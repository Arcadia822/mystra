# 交互原型：本地用户、Personal Team 与 RBAC

## 原型入口

[打开独立 HTML 原型](mockups/index.html)

## Intake

- **目标**：验证默认 admin 登录/强制改密、Account Settings、Team switcher、Team lifecycle 和 Members/Roles 管理的信息层级。
- **主要用户**：首次登录的 admin、普通本地 User、Team Owner 与 Team Admin。
- **主要动作**：登录、修改 password/display name、切换/创建/重命名/删除 Team、按 username 添加成员和设置角色。
- **限制**：不展示 email、SaaS/SSO、Agent identity 或未来认证因子；不实现安装器。

## 覆盖页面与状态

原型左侧切换六个关键表面：

1. **Sign in**：username/password；示例显示 `admin` 默认账户和首次改密提示。
2. **Account**：修改 display name 与 password；login username 只读。
3. **Team switcher**：标识当前 Team、Personal Team，并提供创建 Team 入口。
4. **Team settings**：重命名 Team；Personal/唯一 Team 删除禁用，普通 Team可确认归档。
5. **Members**：display name、username、role、status 与 add/remove actions。
6. **Roles**：Owner/Admin/Member permission summary 与保护规则。

## Interaction Notes

- 默认 `admin/admin` 登录成功后进入强制修改 password 状态，不可直接进入 Team shell。
- Personal Team 的 display name 可改，但 Personal 标识独立存在。
- Team switcher 只列 active memberships；创建 Team 后创建者成为 Owner。
- 删除只针对普通 Team，表现为确认后的归档；Personal Team 和唯一 Team均禁用。
- Members 按准确 username 添加已有本地 User，不使用 email invitation。
- Castrel AI Workspace Members 视觉参考未提供，本轮不猜测其具体布局、组件或交互。

## 当前限制

- 静态示例数据，不调用数据库、API 或 MCP。
- 不模拟 password hashing、session cookie、真实 role mutation 或并发冲突。
- UI copy 以英语示例为主；实现必须提供英语和简体中文。
- 按项目规则执行静态一致性检查，不声称完成运行时或浏览器验收。

## High-fidelity 升级目标

- 获得 Castrel AI 页面路径或截图后，补充 Workspace Members 视觉与交互映射。
- 覆盖 forced password change、duplicate username、last Owner、personal owner、last Team 和 Team delete confirmation 状态。
- 映射现有 Account/Team Settings components。
- 040 合入 `main` 后再制作真实 runtime prototype；041 已是当前基线。
