# 合同：本地认证与账户（Auth API）

**Boundary**: Web API 是权威实现；CLI/MCP 是薄适配层，复用同一 `@mystra/shared` Zod 合同与服务端判定（constitution）。Mystra local-auth internals 不越过此边界（FR-041）。所有 payload 不含 email（FR-008）。password/session token/bootstrap secret 不进入 URL/日志/公共响应/证据。

## 共享合同（`packages/shared/src/auth.ts`）

```text
UsernameInput        : trim + Unicode 规范化 + 小写折叠；长度/字符集/保留字校验（FR-014）
RegisterRequest      : { username: UsernameInput, password: PasswordInput }
LoginRequest         : { username: UsernameInput, password: string }
ChangePasswordRequest: { currentPassword: string, newPassword: PasswordInput }
ChangeDisplayName    : { displayName: string(1..N) }
AccountView          : { id, username(displayUsername), displayName, status, requirePasswordChange }
SessionView          : { id, createdAt, expiresAt, current: boolean, ipAddress?, userAgent? }
```

`PasswordInput` 强制最小策略（长度等）；服务端以 Node `crypto.scrypt`、每账户随机 salt 与固定版本化参数生成 hash，比较使用 constant-time equality（FR-013，research R9）。

浏览器以 `HttpOnly; Secure; SameSite=Lax; Path=/` cookie 发送 session token；CLI/MCP 可使用同一人类 session token 的 `Authorization: Bearer` presentation。CLI token 仅存于用户本地受限权限文件，既不是 Agent key，也不是 workload identity（FR-048）。

## 端点

| 方法 & 路径 | 说明 | 关键规则 |
|---|---|---|
| `POST /api/auth/register` | 本地注册 | 只收 username+password；单事务原子创建 User+初始 Team+Owner membership+session（FR-009）。重复规范化 username → 稳定 409，无孤儿（FR 场景 7）。|
| `POST /api/auth/login` | 登录 | 成功建立可撤销 session 并恢复/选择有效 active Team（FR-010）。防枚举：用户名不存在与密码错误返回同一稳定失败语义（FR-015）。|
| `POST /api/auth/logout` | 退出当前 session | 撤销当前 session token。|
| `GET /api/auth/session` | 当前 session + 账户状态 | 返回 `AccountView` + 当前 `SessionView`；未认证 → 稳定 401。|
| `GET /api/auth/sessions` | 列出本人 active sessions | 标识 current。|
| `POST /api/auth/sessions/revoke` | 撤销指定 session | `{ sessionId }`；只能撤销本人 session。|
| `POST /api/account/password` | 改密 | 校验 currentPassword；成功后旧密码立即失效，除当前 session 外其他 session 默认撤销（FR-012）。|
| `POST /api/account/display-name` | 改 display name | 保存后 shell/成员列表/账户页一致 projection（FR-011）；username 不变。|
| `POST /api/account/deactivate` | 停用账户 | `status=disabled`；受最后 Owner 保护约束。|

## 强制改密门（FR-003）

`requirePasswordChange=true` 时，除 `GET /api/auth/session`、`POST /api/account/password`、`POST /api/auth/logout` 外，所有受保护端点返回稳定 `password-change-required` 结果，直到改密完成。

## 未实现能力（明确 unavailable，FR-016）

`email verification / email invitation / email password reset / 本地 recovery` 首期不提供；相关 UI 显示明确不可用状态，不提供隐藏入口。

## 错误语义

| 场景 | 结果 |
|---|---|
| 未认证访问受保护资源 | 稳定 `unauthenticated`（401），带安全 return destination 引导登录（FR-001/FR-039）|
| 已认证未授权 | 稳定 `forbidden`（403），不泄漏跨 Team 资源存在性（FR-039）|
| 登录失败（无此用户/密码错/停用/session 撤销） | 单一稳定失败，不区分、不枚举（FR-015）|
| DB 暂不可用 | fail closed，不产生半完成 User/Team/membership/session（边界）|
