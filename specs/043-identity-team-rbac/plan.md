# 实施计划：开源本地用户、Team 与 RBAC

**Branch**: `043-identity-team-rbac`（Owner 要求在 `main` 上更新 043 artifacts；Spec-Kit 命令须显式设置 `SPECIFY_FEATURE=043-identity-team-rbac`） | **Date**: 2026-08-07 | **Spec**: [spec.md](spec.md)
**Input**: `specs/043-identity-team-rbac/spec.md`

## Summary

043 为开源自托管 Mystra 引入从登录页开始的 username/password 人类身份、每 User 注册时自动获得一个由自己拥有的初始 Team、Team 生命周期与切换，以及 Owner/Admin/Member 三角色的服务端 RBAC。技术路径：Mystra-owned local authentication 使用 Node `crypto.scrypt`、随机不透明 session token 与 Prisma；Team、TeamMembership 及内建 Role/Permission 目录是 Mystra-owned 领域模型。`IntegrationConnection`、`Project`、`Task` 显式归属 Team，SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 通过 byte-identical schema parity 保证同构。Web、API、MCP 与 CLI 使用同一 human session 与权限判定。

本计划已完成 Phase 0/1 与工程评审；`tasks.md` 负责后续可验证实现分解。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.x（`@prisma/adapter-better-sqlite3` / `@prisma/adapter-pg`）、Node `crypto.scrypt`（见 research R9）
**Storage**: 选择型 SQLite / PostgreSQL / Supabase-backed PostgreSQL，统一在 `RdbProvider` 之后；Prisma 双 datasource + 独立 migration history + byte-identical model parity
**Testing**: Vitest 4；Auth/Team/RBAC contract suite 需在 SQLite 与真实 PostgreSQL 上跑通；schema parity 断言扩展现有 `prisma-schema-parity.test.ts`
**Target Platform**: 单机自托管 Web 控制面（`apps/control-plane`）+ 薄 CLI/MCP 适配
**Project Type**: Web application（Next.js 控制面 + 服务端领域库 + 共享 Zod 合同包）
**Performance Goals**: 交互目标来自 spec SC（切 Team ≤30s、改 password/display name ≤60s 为体验上限，非吞吐指标）；权限判定是请求内同步解析，无额外网络往返
**Constraints**: self-host 不引入 email（FR-008/SC-009）；password/session token/bootstrap secret 不得进入 URL/日志/公共响应/证据；应用运行时不得因空库自建 `admin/admin`（FR-004）；local-auth internals 不得越过公共合同（FR-041）；服务端 fail-closed 授权；SQLite/PostgreSQL 逻辑模型一致（FR-045）
**Scale/Scope**: 单机自托管少量 Team 与 User；首期固定 3 内建角色、单一 active role/membership；无自定义 Role、无 Project-scoped Role

## Constitution Check

*GATE：Phase 0 前必须评估，Phase 1 后复检。*

Constitution v2.7.0 相关约束与本计划的对齐：

| 约束 | 状态 | 说明 |
|---|---|---|
| II. Typed Contracts at Service Boundaries | PASS | 新增 Auth/Team/RBAC 全部通过 `@mystra/shared` Zod + TS 合同暴露；local-auth 与 Prisma generated types 不越过 persistence/service boundary（FR-041/FR-044）。|
| III. Providers Are Replaceable Boundaries | PASS | 身份/授权关系数据继续走 `RdbProvider` 与 Prisma；SQLite/PostgreSQL/Supabase 同构，Supabase 仍是 PostgreSQL profile，不引入 Supabase Auth/Data API 旁路（FR-043）。不新增 WorkflowProvider。|
| V. Verification & Documentation Before Delivery | PASS（计划层） | 计划要求 contract 测试 + 双库 parity + 双库 contract suite 作为交付证据（SC-008/SC-011）。|
| 040 amendment：第一期 Prisma 只 3 张业务表 + SecretEnvelope | PASS | 040 的“实现任务和代码不得自行扩表”约束的是 040 自身实现，不是对后续新功能的封锁。043 是新功能，通过自己的 spec/plan/data-model 正常引入 Auth/RBAC 模型集合，走常规 Owner 评审即可，不构成独立扩表审批门。实现时同步更新 `prisma-schema-parity.test.ts` 的模型集合断言。|
| I. Specification Owns Product Boundaries：caller auth / Team authorization 属 hosted-only 前置 | **RESOLVED（2026-08-07 amendment）** | constitution 已修订 Principle I：self-host 单机人类 username/password 认证与 Owner/Admin/Member Team RBAC 进入范围（043 owns contract）；hosted 多租户 caller 身份联邦、caller-login OAuth(SSO/social)、managed secrets、hosted Team administration、public multi-tenancy 仍排除。5xP（AGENTS/PRODUCT/PLATFORM）已同步。FR-051 前置满足。|

**Gate 结论**：Phase 0/1 设计产物与工程评审均已完成。self-host caller auth + Team RBAC 的边界冲突已由 constitution 修订解决（FR-051 满足），040 已合入 `main`（FR-050 满足）。向 Prisma schema 新增 Auth/RBAC 表及既有资源 Team FK 属 043 功能范围内的常规设计。

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
│   ├── auth/                          # 新增：scrypt、credential、session、username 规范化、activeTeam 解析
│   ├── teams/                         # 新增：Team lifecycle、active-team context
│   ├── rbac/                          # 新增：Permission catalog、role→permission 矩阵、服务端 enforcement、last-owner/last-active-team 不变量
│   ├── db/
│   │   ├── prisma-provider.ts         # 扩展：Team/Membership CRUD + 原子注册事务
│   │   ├── rdb-provider.ts            # 扩展合同（Auth 与 RBAC 均经 RdbProvider）
│   │   └── prisma-schema-parity.test.ts  # 扩展：新模型集合与 parity 断言
│   └── bootstrap/                     # 新增：post-install bootstrap 校验（fail closed，不自建 admin）
└── app/
    ├── (auth)/login、register、account/  # 新增登录/注册/账户设置页
    ├── _components/                   # Team switcher、Team Settings、Team Members、i18n copy
    └── api/
        ├── auth/                      # 登录、注册、session 与 Mystra 账户操作
        ├── teams/                     # Team lifecycle + switch active team
        └── teams/[teamId]/members/    # 成员与角色管理

packages/shared/src/
├── auth.ts        # 新增：username 规范化/校验合同、账户 payload、session 视图
├── team.ts        # 新增：Team、Membership、Role、Permission、active-team Zod 合同
└── index.ts       # 导出

apps/runner-daemon / CLI / MCP 适配层复用同一 `@mystra/shared` 合同与服务端判定。
```

**Structure Decision**：沿用既有 `apps/control-plane`（Next.js 控制面 + `src/lib` 领域库 + Prisma 双库）与 `packages/shared`（Zod 合同）单仓多包结构。Local-auth 装配在 `src/lib/auth`，RBAC 领域与判定在 `src/lib/rbac`，二者都只对外暴露 `@mystra/shared` 合同类型。数据持久化仍统一在 Prisma/`RdbProvider` 之后，保持 provider parity。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 向 Prisma schema 新增 5 张 Auth/RBAC 表，并为 3 张租户资源加 Team FK | 043 的身份与授权关系数据必须由 Prisma 拥有 schema/migration，且 Team 必须成为实际资源边界 | 拆出匿名 API 或把 Team 仅作为 UI 分组会绕过 RBAC，破坏租户隔离 |
| Mystra-owned local-auth | Better Auth username plugin 强制 email，不能满足 FR-008；标准库 scrypt 无新增身份数据模型 | 认证逻辑必须以 focused security/contract tests 覆盖，不能把安全假设委托给不可用的引擎 |

## 工程评审结论（2026-08-07）

1. Better Auth 1.6.26 username plugin 强制 email/emailVerified；保留 FR-008，改用 research R1/R9 定义的 local-auth。
2. `IntegrationConnection`、`Project`、`Task` 必须带 `team_id`，并将现有 API、MCP、CLI 的匿名调用改为 human session + active Team context；否则 FR-038 无法成立。
3. CLI/MCP 使用同一人类 session token 的 Bearer presentation，不引入 Agent key 或 workload identity。
4. 事务冲突（Prisma `P2034`）对调用方归一为稳定 conflict，客户端可重试，不在服务端隐式重放可能含外部副作用的操作。

进入 `/speckit.tasks` 的评审门已满足；任务必须先实现 schema/provider/auth foundation，再逐步接入所有管理表面。
