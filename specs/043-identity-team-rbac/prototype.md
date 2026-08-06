# 交互原型：身份、Team 与 RBAC

## 原型入口

[打开独立 HTML 原型](mockups/index.html)

## Intake

- **目标**：验证 Hosted/self-hosted 登录分流、Team 成员、RoleBinding、Control-plane Agent credential 与 Sandbox workload grant 的信息层级。
- **主要用户**：首次注册的人类用户、Team Owner、使用人类 API key 的操作者、长期 Control-plane Agent 管理者和诊断 Session 的平台操作者。
- **主要动作**：登录或初始化、邀请成员、分配作用域角色、创建 Agent credential、检查 Session-bound capability。
- **限制**：沿用 Mystra 现有 dark-tech Settings 语言；不重新设计 shell，不把未来认证因子伪装成首期可用能力。

## Wireframe 方向

评估了三种结构：

1. **独立 Auth 页面 + Settings 管理面**：登录/注册脱离 shell；Account、Team、Roles、Agents 进入既有 Settings。信息所有权最清晰。
2. **全部塞进 Settings Modal**：复用容器，但未认证用户无法进入 Settings，结构自相矛盾。
3. **首次使用全屏 Wizard**：适合 self-host bootstrap，但不适合日常登录和 Hosted SSO。

采用方向 1；self-host 首次初始化在同一 Auth 页面中使用 setup state，而不是另造永久导航。

## 覆盖页面与状态

原型顶部可切换 `Hosted` 与 `Self-hosted` profile，左侧切换六个关键表面：

1. **Sign in**：Hosted 显示 Google/GitHub；self-hosted 显示 email/username/password。
2. **Bootstrap**：self-host 首位 Owner 创建账户与首个 Team；Hosted 呈现创建 Team/接受邀请后续动作。
3. **Members**：User 与 AgentPrincipal 使用不同 actor 标识，membership 状态和 role summary 可辨识。
4. **Roles**：Team/Project scope、permission summary、最后 Owner 保护和多个 RoleBinding。
5. **Agents & Keys**：人类 API key 与 Control-plane Agent credential 分栏，不用 synthetic email 混合。
6. **Workload Grant**：Session、Task、Project、Team、Runner、audience、capability 和 expiry 的只读诊断面。

## Interaction Notes

- Profile 切换会改变 Sign in/Bootstrap 的公开能力，但不会改变 Team/RBAC 领域结构。
- 原型中的创建、邀请、轮换和撤销操作只展示 flow intent，不进行持久化。
- Roles 使用作用域标签和 permission summary，不让颜色成为唯一语义。
- Workload Grant 只读，明确提示它不是 Team membership 或长期 Agent identity。
- 未来 Factors 只在 Account security summary 中显示 `Planned`，不提供假 enrollment。

## 当前限制

- 静态示例数据，不调用 OAuth、短信、邮件、数据库、API、MCP 或 Runner。
- 不模拟 WebAuthn、OTP、credential one-time reveal、session cookie 或 capability 签名。
- UI copy 以英语示例为主，用于结构验证；实现必须提供英语和简体中文。
- 视觉为低保真结构，不代表最终 iconography、motion 或 pixel polish。
- Spec View 与原型已生成到磁盘；Codex 应用内浏览器的 URL policy 阻止 `file://`，本轮没有绕过策略或声称完成浏览器 review。

## High-fidelity 升级目标

- 登录失败、provider email 未验证、invitation expired、last Owner conflict 和 credential reveal/rotation 状态。
- Settings 现有 Account/Team tab 的真实 component mapping。
- 320 / 768 / 1024 / 1440px、键盘、focus return、screen-reader labels 和错误播报验证。
- 接入 040/041 后再制作真实 browser prototype，避免围绕临时 schema 绘制精美幻觉。
