# 实施计划：标准执行提示词与可选 Agent 上下文

**分支**: `052-standard-agent-context` | **日期**: 2026-08-12 | **规格**: [spec.md](./spec.md)

## 摘要

052 直接替换 046/049/051 的 Agent 必填执行合同。所有 Task-bound Session 都先应用程序拥有、版本化且不可由 Team 编辑的 Standard Execution Prompt；调用方可以不选择 Agent，或选择一个 active Team Agent 作为低优先级 Optional Agent Context。Harness、Session、workload identity、Prisma 关系和所有 Start adapter 都用同一个 `0..1` Agent snapshot 合同，不创建默认 Agent、sentinel ID 或兼容 fallback。

实现会把标准提示词、runtime/provider 约束、可选 Agent Context 和执行事实按固定顺序组装，并在 `session.system_prompt_configured` 初始事件中原子冻结版本、组件、可选 snapshot 与最终文本。Task production API 从 `/assign` 直接替换为 `/start`；`mystra` operator CLI、MCP 和 Web 只做 canonical `TaskProductionService.start` 的薄适配。Runner 与 Provider adapter 继续只消费 Control Plane 冻结的最终 prompt，不重新解析 Agent。

## 技术上下文

- **语言/运行时**: TypeScript 5.9、Node.js 24.14.0。
- **主要依赖**: Next.js 16、React 19、Zod 4、Prisma 7.9.1、Vitest 4；现有 `@mystra/shared`、`@mystra/agent-adapters`、`@mystra/agent-cli`、`mystra-runner`。
- **存储**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL，经同一 `RdbProvider`；Harness/Session Agent 外键改为 nullable，不新增默认数据。
- **测试**: Vitest shared/service/provider/route/CLI/Runner contract tests；SQLite 必跑，PostgreSQL 在 `MYSTRA_TEST_POSTGRES_URL` 存在时运行；真实 HTTP/host Runner journey。
- **目标平台**: self-hosted Control Plane、host-bound TypeScript Runner；API/MCP/CLI 为主要管理合同，Web 为次要操作面。
- **性能目标**: Start 事务仍不包含 Workspace/Runtime I/O；标准提示词解析为 O(1)；prompt evidence 只写一次，继续消息不重复注入。
- **约束**: Standard Execution Prompt 不是 Team 数据；无 Agent 不得触发数据修复；显式 foreign/archived Agent 必须 fail closed；execution code 仍是 attempt identity；pre-0.1 不保留旧路径或 schema shim。
- **范围**: shared contracts、双 Prisma schema/migration、RDB 原子冻结、Session prompt 证据、Human API、operator CLI、MCP、Web、workload CLI projection、Runner/adapter contract tests、规格与 durable docs 同步。

## Constitution Check

### 规划前 gate

- **产品边界**: PASS。只重定义默认执行合同和 Agent 可选性，不增加 Agent 市场、多 Agent、Workflow、Artifact 验真或外部 credential 代理。
- **Team 与 workload identity**: PASS。Agent Context 仍验证 Team scope；无 Agent attempt 由 Harness/Session execution code 标识，不创建长期 workload identity。
- **Typed contracts**: PASS。API、MCP、CLI、Runner、SessionEvent、RDB 输入均由 shared Zod schema/TypeScript 类型统一。
- **Provider/RDB 隔离**: PASS。Prisma nullable 关系不越过 `RdbProvider`；Runner/Provider adapter 只接收最终 prompt。
- **事务顺序**: PASS。可选 Agent 必须在 Start RDB 事务内验证并冻结；Workspace setup 与 Session dispatch 继续发生在提交后。
- **pre-0.1 policy**: PASS。直接替换 `/assign`、必填 Agent 字段和旧 prompt component vocabulary，不增加 dual-read/dual-write。
- **文档与验证**: PASS。052 产物位于 `specs/052-standard-agent-context/`，完成前执行 focused tests、全量 gates、真实 journey 和 GitNexus change detection。

### Phase 1 设计后复核

- Standard Execution Prompt 由 Control Plane program module拥有，shared package只定义 evidence schema；version使用内容寻址 `sha256:<content digest>`，文本变化自动生成新版本且无法忘记提升。
- Prompt evidence 保持 append-only SessionEvent source of truth；Session/Harness 只持久化 nullable Agent snapshot，避免复制最终 prompt 到第二张投影表。
- Start idempotency fingerprint 明确包含 `agentId ?? null`。省略与 JSON `null` 规范化为同一 intent；空字符串、unknown、archived、foreign 均拒绝。
- Agent snapshot 在 `assignTaskForProduction` 的同一数据库事务中读取并冻结，消除 service 预读与 Agent update/archive 之间的竞态。
- 普通 Task Session launch 与 Harness launch 均采用同一 optional Agent/prompt assembly contract；052 不只修复 Web happy path。

全部 gate 继续 PASS，无 constitution waiver。

## 已有能力与改动边界

| 已有能力 | 052 的直接替换 |
| --- | --- |
| `TaskProductionService.assign` + atomic Harness | 改为 `start`，Agent ID 可选，事务内冻结可选 snapshot |
| `HARNESS_BOOTSTRAP_PROMPT` | 升级为版本化 Standard Execution Prompt，不再依赖 Agent prompt 承担默认职责 |
| 四段 `runtime/provider/agent/context` prompt | 改为 `standard/runtime/provider/[agent_context]/execution_context` 固定顺序 |
| Harness/Session 必填 Agent FK | 改为 nullable `0..1` snapshot；无 sentinel/default row |
| `session.system_prompt_configured` | 扩展为可审查 evidence：standard version、nullable Agent snapshot、ordered components、finalPrompt |
| `/production/assign` + Web 必填 selector | 直接替换为 `/production/start` 和默认无 Agent Start |
| `mystra-agent` identity 含必填 Agent | 改为明确的 `agentContext: object | null` |
| Runner 接收 `assignment.systemPrompt` | 保持不变，只增加 Agent nullable schema 测试，禁止 Runner 重组 prompt |

## 关键数据流

```text
API / mystra CLI / MCP / Web Start
  -> taskStartRequestSchema
     agentId omitted|null => no Agent Context
     agentId uuid         => explicit Agent Context request
  -> TaskProductionService.start
     -> validate Task/Project/Runtime/Provider
     -> RDB tx
        -> re-check pending/revision/idempotency
        -> if agentId: read same-Team active Agent and freeze name/revision/prompt
        -> Task pending->in_progress + transition + Harness(optional snapshot)
  -> commit
  -> Workspace setup/ready continuation
  -> SessionService.launchHarness
     -> resolve Standard Execution Prompt or fail closed
     -> assemble ordered evidence
        standard -> runtime -> provider -> optional agent_context -> execution_context
     -> atomically persist Session + evidence + Workspace + first message
  -> Runner claim returns frozen finalPrompt
  -> Provider adapter starts once with finalPrompt; no Agent-specific override
```

## 数据与合同决策

### Standard Execution Prompt

- 程序常量：`{ version, content }`，不进入 Team/Agent/Project 配置或环境变量。
- version 使用内容寻址 `sha256:<64 hex>`；同一文本跨进程稳定，文本变化自动产生新版本。
- 内容明确要求：先读取 `mystra-agent context get`；按 exact Issue reference 使用 host-local `linctl`；只在 attached Workspace/branch 工作；实现并自测；用 host-local `gh` 交付 PR；报告 `waiting_for_review` 或 `blocked`；PR/test 仍为未验证声明。

### Optional Agent Context

- canonical 形态：`{ agentId, name, revision, systemPrompt } | null`。
- Harness 持久化 nullable snapshot；Session 持久化 nullable `agentId/agentRevision`，完整 name/prompt snapshot 位于初始 prompt evidence。
- 显式选择必须 active、同 Team；事务内读取决定 frozen revision。无效选择不降级为 null。

### Effective System Prompt Evidence

```text
standardPrompt: { version, content }
agentContext: { agentId, name, revision, systemPrompt } | null
components: ordered 4..5 entries
finalPrompt: immutable text passed to Runner
```

component name 只允许 `standard|runtime|provider|agent_context|execution_context`；没有 Agent 时数组没有 `agent_context`，同时顶层 `agentContext:null` 证明它是明确缺席而非数据损坏。

## API、CLI、MCP 与 Web

- Human API: `POST /api/tasks/{taskId}/production/start`；旧 `/assign` 在 pre-0.1 直接删除。
- Operator CLI: `mystra tasks start <taskId> --runtime-id <uuid> --provider <key> [--agent-context-id <uuid>] --expected-revision <n> --idempotency-key <key>`。
- MCP: `mystra_start_task_production` 暴露同一字段，其中 `agentId` 可选。
- Web: 无 active Agent 时不渲染 selector；有 active Agent 时显示 “Optional Agent Context”，默认 `None`，Start disabled 条件不包含 Agent。
- Workload CLI: `whoami` 与 `context get` 输出 `agentContext:null|snapshot identity`，不把 execution code 描述为 Agent identity。
- Review projection: Task production response和 Session event presentation显示 standard version，以及 Agent name/ID/revision或 “No optional Agent context”。

详细示例见 [contracts](./contracts/) 与 [data-model.md](./data-model.md)。

## 失败模式

| 失败 | 系统行为 | 验证 |
| --- | --- | --- |
| Standard prompt 缺失、空、超限或 version 不合法 | Start/Session launch fail closed，不用 Agent prompt 单独启动 | assembler/service unit tests |
| omitted 与 null 的 replay | 同一 fingerprint，返回同一 Harness/Session | RDB contract + route tests |
| 同 key 从 null 改为 UUID | idempotency conflict，无第二 attempt | RDB contract |
| selected Agent 被 update/archive | Start tx冻结同一行版本，或因 inactive/foreign 明确失败 | provider race tests |
| Agent Context 与标准职责冲突 | evidence 顺序及标签保持标准合同优先；不承诺模型绝对服从 | prompt golden tests |
| prompt evidence 与 Session Agent nullable字段不一致 | create/claim fail closed；Runner拿不到 assignment | RDB/RuntimeSession tests |
| adapter 单独要求 Agent | shared schema contract与 adapter tests失败 | API/CLI/MCP/Web tests |
| Runner重新拼接 Agent prompt | Runner/adapter golden test断言只传 `finalPrompt` | Runner tests |
| 历史 Agent/标准文本更新 | 既有 SessionEvent逐字不变，新 Session使用新 snapshot/version | Session service tests |

无“无测试、无错误处理且静默”的已知关键路径。

## 项目结构

```text
packages/shared/src/
├── harness.ts                     # optional snapshot/start/workload schemas
└── session.ts                     # optional Agent + prompt evidence schemas

apps/control-plane/
├── prisma/{sqlite,postgresql}/     # nullable Harness/Session Agent relations
├── src/lib/db/                     # transaction-time snapshot and parity
├── src/lib/tasks/                  # TaskProductionService.start
├── src/lib/sessions/               # program prompt, one assembly path and evidence
├── app/api/tasks/[id]/production/start/
├── app/api/mcp/                    # thin Start tool
└── app/_components/                # Optional Agent Context UI/evidence

packages/agent-cli/                 # nullable Agent Context projection
scripts/operator-cli.mjs            # human/external-Agent Start adapter
apps/runner-daemon/                 # nullable contract, finalPrompt-only execution
packages/agent-adapters/            # no prompt ownership; regression tests
```

## 实施顺序

1. Shared Standard Prompt、optional Agent、prompt evidence 与 adapter request schemas，先写失败测试。
2. 双 Prisma schema/migration、mappers、`RdbProvider` atomic Start contract与 race/idempotency tests。
3. `TaskProductionService.start`、Session launch/assembler、Runtime claim evidence一致性。
4. Human `/start` API 与 production review projection。
5. `mystra` CLI、MCP、Web 三个薄 adapter。
6. `mystra-agent` nullable Agent Context、Runner/Provider finalPrompt regression。
7. focused/full tests、HTTP/Runner journey、术语审计、Spec View/status 与 graph-aware review。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 052 规格已冻结产品边界 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 本次未调用外部模型 |
| Eng Review | `/plan-eng-review` | Architecture/data/tests (required) | 1 | CLEAR | 8 findings resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | 已有静态 prototype；本期复用 Task production panel |
| DX Review | `/plan-devex-review` | CLI developer experience | 0 | — | operator/workload CLI contracts在本计划内评审 |

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — ready for task decomposition and implementation

## 并行化分析

当前工作树包含尚未提交的 051 基线，且 052 的 shared schema会影响所有后续模块。为避免多个 worktree基于不同的 nullable contract修改同一文件，本期顺序实施，不建议并行 worktree。测试文件可与实现交错，但共享同一主线。

## NOT in scope

- Standard Execution Prompt 的用户查看、编辑、Team 初始化或 Project 覆写。
- Agent 创建/编辑体验、模板市场、默认绑定、自动推荐或任务分诊。
- 多 Agent、Harness 多 Session、Recipe/Workflow、Artifact submission、质量验真与修复循环。
- Mystra 代理、credential exchange、查询或验证 `linctl`/`gh` 结果。
- Task 删除、reopen、第二次 attempt、Runtime capacity 与 Session自动修改 Task状态。
- pre-0.1 数据升级兼容；开发数据按新 schema直接重建。

## Complexity Tracking

无 constitution violation。新增 Standard Prompt 常量和扩展已有 prompt evidence，而不是增加持久化配置对象；nullable Agent 直接替换旧必填关系，不引入双合同。
