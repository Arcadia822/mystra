# Phase 0 研究：本地用户、Team 与 RBAC

**Date**: 2026-08-07
**Baseline**: `main`（含已合入的 040 Prisma RDB 与 041）
**Scope**: 解决 043 计划中的技术未知项，为 data-model 与 contracts 提供决策依据。

---

## R1. 无 email 自托管认证装配

**Spike result (2026-08-07)**：Better Auth `1.6.26` 的发布类型定义证实 `username` plugin 的 User 与 database hook 合同强制 `email`、`emailVerified`。这与 FR-008 直接冲突，且 R1 禁止派生或占位 email。

**Decision**：保留无 email 产品边界，使用 Mystra-owned local authentication：username/password credential 以 Node `crypto.scrypt` 的版本化参数、每账户随机 salt 与 digest 保存；session 使用随机不透明 token 的 SHA-256 digest 保存。浏览器通过 httpOnly cookie、CLI/MCP 通过同一 human session 的 Bearer presentation。所有对外合同只暴露 `@mystra/shared` 类型。

**Alternatives considered**：
- 保留 Better Auth 并存储占位 email：被拒，违反 FR-008。
- 引入带 email 模型的其他认证框架：被拒，不能满足无 email 数据模型。

---

## R2. Prisma 拥有 local-auth schema 与 migration

**Decision**：`User`、`AuthAccount`、`AuthSession` 作为 Prisma model 定义在 `apps/control-plane/prisma/{sqlite,postgresql}/schema.prisma` 内，并由 Prisma Migrate 生成 migration。认证运行时只经 `RdbProvider` 读写，不使用独立连接或自带迁移器（FR-044）。为避免与 040 已删除的 Mystra 执行 `sessions` 概念混淆，认证 session 物理表命名为 `auth_sessions`。

**Rationale**：单一 schema owner 保证 SQLite/PostgreSQL 双库 migration history 一致、parity 断言可覆盖（FR-045），并让 Auth 表与域表处于同一事务/连接池（支撑 R4 原子注册）。

**Alternatives considered**：
- 认证库自带 CLI 生成/迁移其表：被拒，会绕过 Prisma migration history（违反 FR-044），且难以纳入现有 `prisma-schema-parity.test.ts`。

---

## R3. Permission / Role / RoleBinding 的物理落地

**Decision**：区分逻辑模型与物理落地。
- **Permission catalog**：代码级稳定常量（machine-readable kebab-case 字符串），不建数据库表。首期至少含 `team.settings.manage`、`team.member.manage`、`team.role.manage`、`team.delete`、`team.resource.access`（见 contracts/permission-catalog.md）。
- **Role**：首期固定 3 个内建角色 `owner | admin | member`，以代码枚举 + role→permission 静态矩阵表达，不建 `roles` 表。
- **RoleBinding**：因 FR-034“一个 membership 首期只有一个 active Team Role”，将 role 反规范化为 `team_memberships.role` 列，不建独立 `role_bindings` 表。

**Rationale**：遵循仓库既定哲学“数据库没有必要提前表演企业架构”（040 data-model）。首期没有自定义 Role、Project-scoped Role 或多角色需求（Extension-ready only），代码级目录 + membership.role 列即可满足服务端一致判定（FR-033/FR-038），且天然跨 SQLite/PostgreSQL 同构。

**Extension seam**：未来自定义 Role / Project-scoped Role 时，将 Permission/Role 提升为表并把 `team_memberships.role` 迁移为 `role_bindings` 关系；届时以独立规格与 migration 处理（0.1.0 后遵循迁移纪律）。

**Alternatives considered**：
- 直接建 permissions/roles/role_bindings 三表并 seed：被拒，首期为固定值，增加 seed/parity 复杂度而无当期收益。

---

## R4. 原子注册与初始 Team 事务

**Decision**：注册与 bootstrap 消费都在**单一数据库事务**内创建 User、本地 credential account、初始 Team、Owner membership（role=owner）、初始 session；任一步失败整体回滚（FR-009/FR-018/SC-002）。事务经 Prisma `$transaction` 执行。并发/重复注册通过规范化 `username` 唯一约束串行化，冲突返回稳定错误，不留孤儿 Team/membership（FR-007 场景 7 / SC-002）。

**Rationale**：满足“要么全部成功要么全部不存在”的可测成功标准，并用 DB 唯一约束而非应用锁保证并发正确性与 provider parity。

**安全验证**：必须覆盖 scrypt 参数、随机 salt、constant-time password comparison、token digest、session revocation、cookie flags、Bearer 仅限同一 human session、login rate limit 与 CSRF/origin 边界。

---

## R5. Username 规范化与大小写不敏感唯一（跨库 parity）

**Decision**：在 `@mystra/shared` 定义稳定的 username 合同：trim → Unicode 规范化 → 小写折叠 → 长度/字符集/保留字校验（FR-014）。数据库存储**已规范化的**小写 `username` 列并施加普通 `@unique`；presentation 用 `display_username` 保存原始大小写。规范化在应用层完成，DB 只做普通唯一比较，从而在 SQLite 与 PostgreSQL 上得到一致的大小写不敏感唯一，不依赖 `COLLATE NOCASE` / `citext` 等库特定行为（FR-045）。

**Rationale**：应用层规范化 + 普通唯一约束是保证双库同构最稳妥的方式；避免依赖各库 collation 差异导致的 parity 漂移。

**Alternatives considered**：
- SQLite `COLLATE NOCASE` + Postgres `citext`：被拒，两库行为与 Unicode 折叠范围不同，违反“parity 无未记录差异”（SC-011）。

---

## R6. Active Team context 的持久化与 fail-closed 回退

**Decision**：active Team 保存在 `auth_sessions.active_team_id`（nullable FK → teams）。每个受保护请求：解析 session → 读取 active_team_id → 服务端校验该 Team `status=active` 且当前 User 存在 `status=active` 的 membership；任一不满足即 fail closed 并回退到该 User 的另一个有效 Team，或要求显式选择（FR-021/FR-027/SC-004）。Team 归档或 membership 失效后，下一请求不得凭客户端缓存继续授权。

**Rationale**：服务端每请求重新解析权限满足 FR-038“隐藏按钮不能替代 enforcement”与 role 变更“对新请求立即生效”（FR-035）。将 active 上下文放 session 行使其可撤销、可随 session 生命周期清理。

---

## R7. Team 删除 = 可审计归档

**Decision**：用户可见“删除 Team”实现为 `teams.status=archived` + `archived_at` 时间戳，不做级联硬删除；历史 Project/Task/Session 保留其 team 引用以维持可追溯（FR-024/边界）。某 User“当前唯一 active Team”永不可删、不可退出，以保证每 User 至少一个 active Team（FR-017/FR-025）。归档 Team 从所有成员 switcher 消失（switcher 只列 active membership 到 active Team）。

**Rationale**：与既有对象（Project/Task）的 `archived_at` 归档模式一致（见 `projects.archived_at`），避免破坏历史业务归属。

---

## R8. Bootstrap 消费与 fail-closed（不自建 admin）

**Decision**：043 只消费外部 installer 产出的 post-install 状态（`admin` User + 初始 password `admin` + 初始 Team（默认 display name 如 `Default`）+ Owner membership + `requirePasswordChange=true`），定义其 contract（contracts/bootstrap-contract.md）。应用启动时执行只读校验：若身份 schema 已就绪但缺少任何有效 User，则 fail closed 并报告 installation incomplete，**绝不**在空库时静默创建 `admin/admin`（FR-002/FR-004）。默认 `admin` 首次登录被强制进入改密流程，改密前只放行最小账户安全操作（FR-003）。开发环境提供文档化的手动/脚本 bootstrap（非应用运行时自建），供本地首次进入。

**Rationale**：把“已知弱默认凭据”的安全责任落在强制改密 + 明确安装契约上，避免运行时隐式建管理员这一横切风险。

---

## R9. Password hashing

**Decision**：使用 Node `crypto.scrypt`（N=32768、r=8、p=1、maxmem=64 MiB）配每账户随机 16-byte salt，输出 64-byte key；记录算法版本与参数，并用 `timingSafeEqual` 比较等长 digest。系统不保存、记录或返回明文（FR-013）。依据：[Node.js crypto.scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)。

**Rationale**：在无 email 认证库冲突的条件下，Node 标准库提供可审计的 memory-hard KDF，且不增加认证数据模型或运行时依赖。

---

## 决策汇总

| 编号 | 决策 | 关键约束 |
|---|---|---|
| R1 | Mystra local-auth，scrypt + opaque session，完全无 email | FR-008/FR-041/SC-009 |
| R2 | Auth 表由 Prisma 定义与迁移，session 物理表名 `auth_sessions` | FR-044/FR-045 |
| R3 | Permission/Role 代码级目录，role 反规范化到 `team_memberships.role` | FR-032/FR-033/FR-034 |
| R4 | 单事务原子创建 User/初始 Team/owner-membership/session | FR-009/FR-018/SC-002 |
| R5 | 应用层 username 规范化 + 普通唯一约束保证双库同构 | FR-006/FR-014/SC-011 |
| R6 | active_team_id 存 session，每请求服务端校验并 fail-closed 回退 | FR-021/FR-038/SC-004 |
| R7 | Team 删除=归档（status/archived_at），唯一 Team 不可删/不可退出 | FR-024/FR-025 |
| R8 | 只消费外部 bootstrap，空库 fail closed，不自建 admin | FR-002/FR-004 |
| R9 | Node scrypt 版本化参数 + 随机 salt，无明文落地 | FR-013 |

## 未决 / 需实现前解决的前置

1. **已解决 spike**：Better Auth 无 email 不可行，已保留 FR-008 并按 R1/R9 改用 Mystra local-auth。
2. **治理前置**：constitution/5xP 的 self-host caller auth + Team administration 排除项已修订解决（Principle I / FR-051 满足）；040 已在 `main`（FR-050 满足）。
