# Quickstart：本地用户、Team 与 RBAC

> 本文件是 043 的实现/验证快速上手。

## 前置检查（SC-013，实现启动门）

1. **040 已合入 `main`**（FR-050）：`integration_connections/projects/tasks/secret_envelopes` 的 Prisma 双库 provider 在 `main` 可用。
2. **constitution/5xP 修订**（FR-051）：**已完成** —— constitution v2.7.0（2026-08-07）已把 self-host 单机人类认证 + Team RBAC 纳入范围，撤销旧的 caller auth/Team administration 排除项；AGENTS/PRODUCT/PLATFORM 已同步。SaaS/hosted multi-tenancy 仍在本仓库范围外。

向 Prisma schema 新增 Auth/RBAC 表属 043 功能范围内的常规设计，走 spec/plan Owner 评审，不是独立审批门。

## 运行时环境

```sh
# 运行时（Node 24.14.0 + pnpm 10.25.0）
fnm use 24.14.0 || nvm use
corepack use pnpm@10.25.0

# 选择 RDB profile（SQLite 默认 / PostgreSQL / Supabase-backed PostgreSQL）
# 复用 040 的 RDB 连接与 migration 配置约定（apps/control-plane/src/lib/db/rdb-config.ts）
```

本地认证不需要第三方认证服务密钥。040 的 SecretProvider KEK 仍在 RDB 之外，不入库、不入日志。

## 数据库迁移（Prisma 拥有，FR-044）

```sh
# 分别对 sqlite 与 postgresql schema 生成/应用 migration；两 schema 的 model 段必须字节一致
pnpm --filter @mystra/control-plane prisma:migrate  # 项目既有脚本约定
```

## 首次进入（消费 bootstrap，非自建）

```sh
# 开发便利：运行文档化的一次性 bootstrap 脚本（模拟 installer，独立于应用启动）
# 产出 admin/admin + 初始 Team + Owner membership + requirePasswordChange
# 详见 contracts/bootstrap-contract.md
```

- 打开应用 → 进入登录页（未认证访问受保护 route 被引导登录）。
- `admin/admin` 登录 → 强制改密 → 改密后访问 Team 资源。
- 空库（无 User）→ 应用报告 `installation-incomplete` 并 fail closed，不自建 admin。

## 关键验证场景（映射 spec Acceptance / SC）

| 场景 | 期望 | 依据 |
|---|---|---|
| 首次访问受保护页 | 100% 进入登录页 | SC-001 |
| `admin/admin` 登录 | 访问 Team 数据前 100% 强制改密 | SC-001 |
| 新用户注册 | User+初始 Team+Owner membership+session 全成或全无；每 active User 至少属于 1 个 active Team | SC-002 |
| 并发/重复注册（同规范化 username） | 至多创建 1 个 User/Team，其余稳定 409，无孤儿 | US1 场景 7 |
| 改密 | 旧密码登录成功数=0，其他旧 session 成功请求数=0 | SC-003 |
| 切 Team | 刷新后 active 保持；无权/停用/归档 Team 恢复为 active 次数=0 | SC-004 |
| 初始 Team 同构 | 可改名/加人/转移 Owner/删除；使某 User 变为零 Team 的删除或退出成功数=0 | SC-005 |
| 删除 Team | 成员仍有其他 active Team 时可归档；某 User 唯一 active Team 删除成功数=0 | SC-006 |
| 成员与角色 | 一页完成加/删/设 Owner/Admin/Member；重复加、未知 username、last-owner 冲突稳定 | SC-007 |
| 授权一致性 | API/MCP/CLI/Web 结果一致率 100%；跨 Team 与撤销 membership 100% fail closed | SC-008 |
| 无 email | User schema/注册登录 payload/成员 UI/恢复表面 email 字段与必需依赖计数=0 | SC-009 |
| 无 SSO/Agent key/强因子 | 可执行登录入口/route/配置/依赖中相关实现计数=0 | SC-010 |
| 双库 parity | SQLite 与真实 PostgreSQL 跑同一 contract suite 核心场景 100%；schema parity 无未记录差异 | SC-011 |
| 响应式/键盘 | 登录/注册/Account/switcher/Team Settings/Members 在 320/768/1024/1440px 与键盘下无不可达主操作、无页面级横滚 | SC-012 |

## 测试命令（延续既有）

```sh
pnpm typecheck
# schema parity（9 个 model）
pnpm --filter @mystra/control-plane test prisma-schema-parity
# Auth/Team/RBAC contract suite：SQLite + 真实 PostgreSQL 各一遍
pnpm --filter @mystra/control-plane test
```

## i18n / a11y

Account、Team、Team Members、Roles Settings 支持英语与简体中文，键盘/焦点/错误播报/窄屏重排（FR-049）。未实现能力（email recovery 等）显示明确 unavailable，不留隐藏入口（FR-016）。

## Local-auth 无 email 装配（已实施，research R1/R9）

Better Auth `username` plugin 的 spike 证明其强制 email/emailVerified，不能满足 FR-008；实现改用 Mystra-owned local-auth。密码使用版本化 Node `crypto.scrypt` 记录，session 使用随机 opaque token 的 SHA-256 digest；不派生、不占位、不存储 email。
