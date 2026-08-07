# 功能说明：本地用户、Personal Team 与 RBAC

## 目标

开源 Mystra 部署后从登录页开始。外部安装流程未来提供默认 `admin/admin` 和 admin 的 `Personal` Team；043 消费这个 bootstrap state，但不实现安装器。默认 admin 首次登录必须修改 password。

每个本地 User 使用唯一 username/password，拥有可修改的 display name，并始终拥有一个 Personal Team。用户可以切换 Team、创建普通 Team、重命名任意拥有的 Team，并删除非 Personal、非唯一的普通 Team。

## 功能地图

- **Authentication**：登录、注册、退出、session 撤销、默认 admin 强制改密。
- **Account**：修改 password 与 display name；login username 首期只读。
- **Personal Team**：每 User 恰好一个，初始名 `Personal`，可改名、可加成员、不可删除或转移 personal owner。
- **Team lifecycle**：Team switcher、创建、切换、重命名与归档删除；唯一 Team 不可删除。
- **Members**：Settings > Team Members 按 username 添加、停用、移除成员并设置角色。
- **RBAC**：首期固定 Owner、Admin、Member，服务端统一 enforcement，保护 last Owner 与 personal owner。
- **Persistence**：SQLite、PostgreSQL、Supabase-backed PostgreSQL 使用相同 Prisma-owned 逻辑模型。

## 明确边界

- self-host 不含 email；username 用于登录，display name 只用于展示。
- 安装器与 seed orchestration 后续单独实现；应用运行时不得静默创建 `admin/admin`。
- SaaS/SSO、Agent authentication、Agent key、Sandbox workload identity 与强认证因子不进入 043。
- Castrel AI Workspace Members 的视觉对齐等待 Owner 提供具体页面路径或截图；当前原型只验证信息结构和行为。
- 041 已落地；implementation 等待 040 合入和 5xP boundary amendment。
