# 合同：Team 成员与 RBAC（Membership API）

**Boundary**: Web API 权威；MCP/CLI/Web 对同一 User+Team+Role 的授权结果 100% 一致（SC-008）。客户端隐藏按钮不能替代服务端 enforcement（FR-038）。

## 共享合同（`packages/shared/src/team.ts`）

```text
MembershipStatus : "active" | "disabled"
MemberView       : { userId, username, displayName, role: TeamRole, status: MembershipStatus, allowedActions: string[] }
AddMember        : { username: UsernameInput }            # 按准确 username，不查 email（FR-030）
SetMemberRole    : { userId: string, role: TeamRole }
RemoveMember     : { userId: string }                     # 移除或停用
```

## 端点

| 方法 & 路径 | 权限 | 说明 |
|---|---|---|
| `GET /api/teams/{teamId}/members` | `team.resource.access`（成员） | 列出 display name、username、role、status 与操作者 allowedActions（FR-029）。提供 loading/empty/error/read-only/forbidden 等状态数据（FR-040）。|
| `POST /api/teams/{teamId}/members` | `team.member.manage` | 按准确 username 添加已有 User，创建唯一 membership（FR-030）。username 不存在 → 稳定 `not-found`；已是成员 → 稳定 `conflict`；均不建重复 membership（FR 场景 3）。|
| `PATCH /api/teams/{teamId}/members/role` | Owner→任意角色；Admin 受限 | 设置 `owner/admin/member`；对新请求立即生效（FR-035）。|
| `POST /api/teams/{teamId}/members/remove` | `team.member.manage` | 移除或停用普通成员；受最后 Owner 保护。|

## 角色能力边界（Admin vs Owner）

| 动作 | Owner | Admin | Member |
|---|:--:|:--:|:--:|
| 查看成员列表 | ✓ | ✓ | ✓ |
| 添加/移除/停用 Member | ✓ | ✓ | ✗ |
| 设置成员为 Admin | ✓ | ✗ | ✗ |
| 授予/移除/修改 Owner | ✓ | ✗（FR-031） | ✗ |
| 改 Team 设置/改名 | ✓ | ✗ | ✗ |
| 删除 Team | ✓（FR-026） | ✗ | ✗ |

Admin MUST NOT 修改 Owner、授予 Owner 或移除 Owner（FR-031）。

## 保护性不变量（服务端事务强制）

| 场景 | 结果 |
|---|---|
| 移除/停用/降级/退出最后一名有效 Owner | 拒绝，返回 `last-owner-protected`，需先产生另一名有效 Owner（FR-036）|
| 移除/退出会使某 User 失去其全部 active Team | 拒绝，返回 `last-active-team-protected`（FR-017/FR-025）|
| membership 被移除/停用后再次请求 Team 资源 | 立即失败，Team 从其 switcher 移除（FR 场景 US3-7）|
| 长时操作跨越 role/membership 变更 | 在外部副作用前重新确认权限（边界）|
