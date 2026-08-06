# 评审清单：身份、Team 与 RBAC

## Owner 评审

- [x] 使用 043 编号，并按 Owner 要求直接创建在当前 041 branch。
- [x] Hosted 使用 Google/GitHub SSO；stock self-hosted 使用 email/username/password。
- [x] verified email 是人类 User 唯一外部业务 ID，但不是内部主键或 provider subject。
- [x] 人驱动 Agent 使用人的 OAuth/API key，不另建 AgentPrincipal。
- [x] 长期 Control-plane Agent 使用独立 AgentPrincipal，可担任 Project Admin、Product Manager 等角色。
- [x] Sandbox Dev Agent 使用 Session-scoped workload identity，并通过 Mystra capability 向外行动。
- [x] 认证方案必须支持 SQLite、PostgreSQL 与 Supabase-backed PostgreSQL。
- [x] 未来可扩展 2FA/TOTP、Passkey、Email OTP、SMS OTP 与 One-Time Token。
- [ ] Owner 确认 self-host 初始化后默认 invitation-only。
- [ ] Owner 确认内置 Team/Project role catalog 与多个 RoleBinding 的 allow-union 语义。
- [ ] Owner 审阅登录、Team、Roles 与 Agent credentials 低保真原型。

## Spec 就绪度

- [x] 五个独立用户故事覆盖人类、Team/RBAC、Control-plane Agent、Sandbox workload 和未来因子。
- [x] Hosted/self-hosted capability、email identity、account linking 和秘密边界明确。
- [x] Team 与 Project scope 的授权模型、最后 Owner 和跨 Team fail-closed 明确。
- [x] 040/041 前置和 Prisma migration ownership 明确。
- [x] Requirements Quality Score 达到 95/100。
- [ ] 040 已实施并合入目标代码基线。
- [ ] 041 schema 已冻结并被 040 吸收。
- [ ] 5xP/constitution 的旧排除项已正式修订。
- [ ] 进入 `/speckit.plan`。

## 后续插件检查

- [ ] Planning 锁定 Better Auth 稳定版本及 Prisma adapter 版本。
- [ ] Planning 核验 Google/GitHub verified email 和 explicit account linking 配置。
- [ ] Planning 为 SQLite/PG 两套 Prisma schema 建立 Auth/RBAC parity gate。
- [ ] Planning 核验 API Key、OAuth Provider、2FA、Passkey、Email OTP、Phone OTP 与 One-Time Token schema 影响。
- [ ] Planning 设计 WorkloadIdentity audience、capability、expiry、revocation 与 Session lifecycle 绑定。
- [ ] `plan-eng-review` 覆盖全 route/MCP/CLI authorization、RdbProvider/Prisma、Runner claim 和 sandbox secret blast radius。
