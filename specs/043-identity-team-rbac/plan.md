# 实施计划：开源本地用户、Team 与 RBAC

**Branch**: `043-identity-team-rbac`（Owner 要求在 `main` 上更新 043 artifacts；Spec-Kit 命令须显式设置 `SPECIFY_FEATURE=043-identity-team-rbac`） | **Date**: 2026-08-07 | **Spec**: [spec.md](spec.md)
**Input**: `specs/043-identity-team-rbac/spec.md`

## Summary

043 为开源自托管 Mystra 引入从登录页开始的 username/password 人类身份、每 User 注册时自动获得一个由自己拥有的初始 Team、Team 生命周期与切换，以及 Owner/Admin/Member 三角色的服务端 RBAC。技术路径：Human Auth 复用 Better Auth 稳定版（仅启用 username/password 与 session），Prisma 作为 Auth 与授权关系数据的唯一 schema/migration/runtime access owner，Team、TeamMembership 及内建 Role/Permission 目录是 Mystra-owned 领域模型，SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 通过 byte-identical schema parity 保证同构。Web 提供登录/注册、Account Settings、Team switcher、Team Settings 与 Team Members；API 是权威实现，MCP/CLI 是薄适配层，四个表面共享同一权限判定。

本计划只完成 Phase 0（research）与 Phase 1（data-model、contracts、quickstart）设计产物，不产出 tasks，不写实现代码。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.x（`@prisma/adapter-better-sqlite3` / `@prisma/adapter-pg`）、Better Auth 稳定版（username + session 能力）、经过审查的自适应 password hashing（Better Auth 内建，见 research）
**Storage**: 选择型 SQLite / PostgreSQL / Supabase-backed PostgreSQL，统一在 `RdbProvider` 之后；Prisma 双 datasource + 独立 migration history + byte-identical model parity
**Testing**: Vitest 4；Auth/Team/RBAC contract suite 需在 SQLite 与真实 PostgreSQL 上跑通；schema parity 断言扩展现有 `prisma-schema-parity.test.ts`
**Target Platform**: 单机自托管 Web 控制面（`apps/control-plane`）+ 薄 CLI/MCP 适配
**Project Type**: Web application（Next.js 控制面 + 服务端领域库 + 共享 Zod 合同包）
**Performance Goals**: 交互目标来自 spec SC（切 Team ≤30s、改 password/display name ≤60s 为体验上限，非吞吐指标）；权限判定是请求内同步解析，无额外网络往返
**Constraints**: self-host 不引入 email（FR-008/SC-009）；password/session token/bootstrap secret 不得进入 URL/日志/公共响应/证据；应用运行时不得因空库自建 `admin/admin`（FR-004）；Better Auth 类型不得越过公共合同（FR-041）；服务端 fail-closed 授权；SQLite/PostgreSQL 逻辑模型一致（FR-045）
**Scale/Scope**: 单机自托管少量 Team 与 User；首期固定 3 内建角色、单一 active role/membership；无自定义 Role、无 Project-scoped Role

## Constitution Check

*GATE：Phase 0 前必须评估，Phase 1 后复检。*

Constitution v2.7.0 相关约束与本计划的对齐：

| 约束 | 状态 | 说明 |
|---|---|---|
| II. Typed Contracts at Service Boundaries | PASS | 新增 Auth/Team/RBAC 全部通过 `@mystra/shared` Zod + TS 合同暴露；Better Auth 与 Prisma generated types 不越过 persistence/service boundary（FR-041/FR-044）。|
| III. Providers Are Replaceable Boundaries | PASS | 身份/授权关系数据继续走 `RdbProvider` 与 Prisma；SQLite/PostgreSQL/Supabase 同构，Supabase 仍是 PostgreSQL profile，不引入 Supabase Auth/Data API 旁路（FR-043）。不新增 WorkflowProvider。|
| V. Verification & Documentation Before Delivery | PASS（计划层） | 计划要求 contract 测试 + 双库 parity + 双库 contract suite 作为交付证据（SC-008/SC-011）。|
| 040 amendment：第一期 Prisma 只 3 张业务表 + SecretEnvelope | PASS | 040 的“实现任务和代码不得自行扩表”约束的是 040 自身实现，不是对后续新功能的封锁。043 是新功能，通过自己的 spec/plan/data-model 正常引入 Auth/RBAC 模型集合，走常规 Owner 评审即可，不构成独立扩表审批门。实现时同步更新 `prisma-schema-parity.test.ts` 的模型集合断言。|
| I. Specification Owns Product Boundaries：caller auth / Team authorization 属 hosted-only 前置 | **RESOLVED（2026-08-07 amendment）** | constitution v2.7.0 已修订 Principle I：self-host 单机人类 username/password 认证与 Owner/Admin/Member Team RBAC 进入范围（043 owns contract）；hosted 多租户 caller 身份联邦、caller-login OAuth(SSO/social)、managed secrets、hosted Team administration、public multi-tenancy 仍排除。5xP（AGENTS/PRODUCT/PLATFORM）已同步。FR-051 前置满足。|

**Gate 结论**：Phase 0/1 设计产物可以产出。self-host caller auth + Team RBAC 的边界冲突已由 constitution v2.7.0 修订解决（FR-051 满足）。进入实现前剩余的启动检查项为 FR-050（等待 040 合入 `main`）。向 Prisma schema 新增 Auth/RBAC 表属 043 功能范围内的常规设计，走 spec/plan Owner 评审，不是独立审批门。

## Project Structure

### Documentation (this feature)

```text
specs/043-identity-team-rbac/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出（Auth + RBAC 数据表设计）
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
│   ├── auth-api.md
│   ├── team-api.md
│   ├── membership-rbac-api.md
│   ├── permission-catalog.md
│   ├── rdb-provider.md
│   └── bootstrap-contract.md
├── spec.md / features.md / checklists.md / prototype.md / mockups/  # 既有
└── tasks.md             # /speckit.tasks 输出（本命令不产生）
```

### Source Code (repository root)

```text
apps/control-plane/
├── prisma/
│   ├── sqlite/schema.prisma           # 新增 Auth + RBAC 模型（byte-identical model 段）
│   ├── sqlite/migrations/             # 新 migration history
│   ├── postgresql/schema.prisma       # 与 sqlite model 段字节一致
│   └── postgresql/migrations/
├── src/lib/
│   ├── auth/                          # 新增：Better Auth 装配、密码策略、username 规范化装配、session→activeTeam 解析
│   ├── teams/                         # 新增：Team lifecycle、active-team context
│   ├── rbac/                          # 新增：Permission catalog、role→permission 矩阵、服务端 enforcement、last-owner/last-active-team 不变量
│   ├── db/
│   │   ├── prisma-provider.ts         # 扩展：Team/Membership CRUD + 原子注册事务
│   │   ├── rdb-provider.ts            # 扩展合同（Auth 由 Better Auth Prisma adapter，域数据走 RdbProvider）
│   │   └── prisma-schema-parity.test.ts  # 扩展：新模型集合与 parity 断言
│   └── bootstrap/                     # 新增：post-install bootstrap 校验（fail closed，不自建 admin）
└── app/
    ├── (auth)/login、register、account/  # 新增登录/注册/账户设置页
    ├── _components/                   # Team switcher、Team Settings、Team Members、i18n copy
    └── api/
        ├── auth/                      # Better Auth handler 挂载 + Mystra 账户操作
        ├── teams/                     # Team lifecycle + switch active team
        └── teams/[teamId]/members/    # 成员与角色管理

packages/shared/src/
├── auth.ts        # 新增：username 规范化/校验合同、账户 payload、session 视图（不泄漏 Better Auth 类型）
├── team.ts        # 新增：Team、Membership、Role、Permission、active-team Zod 合同
└── index.ts       # 导出

apps/runner-daemon / CLI / MCP 适配层复用同一 `@mystra/shared` 合同与服务端判定。
```

**Structure Decision**：沿用既有 `apps/control-plane`（Next.js 控制面 + `src/lib` 领域库 + Prisma 双库）与 `packages/shared`（Zod 合同）单仓多包结构。Auth 引擎（Better Auth）装配在 `src/lib/auth`，RBAC 领域与判定在 `src/lib/rbac`，二者都只对外暴露 `@mystra/shared` 合同类型。数据持久化仍统一在 Prisma/`RdbProvider` 之后，保持 provider parity。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 向 Prisma schema 新增 6 张 Auth/RBAC 表 | 043 的身份与授权关系数据必须由 Prisma 拥有 schema/migration（FR-044），无法在不落表的情况下提供登录、初始 Team 与服务端 RBAC | 把身份数据放到 Better Auth 自管理的旁路或 raw SQL 会绕过 Prisma migration history（违反 FR-044），并破坏 SQLite/PostgreSQL parity 与 `RdbProvider` 边界 |
| 引入 Better Auth 作为第三方 Auth 引擎依赖 | spec FR-041 明确要求使用 Better Auth 稳定版承载 username/password + session，避免自研认证原语 | 自研 session/password 栈会重复实现暴力破解防护、session fixation/replay/CSRF 保护（FR-015），风险与维护成本更高 |

## 计划评审（Plan Review Gate）待办

进入 `/speckit.tasks` 前建议执行 `plan-eng-review`，重点复核：Better Auth 无 email 装配的可行性（research R1 的残余风险）、原子注册事务同时覆盖 Better Auth account 与 Mystra 域表的事务边界、以及 last-owner/last-active-team 不变量的并发安全。
