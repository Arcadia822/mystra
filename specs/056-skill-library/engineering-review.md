---
title: "Engineering Review：Control Plane Skill 库"
taco_scope: plan
---

## Verdict

**CLEARED_WITH_GATES**

置信度：**高**。产品边界已由 owner 明确；外部 Taco review 提出的 retry state、digest order、frontmatter persistence、initial resource revision、credential source 和容量/性能歧义均已在 canonical artifacts 中闭合。工程风险集中在跨系统发布、ZIP 敌对输入和共享 RDB 接口爆炸半径，均有明确验证门槛。

## Architecture Review

### 1. Resource ownership

Skill 作为 Team-scoped sibling 正确；把目录内容塞进 Agent 会破坏 Agent Context 与 execution Context 的既有分离，也会让未来 Session 固定 Revision 变得含糊。第一阶段不创建任何 Agent/Session/Runtime foreign key，边界清晰。

### 2. Storage unit

单 Revision/单 ZIP object 是第一阶段最小可靠 publish unit。RDB manifest 负责 query/preview decision，对象存储负责 bytes。Per-file objects 的 preview 优势不足以抵消最多 1,001 次 Put、partial write recovery 和动态 ZIP；暂不采用。

### 3. External provider seam

`SkillContentStore` port 合理，但只能有 `S3SkillContentStore` production implementation。不得演化为用户可选 adapter catalog。AWS SDK types、bucket/key/credential 不得穿过 domain/API contracts。

## Data Flow And Failure Review

### Gate G1 — RdbProvider CRITICAL blast radius

GitNexus evidence：44 direct dependents、153 total impacted symbols、44 processes，risk CRITICAL。

实现要求：

- 先对将修改的具体 symbol 重新跑 impact；HIGH/CRITICAL 先告知 owner。
- Skill persistence 以命名分组新增窄 methods；不改变现有 Agent/Task/Session semantics。
- SQLite/PostgreSQL schema、Prisma client types/mappers、provider contract、schema parity 同一 slice 完成。
- 完整 control-plane provider suite 必须通过，不能只跑 Skill tests。

### Gate G2 — Cross-store publication recovery

RDB/S3 不共享事务。实施必须保持：validate before reservation；锁定 Skill 并 reserve `SkillRevision(uploading)`；Put/Head；finalize transaction。Revision 自身是持久发布收据，不增加 command ledger。每个 boundary 注入失败：

- reserve 前/后；
- Put 前/部分网络失败/成功响应丢失；
- Head missing/mismatch；
- finalize 前 crash；
- archive 或 concurrent publish 先提交；
- finalize response 丢失。

相同 `(skillId, baseRevisionId, zipSha256)` 必须 resume/return same Revision；initial create 通过 `(teamId, activeName)` 锁与 ZIP SHA-256 获得相同行为。不同 ZIP 是新尝试，并重新接受 current/If-Match 检查。archive 对已经 archived 的目标直接返回当前表示。任何失败都不能移动 current pointer。

timeout、throttle、5xx、credential/config unavailable 保持 `uploading`；同 tuple retry 必须 Head-first 并继续 Put/finalize。只有 object integrity conflict、archive 已提交、base/current 已变化等不可恢复 invariant 才转 `failed`。测试必须证明 HTTP `retryable` 不会变成 durable permanent failure。

### Gate G3 — Initial create invisibility

初次 publication reserve 后 Skill 可暂时 `currentRevisionId=null` 且 `resourceRevision=0`，但普通 list/detail query 必须排除。只有同 name publication recovery 与 server diagnostics 能看到。成功 finalize 同一 transaction 分配 sequence、设置 ready/current 并将 resourceRevision 设置为 1。必须有查询 contract test，防止 half-created Skill 或 ETag 0 泄漏。

## Security Review

### Gate G4 — ZIP adversarial corpus

必须覆盖：zip slip、absolute/drive/backslash/NUL、`.`/`..`、重复/Unicode NFC/case-fold collision、symlink/hardlink/device、encrypted、unsupported method、ZIP64/multi-disk boundary、entry/directory noise flood、declared/actual size mismatch、CRC mismatch、deflate bomb、ambiguous root、YAML alias/custom tag abuse。

所有 entry 都扫描；ignored noise 仍计入 abuse cap。算法必须是 metadata-first/content-second：Stage 1 最多保存 1,200 bounded descriptors 并决定 root/final path/sort；Stage 2 按 logical path 每次只打开一个 stream。服务端不创建 temp dir、不执行/导入脚本、不渲染 HTML/SVG。

Unknown frontmatter 只做 safe parse 后忽略；RDB 仅投影 name/description。不得把任意 YAML object 塞入 `manifestJson`，原始 `SKILL.md` 仍由 immutable ZIP 保留。

### Gate G5 — Team and object authorization

任何 Get/Head 之前先通过 active Team 的 Skill/Revision relation 授权。API 不接受 object key；错误不得泄漏跨 Team existence。S3 credentials server-only，provider raw message/endpoint/bucket/key 不进入 client/log evidence。

## Performance Review

### Gate G6 — Bounded memory and stream lifecycle

- Publish：一个 `<=20 MiB` ZIP Buffer + 最多 1,200 bounded descriptors + 一个 entry stream；禁止 `Promise.all(entries)` 或全部 file Buffer map。
- Preview：一次最大 20 MiB ZIP Buffer，定位一个 manifest-approved file；并发需要 request abort/backpressure 测试。若真实 p95/egress 触发 research 中 threshold，再设计 range reader/cache。
- Download：S3 Get stream 透传；client disconnect 必须 abort upstream body。
- List/detail/history：RDB only；bucket listing/object Head fan-out 必须为 0。
- 10,000 Skills、1,000 Revisions 和 1,000 manifest entries 是独立 fixture，不是单 Team 联合极限。每项 p95 至少使用 100 次 warmed samples，并记录环境、数据库与对象 provider。

## API And Adapter Review

- Raw `application/zip` + Content-Length 合适；update/archive 用 If-Match 表达 optimistic concurrency。expected revision 只是请求条件，不保存到 Revision。首个公开 ETag 固定为 1。
- Preview exact path 通过 query parameter，必须先 manifest exact-match；不对 caller path做“修复”后继续读取。
- MCP 不承载 20 MiB ZIP base64。这会把 payload 膨胀到约 26.7 MiB，污染 tool context。JSON-safe reads/archive 留在 MCP，binary publish 走 canonical HTTP 或 CLI。这是正式 transport boundary。
- Archive 使用 POST action 与现有 Agent pattern一致；没有 DELETE/restore/GC。

## Test Plan Review

Required suites：

1. shared Zod + RBAC matrix；
2. ZIP validator unit/adversarial property fixtures；
3. RdbProvider contract on SQLite/PostgreSQL + schema parity；
4. S3SkillContentStore contract on AWS and non-AWS compatible target；
5. publication service deterministic failure matrix，区分 retryable-stays-uploading 与 terminal-failed；
6. HTTP route auth/retry/concurrency/content/disconnect；
7. CLI/MCP mapping；
8. production component/browser keyboard/responsive/a11y；
9. full typecheck/test/lint and GitNexus detect_changes。

## Deferred Risks Accepted

- Failed publication objects accumulate until a future hard-delete/GC spec。Accepted because physical deletion was explicitly deferred；object keys remain attributable through Revision rows。
- Full-ZIP preview may cost one object read per file。Accepted under 20 MiB cap and measurable revisit trigger。
- No malware scanning/signature/SBOM。Accepted because Control Plane never executes content and Runtime delivery is out of scope；future delivery spec must revisit trust policy。

## External Review Resolution

ChatGPT Taco review 的初始裁定为 `CLEARED_WITH_REQUIRED_SPEC_FIXES`。本轮处理结果：

1. retryable provider failure 与 failed 状态冲突：已改为 retryable/config failure 保持 uploading；
2. canonical digest 顺序：已定义 metadata/content 两阶段扫描；
3. unknown frontmatter：已选择 safe parse then ignore，RDB 只投影 name/description；
4. initial resourceRevision：已固定 hidden=0、first visible=1；
5. credential source：已统一为 explicit pair else default provider chain；
6. scale/performance：已定义独立容量 fixture 与 benchmark evidence。

因此当前结论恢复为 `CLEARED_WITH_GATES`；这些 gate 属于实现验证，不再是未决合同。

## Unresolved Decisions

None。任何实现试图增加 filesystem、restore、GC、public marketplace、Agent binding 或 Runtime delivery，应停止并新开 spec，而不是把 scope creep 写成“顺便”。
