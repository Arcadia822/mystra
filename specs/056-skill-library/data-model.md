---
title: "Data Model：Skill 与 SkillRevision"
taco_scope: plan
---

## Model Overview

```text
Team 1 ─── * Skill 1 ─── * SkillRevision
                  │              │
                  │              ├── baseRevisionId ──> prior ready SkillRevision
                  │              └── manifestJson: SkillManifestEntry[]
                  └── currentRevisionId ──> one ready SkillRevision

SkillRevision.objectKey ──> private S3-compatible ZIP object
```

关系模型只有 `Skill` 与 `SkillRevision` 两个 feature-owned table。`SkillManifestEntry` 是嵌入 Revision JSON 的 Zod/TypeScript value，不是 table；对象存储 key 也不能独立证明 tenancy。所有读取都先通过 Team -> Skill -> Revision relation 授权。

## Entity: Skill

| Field | Type | Rules |
|---|---|---|
| `id` | UUID/string | 平台生成，immutable |
| `teamId` | Team ID | required；tenant parent |
| `name` | string | 从第一个 ready Revision 的 `SKILL.md` 解析；历史显示名；immutable |
| `activeName` | nullable string | active 或首次发布中时等于 `name`；archived 时为 null |
| `status` | `active \| archived` | default `active`；archive 单向，restore deferred |
| `currentRevisionId` | nullable Revision ID | 初次发布 finalize 前可 null；可见 Skill 必须指向本 Skill ready Revision |
| `resourceRevision` | non-negative integer | hidden initial reservation 为 0；第一次 ready finalize 设置 1；之后 current pointer/archive 每次成功变更 +1 |
| `createdByUserId` | User ID | actor audit |
| `createdAt` | timestamp | immutable |
| `updatedAt` | timestamp | current/archive change |
| `archivedByUserId` | nullable User ID | archive actor |
| `archivedAt` | nullable timestamp | 与 status 一致 |

### Skill constraints

- Unique `(teamId, activeName)`；数据库允许多个 null，因此多个 archived Skills 可以保留相同 `name`。
- `status=active` 时 `activeName=name`；`status=archived` 时 `activeName=null` 且 `archivedAt` non-null。
- archive 在同一事务内清空 `activeName`，因此随后上传同名 ZIP 会创建新的 Skill ID，而不是复活旧 Skill。
- `currentRevisionId` 必须引用同一 Skill 且 `publicationStatus=ready`。
- 普通 list/detail 必须要求 `currentRevisionId IS NOT NULL`；未完成首次 publication 的内部 Skill 不可见。
- `currentRevisionId IS NULL` 的隐藏 initial Skill 必须为 `resourceRevision=0`；第一个可见状态固定为 1，任何公开表面不得返回 0。
- 未完成首次 publication 的 Skill 仍占用 `activeName`。同名重试在行锁/事务内复用该 Skill；不同 ZIP 可在同一隐藏 Skill 下开始新的首次发布尝试，成功的第一个 ready Revision 获得 sequence 1。
- archived Skill 不接受新 Revision，只能按 Skill ID 读取历史。restore deferred；未来若增加 restore，必须重新竞争 `activeName`。

## Entity: SkillRevision

| Field | Type | Rules |
|---|---|---|
| `id` | UUID/string | 平台生成，immutable |
| `skillId` | Skill ID | required parent |
| `baseRevisionId` | nullable Revision ID | initial publication 为 null；update 时为发起更新所基于的 current ready Revision，必须属于同一 Skill |
| `sequence` | nullable positive integer | `uploading/failed` 为 null；finalize ready 时分配为 current sequence + 1；ready rows unique `(skillId, sequence)` |
| `publicationStatus` | `uploading \| ready \| failed` | 只允许指定转换 |
| `description` | string | 从该 Revision `SKILL.md` 解析 |
| `manifestJson` | JSON array | 排序后的 logical entries；由共享 schema 校验 |
| `compressedSizeBytes` | integer | `1..20 MiB`；原始 ZIP 长度 |
| `uncompressedSizeBytes` | integer | `1..100 MiB`；regular file 总和 |
| `zipSha256` | 64-char hex | 原始 upload bytes；重复发布的内容身份 |
| `contentSha256` | 64-char hex | 规范 logical file tree |
| `objectKey` | string | 由 Team ID、Skill ID 与 Revision ID 确定生成；所有 publication states 保留 |
| `createdByUserId` | User ID | actor audit |
| `createdAt` | timestamp | reservation time |
| `readyAt` | nullable timestamp | ready transition |
| `failedAt` | nullable timestamp | failed transition |
| `failureCode` | nullable stable code | 无 stack、credential 或 object secret |

### Why `baseRevisionId` is persisted

它不是 operation ID，也不是请求携带的 `expectedSkillResourceRevision` 副本。它表示该 Revision 的稳定父版本，承担两项职责：

1. 说明该发布基于哪个 ready Revision，形成清晰 lineage；
2. 即使发布成功后 current pointer 已移动，服务仍可用 `(skillId, baseRevisionId, zipSha256)` 找回原发布并安全返回同一结果。

瞬时 `If-Match`/expected resource revision 只用于进入发布前的并发判断，不落在 Revision row。

### Publication state machine

```text
uploading ── retryable provider/config failure ──> uploading
uploading ── Put + Head + finalize guards pass ──> ready
uploading ── integrity conflict/archive/base lost ──> failed
```

ZIP validation 在 RDB reservation 前完成，所以 ordinary invalid ZIP 不产生 Revision。timeout、throttle、5xx、凭据解析或存储配置不可用时，Revision 保持 `uploading`，current 不变；请求返回稳定 provider error，后续同 tuple 先 Head，匹配对象则继续 finalize，不存在则重试 Put。`uploading` 因而是可恢复发布状态，不等于后台任务正在持续运行。

只有同一 Revision 已不可能合法 finalize 时才进入 `failed`：object metadata/bytes integrity conflict、Skill 已 archived、`currentRevisionId` 不再等于 `baseRevisionId`，或等价的终止性 invariant failure。`failed` 是 immutable terminal state；相同 tuple 返回既有稳定失败，不创建第二个 ready Revision。provider credential/configuration 即使当前不可用也可能被运维修复，因此不把该外部条件永久固化为 `failed`。

`sequence` 只在 ready finalize 时分配，所以失败发布不会消耗面向用户的 Revision 编号。finalize 事务必须同时验证：Skill 仍 active、`currentRevisionId=baseRevisionId`、expected resource revision 仍匹配，并原子写入 sequence、ready 状态、current pointer 和 Skill resource revision。initial finalize 将 0 设置为 1；update finalize 在原值上 +1。

## Embedded Value: SkillManifestEntry

| Field | Type | Rules |
|---|---|---|
| `path` | string | logical root-relative POSIX path；NFC；no leading slash/dot segments/backslash/NUL |
| `sizeBytes` | integer | `0..20 MiB` |
| `sha256` | 64-char hex | uncompressed bytes |
| `mediaType` | string | deterministic extension/content classification，不进行 active sniff/render |
| `previewability` | `text \| binary \| too_large \| invalid_utf8 \| unsupported` | preview contract |

Manifest 只包含 regular files。目录通过 path prefix 推导；不保存 ZIP timestamps、permissions、owner 或 symlink metadata。文件树和指定路径查询在 Phase 1 从 `manifestJson` 读取，不需要为 1,000 个以内的 entry 维护一张额外关系表。若未来出现跨 Skill 文件级检索需求，再用独立规格评估索引结构，而不是提前制造同步一致性问题。

`SKILL.md` 未知 frontmatter 不属于 `SkillManifestEntry`，也不增加 Revision JSON 字段。服务只投影 `name` 与 `description`；其余字段安全解析后忽略，但原始 `SKILL.md` bytes 仍在不可变 ZIP 中，因此没有修改或丢失上传内容。

## Retry And Concurrency

- 不存在 `SkillCommand`、operation ID、持久化 `Idempotency-Key` 或通用 workflow table。
- initial create：`(teamId, activeName)` 锁定/定位隐藏或可见 Skill，`zipSha256` 定位相同首次发布。相同内容恢复或返回既有结果；不同内容在同一尚未 ready 的 Skill 下创建新的尝试。
- update：`(skillId, baseRevisionId, zipSha256)` 定位同一发布。相同 tuple 恢复/返回；不同 ZIP 是新发布，并必须通过当前 `If-Match` 检查。
- archive：active -> archived 在事务内完成；目标已 archived 时直接返回当前 archived 表示，不再次写 lifecycle fact。
- 这是资源/内容级重复安全，而不是对任意请求 ID 提供严格 exactly-once。Phase 1 没有业务需要为每次 HTTP 尝试永久保存一行操作记录。

## Indexes

- `Skill(teamId, status, updatedAt DESC, id DESC)`：默认列表 cursor。
- `Skill(teamId, activeName)` unique：active/首次发布名称占用；archived null 不冲突。
- `Skill(teamId, name, archivedAt DESC)`：按历史 name 定位 archived Skills（非 unique）。
- `SkillRevision(skillId, sequence DESC)`：ready history page；ready sequence 由 partial unique constraint 或等价 provider constraint 保证唯一。
- `SkillRevision(skillId, baseRevisionId, zipSha256)`：publication retry lookup；initial null-base duplicate 防护由持有 Skill row lock 的 reservation transaction 保证。
- `SkillRevision(skillId, publicationStatus, createdAt DESC)`：受限 recovery diagnostics。

## Deletion And Retention

- archive 只更新 Skill lifecycle fields 并清空 `activeName`，不修改 Revision/object。
- 第一阶段没有 cascade delete path、`DeleteObject` 调用、retention timestamp 或 restore transition。
- pre-0.1 schema 可以直接重建，不为未发布的旧 Skill 模型建立 migration alias。
