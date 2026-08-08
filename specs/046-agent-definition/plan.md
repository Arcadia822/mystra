# Implementation Plan: Agent 定义与管理面

**Branch**: `046-agent-definition` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/046-agent-definition/spec.md`

## Summary

046 将 Agent 实现为 Team 直属、与 Project/Task/Session 均无父子关系的业务配置。Agent 的唯一效果配置是 `systemPrompt`；管理元数据包含稳定 ID、名称、revision、active/archived 状态和时间。交付范围包括共享 Zod 契约、Prisma SQLite/PostgreSQL 持久化、`RdbProvider` 能力、canonical HTTP API、薄 MCP/CLI 客户端以及完整契约测试。

Session 执行不在本功能实现：046 只提供 active Agent 的原子解析方法，返回不可变的 resolved snapshot，供后续 Session 规格把它与 Runtime、Provider、Context 三个独立选择组合。Project/Task 只会在后续 Session 上作为彼此独立的可选引用，不进入 Agent 表或 Agent API。

同时直接替换 pre-0.1 的错误术语：公共契约中 `codex`/`copilot` 是 `Provider`，不再使用 `agent` 字段或 `AgentName` 类型承载 Provider 键。该清理不实现 Session 生命周期，也不保留兼容别名。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、React 19、Zod 4、Prisma ORM/Client 7.9.1、`@prisma/adapter-better-sqlite3`、`@prisma/adapter-pg`
**Storage**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，通过 `RdbProvider` 暴露领域契约
**Testing**: Vitest 4、共享 schema 单测、双数据库 provider contract、API/MCP/CLI 路由测试、Prisma schema parity
**Target Platform**: 自托管 Mystra control plane；API/MCP/CLI 优先，无 Web UI
**Project Type**: TypeScript monorepo / web service + CLI
**Performance Goals**: Agent 列表默认 50、最大 100 条；所有单记录读写保持一次领域操作内完成；冲突检测不得依赖客户端重试猜测
**Constraints**: Team 隔离；system prompt 最大 32,768 个字符；无 Project scope；无 SecretProvider；无 pre-0.1 兼容别名；无 Session 持久化伪实现
**Scale/Scope**: 单 Team 可有数百 Agent；一张 Agent 表、5 个 HTTP 操作、5 个 MCP tools、5 个 CLI 子命令

## Constitution Check

### Pre-design gate

| Gate | Result | Evidence |
| --- | --- | --- |
| Team 是租户边界 | PASS | Agent 表只含 `teamId` 外键；API 从 active Team 派生 Team ID |
| Agent 与 Project 无关 | PASS | schema、API、RDB 方法均不接受 `projectId` |
| Session/Task/Project 无父子误建模 | PASS | 046 不新增 Session 关系，也不修改 Task/Project 持久化 |
| Agent 只有 system prompt 效果配置 | PASS | 共享 create/update schema 拒绝 Provider、Runtime、Context、skills、tools、model 等额外字段 |
| API-first、MCP/CLI thin client | PASS | 共享 schema + RdbProvider 为唯一语义来源；MCP/CLI 不复制字段解释 |
| Prisma 不泄漏到公共边界 | PASS | Prisma row 只在 DB 模块映射为 `@mystra/shared` 类型 |
| SQLite/PostgreSQL parity | PASS | 同步 schema、迁移和 parity test |
| pre-0.1 直接替换 | PASS | `AgentName` Provider 旧命名直接改为 `ProviderName`，不加 alias |
| 测试先行与可验证交付 | PASS | tasks 要求 schema/provider/API/MCP/CLI 先 RED 后 GREEN |

### Post-design gate

Phase 1 设计没有新增例外。Agent revision 使用数据库条件更新实现 optimistic concurrency；归档是软删除；resolved snapshot 是值对象，不是新表。没有引入服务层框架、事件总线、版本历史表或 Session 占位实现。

## Architecture and Data Flow

```text
Human / MCP / CLI
        |
        v
active Team auth + shared Zod contract
        |
        v
canonical Agent API / MCP adapter
        |
        v
RdbProvider Agent operations
        |
        v
PrismaRdbProvider ----> SQLite / PostgreSQL
        |
        +---- resolveActiveAgent(id, teamId)
                         |
                         v
              ResolvedAgentSnapshot value
              { agentId, revision, systemPrompt }
                         |
                         v
              future Session launch contract
              Runtime + Provider + Agent + Context
```

写路径先读取当前 Agent，在同一数据库事务中比较 Team、status 与 revision，再以 `WHERE id + teamId + revision + status=active` 条件更新。system prompt 真正变化才递增 revision；仅重命名不递增。旧 snapshot 是已返回的不可变值，不会重新读取当前 Agent。

## Public Contract Decisions

- `POST /api/agents`：创建 active Agent；Team ID 只从登录会话解析。
- `GET /api/agents?limit=&cursor=&includeArchived=`：按 ID 稳定分页列出 active Agent；具备 Team 读取权限的调用方可显式包含 archived。
- `GET /api/agents/{id}`：同 Team 内读取 active 或 archived Agent。
- `PATCH /api/agents/{id}`：重命名和/或更新 prompt；必须携带 `expectedRevision`。
- `POST /api/agents/{id}/archive`：软归档；必须携带 `expectedRevision`。
- 读取需要 `team.resource.access`；创建、更新、归档需要 `team.settings.manage`。
- 稳定错误：`AGENT_NOT_FOUND`、`AGENT_ARCHIVED`、`AGENT_REVISION_CONFLICT`、`INVALID_AGENT`。
- 列表 cursor 是服务器返回的 opaque Agent ID；默认 50，最大 100。
- system prompt 最大 32,768 字符，允许内部换行和边缘空白，但 `trim()` 后必须非空；存储保留调用方原文。

## Deliberate Non-goals

- 不创建 Session 表、Session API 或执行调度。
- 不修改 Task、Project 现有持久化关系；其独立 Team 模型由后续修正规格拥有。
- 不把 Runtime/Provider 可用性判断塞入 Agent RDB 方法。
- 不提供 Agent Web UI、硬删除、prompt 历史 diff、模型参数、skills 或 tools。
- 不让 Agent system prompt 进入 SecretProvider。

## Project Structure

### Documentation (this feature)

```text
specs/046-agent-definition/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── agent-management.md
│   └── session-selection-boundary.md
├── checklists/
│   ├── requirements.md
│   └── engineering-review.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── agent.ts
├── schemas.ts
├── issue.ts
└── index.ts

packages/agent-adapters/src/
└── index.ts

apps/control-plane/
├── app/api/agents/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       └── archive/route.ts
├── app/api/mcp/route.ts
├── prisma/
│   ├── sqlite/schema.prisma
│   ├── postgresql/schema.prisma
│   └── migrations/<timestamp>_agent_definition/migration.sql
└── src/lib/db/
    ├── rdb-provider.ts
    ├── prisma-provider.ts
    ├── prisma-client.ts
    ├── prisma-mappers.ts
    └── rdb-provider.contract.ts

scripts/operator-cli.mjs
```

**Structure Decision**: 复用现有 shared → RdbProvider → Prisma → Route Handler 分层。Agent 是新业务对象，但没有足够理由再制造一个 service package。MCP 与 CLI 只是 canonical contract 的适配器。

## Verification Strategy

1. Shared schema：字段白名单、32,768 上限、空白 prompt、revision 请求、Provider 命名。
2. Provider contract：Team 隔离、分页、归档可读/不可解析、prompt revision、rename 不增 revision、并发条件更新、snapshot 值稳定。
3. SQLite/PostgreSQL parity：model/table/index/foreign key 一致；生成客户端成功。
4. HTTP API：auth、permission、active Team 派生、错误状态、额外字段拒绝。
5. MCP：tool listing、同一共享 schema、管理权限、稳定错误不泄漏。
6. CLI：解析、请求路径、stdin/参数行为、human/JSON 输出和退出码。
7. Terminology audit：代码与公开契约中 Provider 键不再使用 `agent`/`AgentName`。
8. 全量 `pnpm test`、`pnpm typecheck`、相关 build；完成前运行 GitNexus `detect_changes(compare main)`。

## Complexity Tracking

无 constitution 例外。文件数量较多来自五个既有边界的必要端到端交付，不新增抽象层；唯一新领域对象是 Agent，唯一新持久化模型也是 Agent。
