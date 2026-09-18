---
title: "Data Model：固定 Task Workflow Runtime"
taco_scope: plan
---

## Overview

```text
Team 1 ── * Task 1 ── * TaskWorkflowState 1 ── * TaskWorkflowTransition
             │                    │
             │                    └── * SessionWorkflowCapability * ── 1 Session
             └── * TaskWorkspace 1 ── * WorkspaceSkillSource
                                      * WorkspaceSkillProjection
```

## TaskWorkflowState

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | generated, immutable |
| `teamId` / `taskId` | IDs | same Team relation |
| `workflowId` | literal | `mystra.workflow` |
| `stageId` | enum | `understand \| implement \| verify \| completed` |
| `stateVersion` | positive int | starts 1；transition/disable CAS +1 |
| `activeKey` | nullable literal | active=`mystra.workflow`; inactive=null |
| `enabledByUserId` / `enableCommandId` / `enabledAt` | audit | immutable |
| `disabledByUserId` / `disableCommandId` / `disabledAt` | nullable audit | all present iff inactive |
| `updatedAt` | timestamp | latest mutation |

Unique `(taskId, activeKey)`；multiple null history rows permitted。Terminal可保持active直到Human disable。Re-enable创建新 ID，不复活旧 row。

## TaskWorkflowTransition

| Field | Type | Rules |
|---|---|---|
| `id` / `workflowStateId` | UUIDs | immutable audit/parent |
| `teamId` / `taskId` / `sessionId` | IDs | bounded scope/actor |
| `commandId` | UUID | stable retry identity |
| `payloadHash` | sha256 | canonical action+expected version |
| `actionId` | enum | fixed allowlist |
| `fromStageId` / `toStageId` | enum | fixed edge |
| `fromStateVersion` / `toStateVersion` | int | `to=from+1` |
| `occurredAt` | timestamp | commit time |

Unique `(workflowStateId, commandId)`。Only successful transitions persist；rejected attempts不是logs产品。

## SessionWorkflowCapability

| Field | Type | Rules |
|---|---|---|
| `sessionId` | Session ID | primary/unique；launch-created |
| `workflowStateId` | State ID | exact active state |
| `teamId` / `taskId` | IDs | match Session/state |
| `issuedAt` / `revokedAt` | timestamps | revoke on disable |

Inactive launch没有 row。Resolve始终检查 relation、state active与execution lease；绝不按 Task fallback。

## WorkspaceSkillSource

| Field | Type | Rules |
|---|---|---|
| `workspaceId` | Workspace ID | Task Runtime workspace |
| `sourceKey` | bounded string | `workflow:mystra.workflow:<stateId>:global` or `...:stage:<stageId>` |
| `skillId` / `skillRevisionId` | IDs | same Team, exact ready Revision |
| `relativePath` | POSIX path | `.mystra/skills/<skillId>` |
| `desiredGeneration` | int | current desired generation |
| timestamps | timestamps | lifecycle |

Primary key `(workspaceId, sourceKey, skillId)`。Changing Stage deletes only prior stage sources；global/other approved sources remain。

## WorkspaceSkillProjection

| Field | Type | Rules |
|---|---|---|
| `workspaceId` / `skillId` | IDs | composite identity |
| `skillRevisionId` / `relativePath` | exact target | all sources must agree |
| `desiredGeneration` / `appliedGeneration` | ints | stale reports ignored |
| `status` | enum | `pending \| ready \| failed` |
| `failureCode` | nullable | bounded/redacted |
| `updatedAt` | timestamp | latest desired/report |

Projection exists iff at least one source exists。Different exact Revision demands fail explicitly；physical residue without logical sources is ineffective。

## Transactions

### Enable

Resolve fixed Skills/preflight；lock Task/current state；active returns current，otherwise insert v1 state + initial desired sources。

### Transition

Resolve exact capability/check replay；validate edge/version；CAS state + insert transition + replace stage sources + recompute aggregates in one transaction；materialize after commit。

### Disable

CAS inactive + revoke capability rows + remove this state's sources + recompute aggregates；physical cleanup after commit，failure never reactivates state。

## Provider Parity

SQLite/PostgreSQL schemas must expose identical fields/index semantics。Nullable unique behavior必须由provider contract测试证明；不能靠数据库善意猜测，数据库通常对此不感兴趣。
