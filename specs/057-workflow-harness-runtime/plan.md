---
title: "Implementation Plan：固定 Task Workflow Runtime"
taco_scope: plan
---

**Branch**: `057-workflow-harness-runtime` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

## Summary

实现唯一、program-owned 的 `mystra.workflow`：Owner/Admin 可为 Task 显式 enable/disable；active Workflow 在新 Session 中贡献固定 base prompt，并把 capability 绑定到精确 `TaskWorkflowState`；workload Agent 通过 `mystra-agent workflow current/transition` 读取和推进固定状态图；Control Plane 计算精确 Skill Revision 与来源集合，Runner/Agent CLI 在共享 Task Workspace 中原子 reconcile。

本 feature 不建设 Harness 平台。未来扩展点只是一组 package-private Workflow module ports；没有 Resource、Catalog、Attachment JSON、registry、SDK、动态命令或远程代码加载。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16 Route Handlers、Zod 4、Prisma 7.9.1、Vitest 4、Feature 056 Skill Library、现有 runner-daemon/agent-cli
**Storage**: SQLite/PostgreSQL/Supabase-backed PostgreSQL behind `RdbProvider`；Skill ZIP 继续使用 Feature 056 S3-compatible store
**Testing**: Vitest unit/contract/integration/e2e、SQLite/PostgreSQL RdbProvider contract、Prisma schema parity、CLI/Runner filesystem fixtures
**Target Platform**: self-hosted Control Plane + host-bound TypeScript Runner，macOS/Linux host Workspace
**Project Type**: monorepo control-plane API + runner daemon + workload CLI + shared contracts
**Performance Goals**: current/transition 的 RDB path p95 < 200 ms（不含 ZIP 下载）；20-way transition 最多一个成功；inactive path 不增加对象存储 I/O
**Constraints**: state transaction 不跨外部 I/O；Session capability 精确绑定且 disable fail closed；Skill 解压 bounded、manifest-driven、原子替换；无 UI/prototype
**Scale/Scope**: 每 Task 最多一个 active state；每 reconcile 最多 4 个固定 Skill；沿用 056 的 20 MiB ZIP/1,000 manifest entry 上限

## Constitution Check

### Initial gate

- **PASS — product boundary**: 固定 Workflow 是 Feature 057 的明确例外；未引入通用 Harness 产品。
- **PASS — state ownership**: `TaskWorkflowState` 独立于 Task/Session/TaskExecutionContext/Workspace state。
- **PASS — provider neutrality**: persistence methods 使用 shared domain values，不泄漏 Prisma/dialect/URL/pool。
- **PASS — source authorization**: Skill bytes 必须先通过 Team -> Skill -> exact Revision 与 projection relation 授权。
- **PASS — UI discipline**: 本 feature 没有 UI-facing surface，不创建 prototype route。
- **PASS — pre-0.1**: 直接建立当前 schema，无兼容 alias、dual read/write 或 migration shim。

### Post-design gate

- **PASS — bounded extensibility**: `FixedWorkflowRuntime`、`WorkflowStateStore`、`WorkflowSkillProjector` 为内部组合边界；只有一个实现且不导出 plugin registry。
- **PASS — transactional boundary**: RDB transaction 写权威 state/audit/desired sources；下载和 materialization 在提交后执行。
- **PASS — exact capability**: `SessionWorkflowCapability` 绑定 state ID；disable/re-enable 创建不同 identity，旧 Session 不会重新获得能力。
- **PASS — frozen evidence**: Prompt evidence只记录固定 Workflow component，不记录动态 Stage/Skill/stateVersion。
- **PASS — reviewable plan**: data model、API、Runner delivery、failure semantics、tests 与 blast-radius gates 均已落盘。

## Architecture

```text
Owner/Admin              Session launch                 Agent workload
    |                         |                               |
    v                         v                               v
Management API        SessionService + Prompt        mystra-agent workflow
    |                         |                         current/transition
    +-------> FixedWorkflowRuntime <-------------------------+
                         |
          +--------------+---------------+
          |                              |
          v                              v
 WorkflowStateStore              WorkflowSkillProjector
 (RDB state/audit/CAS)      (desired sources + exact revisions)
          |                              |
          v                              v
 TaskWorkflowState             Session claim / workload sync
 SessionWorkflowCapability              |
 TaskWorkflowTransition                 v
                                Runner / Agent CLI materializer
                                      |
                                      v
                         <workspace>/.mystra/skills/<skillId>/
```

### Launch sequence

1. Session launch resolves active state and creates `SessionWorkflowCapability(stateId)` alongside Session/evidence。
2. Prompt assembler adds fixed `workflow` component after provider facts and before optional Agent Context/execution data。
3. Claim grants Workflow operations only while the bound state remains active。
4. Claim returns exact desired Skill manifest；Runner uses a lease-scoped endpoint to download, verify, atomically materialize and report。
5. Provider starts only after initial projection succeeds；failure does not mutate Workflow Stage。

### Transition sequence

1. CLI sends `actionId`、`expectedStateVersion`、stable `commandId`；no object IDs。
2. Server resolves execution code -> Session -> exact state and validates scope/capability/Action。
3. One transaction performs CAS、audit insert、stateVersion increment and desired-source replacement。
4. CLI reconciles returned exact projection generation and reports health。
5. Materialization failure returns committed Stage + retryable projection error；`current` repairs without repeating transition。

## Project Structure

```text
specs/057-workflow-harness-runtime/
├── spec.md, plan.md, research.md, data-model.md
├── engineering-review.md, quickstart.md, tasks.md
└── contracts/{workflow-management-api,workflow-workload-api,workflow-skill-projection}.md

packages/shared/src/{workflow,task-execution-context,session}.ts
apps/control-plane/
├── prisma/{sqlite,postgresql}/{schema.prisma,migrations/...}
├── src/lib/db/{rdb-provider,prisma-provider,prisma-mappers}.ts
├── src/lib/workflows/{fixed-workflow-definition,fixed-workflow-runtime,workflow-management-service,workflow-workload-service,workflow-skill-projection-service}.ts
├── src/lib/sessions/{session-service,runtime-session-service,system-prompt-assembler}.ts
└── app/api/{tasks/[id]/workflow,agent-execution/workflow,runner/sessions/[id]/skills}/...
packages/agent-cli/src/{cli,client,workflow-materializer}.ts
apps/runner-daemon/src/session/{session-client,session-worker,skill-materializer}.ts
```

**Structure Decision**: 在现有 shared/control-plane/runner/agent-cli 边界内增加内聚 `workflows` domain module。不得创建 `packages/harness`、通用 plugin package 或 UI app。

## Fixed Definition

| Stage | Stage Skill key | Action |
|---|---|---|
| `understand` | `idea-refine` | `understanding-complete -> implement` |
| `implement` | `incremental-implementation` | `implementation-complete -> verify` |
| `verify` | `code-review-and-quality` | `verification-failed -> implement`; `verification-passed -> completed` |
| `completed` | none | none |

Global Skill key 为 `repository-development-guide`。这些 name 是 program-owned 常量，通过 Feature 056 的 Team-scoped active Skill name 解析到 exact Skill ID/current ready Revision；enable 先验证全部 key。不存在旧 ID、其他 Team、filesystem skill 或相似名称回退。

## Implementation Slices

1. Shared Workflow contracts + fixed definition tests。
2. Prisma schema、RdbProvider narrow methods、CAS/idempotency/audit contracts。
3. Management service/API/CLI/MCP adapters 与 RBAC。
4. Session binding、prompt evidence 与 exact workload capability。
5. Workload current/transition contracts and CLI。
6. Source-aware projection、scoped download、Runner/CLI materialization。
7. Failure matrix、concurrency/e2e、full regression、GitNexus detect_changes、Taco closeout。

## Complexity Tracking

No constitution violations。内部 ports 用于隔离 concrete implementation，不构成 deployment adapter catalog 或产品抽象。

## GitNexus Evidence

当前 worktree 以 pinned GitNexus 1.6.9 建立 index并检查 launch/workload/runner/db flows：

- `RdbProvider`: CRITICAL，52 direct、171 total、43 processes。
- `PrismaRdbProvider`: CRITICAL，13 direct、193 total、50 processes。
- `SessionService`: HIGH，8 direct、30 total、3 processes。
- `RuntimeSessionService`: MEDIUM，6 direct、12 total。
- `AgentExecutionService`: LOW，3 direct、11 total。
- `executeSessionAssignment`: LOW，2 direct、5 total。

实现前必须对每个实际修改 symbol 重跑 impact；CRITICAL/HIGH slice 必须先完成 provider/schema parity 与 launch regression gate。
