# Phase 0 研究：本地用户、Team 与 RBAC

**Date**: 2026-08-07
**Baseline**: `main@10750ca`（含 039、041）+ 040 Prisma RDB（3 业务表 + SecretEnvelope，worktree 已实现，等待合入 `main`）
**Scope**: 解决 043 计划中的技术未知项，为 data-model 与 contracts 提供决策依据。

---

## R1. Better Auth × 无 email 自托管装配

**Decision**：采用 Better Auth 稳定版，仅启用 email/password 凭据引擎的 username 变体（username plugin）与 session 能力；关闭一切 email 相关能力（verification、reset、magic link、social/OAuth）。登录标识为规范化 `username`，凭据存于 Better Auth `account` 记录（`providerId = "credential"`）。Mystra 通过 Better Auth 的“附加字段（additional fields）”在 `user` 上挂 `displayName`、`status`、`requirePasswordChange`。所有对外合同只暴露 `@mystra/shared` 类型，Better Auth 类型不越界（FR-041）。

**Rationale**：Better Auth 稳定版对 username/password 与 session 提供成熟实现（含 session 过期、撤销、多 session、CSRF/origin 校验、暴力破解与枚举防护挂点），直接满足 FR-010/FR-015；username plugin 提供规范化的登录标识与 displayUsername/username 分离。

**残余风险（需实现首个 spike 验证）**：Better Auth 核心 `user` 传统上带 `email` 字段。FR-008/SC-009 要求 self-host User 模型 MUST NOT 要求、保存、推导或查询 email，目标计数为 0。实现的**第一个任务**必须做一次能力 spike，确认在目标 Better Auth 版本中可将 email 完全移除/置为非收集、非存储、非查询：
- 首选：配置使 username 成为唯一登录标识，`user` 表不含 `email` 列，注册/登录 payload 不含 email。
- 若目标版本硬依赖 email 列：视为 FR-008 冲突，**停止并上报 Owner**，在“换认证库”或“修订 FR-008 边界”之间做显式决策，不得用派生/占位 email 偷过（那会违反“MUST NOT 推导/保存”）。

**Alternatives considered**：
- 自研 password + session 栈：被拒。重复实现 FR-015 的全部安全挂点，风险高、与 spec FR-041 冲突。
- Lucia/自研 session：spec 已指定 Better Auth，不另择。

---

## R2. Prisma 拥有 Auth schema 与 migration（Better Auth 不绕过）

**Decision**：Better Auth 使用其 Prisma 适配层，所有 Better Auth 表（user/session/account/verification）作为 Prisma model 定义在 `apps/control-plane/prisma/{sqlite,postgresql}/schema.prisma` 内，并由 Prisma Migrate 生成 migration。运行时 Better Auth 通过 Prisma Client 读写，不使用独立连接或自带迁移器（FR-044）。为避免与 040 已删除的 Mystra 执行 `sessions` 概念混淆，Better Auth 的 session 物理表命名为 `auth_sessions`，account/verification 命名为 `auth_accounts`、`auth_verifications`，通过 Better Auth 的 modelName/field 映射对齐。

**Rationale**：单一 schema owner 保证 SQLite/PostgreSQL 双库 migration history 一致、parity 断言可覆盖（FR-045），并让 Auth 表与域表处于同一事务/连接池（支撑 R4 原子注册）。

**Alternatives considered**：
- Better Auth 自带 CLI 生成/迁移其表：被拒，会绕过 Prisma migration history（违反 FR-044），且难以纳入现有 `prisma-schema-parity.test.ts`。

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

**Decision**：注册与 bootstrap 消费都在**单一数据库事务**内创建 User、Better Auth credential account、初始 Team、Owner membership（role=owner）、初始 session；任一步失败整体回滚（FR-009/FR-018/SC-002）。事务经 Prisma `$transaction` 执行，Better Auth 的账户写入需纳入同一事务边界（依赖 R2 的同 Prisma Client）。并发/重复注册通过规范化 `username` 唯一约束串行化，冲突返回稳定错误，不留孤儿 Team/membership（FR-007 场景 7 / SC-002）。

**Rationale**：满足“要么全部成功要么全部不存在”的可测成功标准，并用 DB 唯一约束而非应用锁保证并发正确性与 provider parity。

**残余风险**：Better Auth 默认注册流程可能自带独立写入路径。实现需确认可在受控事务中调用其账户创建，或改为 Mystra 直接写入 credential account（沿用 Better Auth 的 hash 校验规则）。此点并入 R1 spike。

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

**Decision**：使用 Better Auth 内建的经过审查的自适应 password hashing 作为默认（稳定版默认 scrypt 参数；如目标版本支持 argon2id 配置则优先 argon2id）。系统不保存/记录/返回明文（FR-013）。具体算法与参数在 R1 spike 中随版本确认并记录到 quickstart。

**Rationale**：避免自研 KDF；沿用引擎默认可获得随版本更新的安全基线。

---

## 决策汇总

| 编号 | 决策 | 关键约束 |
|---|---|---|
| R1 | Better Auth username+session，无 email；首任务 spike 验证 email 可完全移除 | FR-008/FR-041/SC-009 |
| R2 | Auth 表由 Prisma 定义与迁移，session 物理表名 `auth_sessions` | FR-044/FR-045 |
| R3 | Permission/Role 代码级目录，role 反规范化到 `team_memberships.role` | FR-032/FR-033/FR-034 |
| R4 | 单事务原子创建 User/初始 Team/owner-membership/session | FR-009/FR-018/SC-002 |
| R5 | 应用层 username 规范化 + 普通唯一约束保证双库同构 | FR-006/FR-014/SC-011 |
| R6 | active_team_id 存 session，每请求服务端校验并 fail-closed 回退 | FR-021/FR-038/SC-004 |
| R7 | Team 删除=归档（status/archived_at），唯一 Team 不可删/不可退出 | FR-024/FR-025 |
| R8 | 只消费外部 bootstrap，空库 fail closed，不自建 admin | FR-002/FR-004 |
| R9 | Better Auth 内建自适应 hashing，无明文落地 | FR-013 |

## 未决 / 需实现前解决的前置

1. **R1/R4 spike**：目标 Better Auth 版本能否无 email 装配、并把账户写入纳入受控事务（实现第一任务；失败则上报 Owner）。
2. **治理前置**：constitution/5xP 的 self-host caller auth + Team administration 排除项已由 constitution v2.7.0（2026-08-07）修订解决（Principle I / FR-051 满足）。剩余启动检查项为 040 合入 `main`（FR-050）。（新增 Auth/RBAC 表属 043 功能范围内的常规设计，走 spec/plan Owner 评审，不是独立审批门。）
