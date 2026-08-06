# 功能说明：身份、Team 与 RBAC

## 摘要

043 为 Mystra 增加可信 caller identity、Team tenancy 与服务端 RBAC。Hosted 使用 Google/GitHub SSO；stock self-hosted 使用 email、username、password。人类 User 以 verified email 作为唯一外部业务 ID，但内部身份和 provider binding 使用稳定 ID。长期 Control-plane Agent 拥有独立 AgentPrincipal；Sandbox Dev Agent 只获得 Session-scoped workload identity。

## 功能地图

- 人类身份：注册、登录、退出、session、账户关联、email 变更与停用。
- 部署能力：Hosted SSO 与 self-host password profile 明确分离并 fail closed。
- Team：首位 Owner bootstrap、邀请、成员状态、多 Team membership 与明确 active Team context。
- RBAC：稳定 permission catalog、Team/Project-scoped RoleBinding、内置 Owner/Admin/Member/Project roles 和最后 Owner 保护。
- 人类工具：沿用 User OAuth/session 或 scoped API key，不制造额外 Agent 身份。
- Control-plane Agent：独立 AgentPrincipal、credential 生命周期和 Team/Project roles。
- Sandbox Agent：Session-bound WorkloadIdentity/CapabilityGrant，通过 Mystra 明确能力向外行动。
- 持久化：SQLite、PostgreSQL、Supabase-backed PostgreSQL 使用同一 Prisma-owned 逻辑模型。
- 未来因子：TOTP/2FA、Passkey、Email OTP、SMS OTP 与 One-Time Token 绑定同一 User。

## 边界

- Email 唯一规则只适用于人类 User；Agent、Runner 与 workload 不伪造 email。
- Team 是顶层 tenancy；Better Auth Organization/Team 不成为 Mystra 领域真相。
- Role 首期使用稳定 allow permission catalog，不引入 deny、ABAC 或 policy DSL。
- Workload identity 不自动启用 Issue 写回、任意消息或其他尚未获批的外部副作用。
- 首期不交付 SAML/SCIM、phone-only/passkey-only User、全部未来因子或自定义 policy engine。
- 043 可先评审；implementation 等待 040 落地、041 schema 冻结和 5xP boundary amendment。

## 分阶段能力图

1. **Identity foundation**：Better Auth + Prisma-owned User/identity/session，Hosted SSO 与 self-host password。
2. **Team/RBAC**：Team、invitation、membership、内置 roles、RoleBinding 和所有管理表面的服务端 enforcement。
3. **Agent identity**：User API keys、Control-plane AgentPrincipal/credentials、Sandbox WorkloadIdentity/CapabilityGrant。
4. **Account hardening**：TOTP/2FA、Passkey、Email/SMS OTP、One-Time Token、step-up 与 recovery。
5. **Enterprise extensions**：自定义 roles、SAML/SCIM 或更复杂 policy，仅在独立规格明确后进入。
