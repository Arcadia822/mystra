# 评审清单：本地用户、Team 与 RBAC

## Owner 需求

- [x] 部署后默认进入登录页。
- [x] 外部 installer bootstrap contract 提供 `admin/admin` 与初始 Team；安装器实现延期。
- [x] 默认 admin 首次登录强制修改 password。
- [x] self-host User 只使用 username/password，不引入 email。
- [x] Account Settings 支持修改 password 与 display name；login username 首期只读。
- [x] 每个 User 注册时自动获得一个由自己拥有的初始 Team。
- [x] 初始 Team 与其他 Team 同构，可改名、加成员、删除、转移 Owner。
- [x] 支持 Team 切换、创建、重命名和删除；某 User 唯一 active Team 不可删除或退出。
- [x] Settings 增加 Team Members 页面，支持按 username 添加、移除/停用和设置 Owner/Admin/Member。
- [x] SaaS/SSO、Agent key、Agent 登录、Sandbox workload 与强认证因子不进入 043。
- [ ] Owner 提供 Castrel AI Workspace Members 页面的路径或截图后，完成视觉对齐检查。

## Spec 就绪度

- [x] 三个独立 User Story 覆盖账户、Team lifecycle 与 Members/RBAC。
- [x] installer 实现与 post-install bootstrap contract 已分离。
- [x] username/display name、初始 Team 创建、删除保护和角色权限明确。
- [x] Team context、last Owner、last active Team 和跨 Team fail-closed 明确。
- [x] 041 已落地；040 合入前置、Prisma ownership 和 pre-0.1 策略明确。
- [x] Requirements Quality Score 达到 97/100。
- [x] 040 已合入 `main`。
- [x] 5xP/constitution 的 caller-auth/Team-admin 排除项已正式修订。
- [x] 进入 `/speckit.plan`。

## Planning 检查

- [x] 完成 Better Auth 无-email capability spike；其 username plugin 强制 email，故采用 Mystra-owned local-auth。
- [x] 定义 installer/043 之间 `admin/admin`、password-change-required 与初始 Team 的 bootstrap contract。
- [x] 定义 User 注册与初始 Team 原子创建事务。
- [x] 定义 active Team context、Team archive 和删除后回退语义。
- [x] 定义 Owner/Admin/Member permission matrix 与 Members route contracts。
- [x] 证明 User schema 与 OSS composition 不含 email、hosted/social provider、Agent credential 或 factor 实现。
- [x] 为 SQLite/PG 两套 Prisma schema 建立 Auth/Team/RBAC parity gate。
- [x] `plan-eng-review` 覆盖全 route/MCP/CLI authorization、bootstrap secret、Team deletion 和 Prisma blast radius。
