---
title: "Engineering Review：固定 Task Workflow Runtime"
taco_scope: plan
---

## Verdict

**CLEARED_WITH_GATES**。置信度：**高**。范围无未决项；风险集中在 shared persistence/Session contracts、非原子 Skill delivery和exact capability revocation。

## Architecture Review

```text
authoritative RDB transaction       post-commit side effects

state CAS + transition audit   ->   resolve/download Skill ZIP
desired source generation           materialize on host
capability revoke                   report applied generation
```

State先提交、projection可重试给Agent单一权威Stage；跨RDB/OSS/filesystem回滚不可接受。

### G1 — No generic Harness leakage

只允许 fixed Workflow types。禁止 Harness Resource/Attachment、registry/SDK、dynamic command/module loader、Workflow JSON/OSS config、CRUD/editor/routing/replace/switch。内部 ports 不作为 public shared SDK export。

### G2 — CRITICAL persistence blast radius

GitNexus：`RdbProvider` CRITICAL（52 direct/171 total/43 processes）；`PrismaRdbProvider` CRITICAL（13/193/50）。每个symbol修改前重跑impact；SQLite/PostgreSQL schema+migration+client/mappers+narrow methods+provider contract+parity同slice完成；full provider suite通过。

### G3 — HIGH Session blast radius

`SessionService` HIGH（8 direct/30 total/3 processes）。Prompt schema、launch transaction、event evidence一起更新，覆盖Task production、MCP launch、event reads；inactive path保持existing order/content。

## Capability/Security

### G4 — Exact binding/revocation

Resolve chain：execution hash -> live Session lease -> Session -> exact capability -> active state，Team/Task完全一致。No Task fallback。Disable transaction先revoke logical authority；cleanup failure不影响revocation。

### G5 — Scoped Skill extraction

Every Get先授权 lease/execution -> Workspace projection -> Team Skill -> exact ready Revision。Caller不提交objectKey/path。Runner/CLI验证archive/manifest/path/hash/size，staging+atomic rename；日志不含credential/object key/absolute path/content。

## Failure/Concurrency

### G6 — Transition matrix

覆盖 CAS conflict、same replay、different payload、response loss、disable race、terminal/invalid action、Skill resolution/projection failures。20-way最多一个success，losers不能在new Stage重试。

### G7 — Generation convergence

Desired sources/aggregate同transaction更新；stale report不能覆盖new desired。Shared same Revision retained，different Revision conflicts；remove Workflow source不删other source。

### G8 — Launch ordering

Runner在Provider start前apply initial generation；failure emits bounded Session failure and leaves Stage。Continue也reconcile，不能假设目录仍有效。

## Performance

- transaction无ZIP/HTTP/filesystem；fixed requirements <=4；metadata bounded batch，no per-source object N+1。
- materializer一次一个 <=20 MiB archive/entry stream，no all-entry Buffer map。
- inactive claim无object-store I/O/assignment payload。
- current/transition benchmark >=100 warmed samples并记录environment。

## Test Plan

1. shared Zod：graph、component order、capabilities、errors。
2. SQLite/PostgreSQL RDB：active uniqueness、re-enable、CAS/20-way、replay、revocation、source aggregate/stale report。
3. services：RBAC/Team scope/edge allowlist/no state coupling。
4. prompt/launch：active/inactive/frozen evidence/Agent Context/re-enable denial。
5. workload/CLI：no ID flags、exit/retry、redaction、command reuse。
6. materializer：zip slip/symlink/hash/size/atomic crash/shared sources/cwd marker。
7. e2e：enable -> launch -> current -> transitions -> recovery -> disable -> re-enable。
8. full typecheck/test/lint、Prisma parity、detect_changes、Spec-Kit status、Taco。

## What Already Exists

Session evidence/launch events；Runtime lease/execution code；workload exact-scope pattern；Task Workspace host materializer；Feature 056 Skill metadata/Revision/manifest/hash/S3；static agent CLI。

## Not In Scope

Generic Harness/API/config、multiple workflows/routing、UI/prototype、dynamic plugins/commands、DAG/scheduler、automatic Task/Session/Issue transitions、cross-Runtime sync、Skill dependencies/signatures/marketplace。

## Review Log

| Area | Evidence | Resolution |
|---|---|---|
| Product | owner boundary + spec | dedicated module |
| Architecture | GitNexus query/context/impact | gated slices |
| Data | Prisma/RDB/Skill 056 | exact models/parity |
| Failure | RDB vs OSS/filesystem | committed state + retry |
| Security | execution lease + Team Skill | scoped capability/download |
| Performance | <=4 Skills + 056 caps | bounded batch/stream |

## Unresolved Decisions

None。需要generic resource/plugin registry/editable definition时必须新开规格；不能称之为“顺便保留扩展性”。
