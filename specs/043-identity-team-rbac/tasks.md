# 任务：开源本地用户、Team 与 RBAC

**Feature**: `043-identity-team-rbac`  
**前置已满足**: 040 Prisma RDB 已在 `main`；constitution 已允许 self-host local auth 与 Team RBAC。  
**关键决策**: Better Auth 1.6.26 username plugin 强制 email，违反 FR-008；实现采用 research R1/R9 的 Mystra local-auth。

## 依赖图

```text
shared contracts + Prisma schema/migrations
                 │
                 ▼
       RdbProvider + local-auth/RBAC services
                 │
         ┌───────┴────────┐
         ▼                ▼
  API/MCP/CLI guards    Web account/Team UI
         └───────┬────────┘
                 ▼
          parity + integration verification
```

## Phase 1: Persistence and contracts

- [x] T001 [P1] 定义 `packages/shared/src/auth.ts` 与 `team.ts` 的 username、password、session、Team、membership、role 和 permission Zod contracts，并从 `index.ts` 导出。  
  **验收**: 不含 email；username 规范化在任意入口相同；无效 payload 被拒。  
  **验证**: shared unit tests。

- [x] T002 [P1] 同步扩展 SQLite/PostgreSQL Prisma schema：新增 `User`、`AuthAccount`、`AuthSession`、`Team`、`TeamMembership`；为 `IntegrationConnection`、`Project`、`Task` 增加 required `teamId` relation；生成双库 migration 与 client。  
  **验收**: model 段 byte-identical，9 个模型，所有资源可按 Team 关联。  
  **验证**: `pnpm --filter @mystra/control-plane db:validate`、schema parity test。

- [x] T003 [P1] 扩展 Prisma delegate wrapper、mapper、`RdbProvider` 与 SQLite/PostgreSQL contract suite，提供事务化注册、session、Team 和成员操作，并对 `P2034` 归一为 stable conflict。  
  **验收**: 并发重复 username 不产生孤儿记录；最后 Owner/最后 active Team 受保护；资源查询有 Team filter。  
  **验证**: SQLite 与 PostgreSQL provider tests。

## Checkpoint: persistence

- [x] T004 验证 T001-T003：SQLite parity、migrations、RdbProvider contract tests 全绿；真实 PostgreSQL suite 仍需在配置 `MYSTRA_TEST_POSTGRES_URL` 的环境运行。

## Phase 2: Authentication and authorization

- [x] T005 [P1] 实现 `src/lib/auth`：版本化 `crypto.scrypt` credential、constant-time verify、opaque session token digest、cookie/Bearer extraction、login throttling、bootstrap read-only guard 与 password-change gate。  
  **验收**: token/password 不入 response/log；cookie flags 正确；默认 password change 只放行最小安全端点。  
  **验证**: auth unit and route tests。

- [x] T006 [P1] 实现 `src/lib/rbac`：role matrix、active Team fallback、permission guard、跨 Team existence-hiding 与成员/Team lifecycle invariants。  
  **验收**: Owner/Admin/Member 结果符合 catalog；失效 membership/archived Team 在下一请求 fail closed。  
  **验证**: RBAC contract tests including contention/error paths。

- [x] T007 [P1] 实现 auth/account/Team/member APIs，并以 T005/T006 guard 覆盖既有 projects/tasks/integration-connections routes。  
  **验收**: 所有管理 API 均要求 human session 与 Team context；Team 不匹配返回 stable forbidden。  
  **验证**: route integration tests。

## Phase 3: CLI, MCP and Web

- [x] T008 [P1] 为 operator CLI 增加 human login/logout/session storage（0600）及 Team context 发送；MCP 验证 Bearer session 后按 active Team 执行工具。  
  **验收**: CLI/MCP 不创建 Agent key；同一 role 在 API/CLI/MCP 获得相同 allow/deny。  
  **验证**: CLI and MCP contract tests。

- [x] T009 [P1] 实现登录、注册、首次改密、账户设置、Team switcher、Team Settings/Members 页面和可访问状态。  
  **验收**: 未认证进入登录；无 email 表单；成员页包含 loading/empty/error/forbidden/conflict。  
  **验证**: component and browser acceptance tests。

## Phase 4: Delivery evidence

- [x] T010 [P1] 更新 quickstart、contracts、checklists、Spec View 与完成状态，执行安全审计、双库 contract suite、全量 typecheck/test、code review。  
  **验收**: 所有 FR/SC 有对应测试或明确证据；无遗留 Better Auth/email 型实现引用。  
  **验证**: `pnpm typecheck`、`pnpm test`、`pnpm audit`、targeted PostgreSQL tests、`git diff --check`。

## Not in scope

- Hosted OAuth/SSO、email recovery、Agent/workload identity、custom roles、Project-scoped roles、installer/seed orchestration，均保留既有排除边界。
