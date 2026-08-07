# 合同：Team 生命周期与 active context（Team API）

**Boundary**: Web API 权威；CLI/MCP 薄适配。Team ID 是租户边界，授权解析只用 ID 不用 display name（边界）。所有操作服务端解析 User + active Team context + 目标资源 + effective permission（FR-038）。

## 共享合同（`packages/shared/src/team.ts`）

```text
TeamStatus    : "active" | "archived"
TeamRole      : "owner" | "admin" | "member"
TeamView      : { id, displayName, status, currentUserRole }
TeamListItem  : { id, displayName, isActive, currentUserRole }
CreateTeam    : { displayName: string(1..N) }
RenameTeam    : { displayName: string(1..N) }
SwitchTeam    : { teamId: string }
```

## 端点

| 方法 & 路径 | 权限 | 说明 |
|---|---|---|
| `GET /api/teams` | 已认证 | 列出当前 User 的 active memberships 对应 Team；标识 current（FR-020）。只列 active（FR-020/R7）。|
| `POST /api/teams/switch` | 已认证成员 | 设置 `auth_sessions.active_team_id`；服务端校验目标 Team `active` 且 membership `active`，否则 fail closed（FR-021）。|
| `POST /api/teams` | 已认证 | 创建 Team，创建者原子成为 `owner`（FR-022）；返回后提供明确进入/切换动作。|
| `PATCH /api/teams/{teamId}` | `team.settings.manage`（Owner） | 改 display name（FR-023）。|
| `DELETE /api/teams/{teamId}` | `team.delete`（仅 Owner，FR-026） | 归档删除 Team：置 `status=archived`+`archived_at`，从所有成员 switcher 移除，不级联硬删（FR-024/R7）。|

## active Team 解析中间件（每请求）

1. 解析 session → `active_team_id`。
2. 校验 Team `status=active` 且当前 User membership `status=active`。
3. 失败 → 回退到另一个有效 Team 或要求显式选择；不使用客户端缓存继续授权（FR-021/FR-027）。

## 不可删除规则（FR-025，返回稳定原因）

- 该 Team 是当前 User 唯一 active Team → `delete-forbidden: last-active-team`。

## 当前 Team 失效（FR 场景 US2-8）

当前 active Team 被他人删除或本人 membership 被移除时，下一请求切到另一个有效 Team 或要求选择，不继续使用失效 context。
