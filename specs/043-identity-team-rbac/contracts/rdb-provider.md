# 合同：RdbProvider / 持久化边界扩展

**原则**：身份与授权关系数据由 Prisma 拥有 schema/migration/runtime access（FR-044）。Auth 与 RBAC 域数据均经 `RdbProvider`/`PrismaRdbProvider`，因此注册能在单一事务内完成。运行时业务路径禁止 `$queryRaw`/`$executeRaw`/`pg.query`/直接 `better-sqlite3`（延续 040）。Prisma generated types 不越过 persistence boundary。

## Local-auth 装配（`src/lib/auth`）

- `User`、`AuthAccount` 与 `AuthSession` 是 Prisma models，物理表为 `users`、`auth_accounts`、`auth_sessions`。
- 使用 Node `crypto.scrypt` 的版本化 hash 记录与随机 session token 的 SHA-256 digest；只保存 salt、hash、token digest 和生命周期元数据。
- `displayName`、`status`、`requirePasswordChange` 存于 `users`；`activeTeamId` 存于 `auth_sessions`。
- 对外只暴露 `@mystra/shared` 的 `AccountView`/`SessionView`。

## `RdbProvider` 新增域方法（Mystra-owned RBAC）

```text
# 原子注册 / bootstrap 消费（单事务，research R4）
registerLocalUser(input): { user, initialTeam, ownerMembership, session }
  # 事务内：创建 User + AuthAccount(credential) + Team
  #        + TeamMembership(owner/active) + AuthSession；任一失败整体回滚（FR-009/FR-018）

# Team lifecycle
createTeam(userId, displayName): { team, ownerMembership }
renameTeam(teamId, displayName)
archiveTeam(teamId)                    # status=archived + archived_at（FR-024）
listActiveTeamsForUser(userId): TeamListItem[]   # 只 active membership→active team
getTeamContext(userId, teamId): { team, membership, role } | null

# active Team context
setActiveTeam(sessionId, teamId)       # 校验后写 auth_sessions.active_team_id
resolveActiveTeam(sessionId): { team, role } | fallbackToAnotherOrSelect

# 成员与角色
listMembers(teamId): MemberView[]
addMemberByUsername(teamId, username)  # not-found / conflict 稳定结果
setMemberRole(teamId, userId, role)    # 受 last-owner 不变量
removeMember(teamId, userId)           # 移除/停用，受保护不变量

# 查询辅助
countActiveTeamsForUser(userId): number  # 支撑 last-active-team 保护
countActiveOwners(teamId): number      # 支撑 last-owner 保护
```

## 事务与不变量归属

以下不变量在 provider 事务内强制（data-model「服务层强制的业务不变量」）：
- 原子注册一致性；每 Team ≥1 有效 Owner；每 User ≥1 active Team；唯一 Team 不可删/不可退出；active Team 有效性；username 规范化唯一（DB 唯一约束为最终屏障）。
- 并发正确性优先依赖 DB 唯一约束（`users.username`、`team_memberships.(team_id,user_id)`），而非应用锁，以保证 provider parity。

## Provider parity 测试扩展

- `prisma-schema-parity.test.ts` 的模型集合断言更新为 9 个 model（4 既有 + 5 新增）。
- Auth/Team/RBAC contract suite 在 SQLite 与真实 PostgreSQL 上各跑一遍（SC-011）。
- Supabase 复用 PostgreSQL client/provider，仅改连接 profile（FR-043）。

## 明确不做

- 不向外提供无约束通用表管理 API（延续 040）。
- 不建 `roles`/`permissions`/`role_bindings` 表（research R3）。
- 不实现 AgentPrincipal/Agent key/Workload identity 的 provider 方法（FR-048）。
