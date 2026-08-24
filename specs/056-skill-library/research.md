---
title: "Research：Skill ZIP、对象存储与发布一致性"
taco_scope: plan
---

## R1. 内容存储单位

**Decision**: 每个 `SkillRevision` 保存一个不可变原始 ZIP 对象；RDB 保存完整逻辑 manifest 与摘要。对象 key 为 `teams/{teamId}/skills/{skillId}/revisions/{revisionId}/bundle.zip`，其中所有 ID 由平台生成。

**Rationale**:

- 单对象 Put 让 Revision 内容具备一个清晰的 publish unit；per-file objects 需要最多 1,001 次写入并处理部分成功，既扩大一致性面，也让下载必须动态重打包。
- 原始 ZIP 可被 byte-for-byte 下载；规范内容摘要另行消除 entry order、timestamp 和 compression metadata 差异。
- S3 是 flat object namespace，所谓目录只是 key prefix；设计不把 prefix 当成可事务的文件系统目录，也不使用 bucket listing 作为业务索引。[AWS object key 文档](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html)

**Alternatives rejected**:

- **每文件一个 object**：preview 便宜，但发布需要多对象 fan-out、失败补偿与动态 ZIP；Runtime delivery 尚未定义，不应提前支付复杂度。
- **RDB BLOB**：把 20 MiB archive 混入事务日志、备份、replication 和 ORM 内存面；不适合批准的 PostgreSQL/Supabase 方向。
- **Git repository**：版本/目录天然，但引入 commit/branch/auth/GC 语义，且上传 ZIP 仍需导入事务。
- **OCI/ORAS artifact**：digest/manifest 完整，但 registry auth、media type 与 client 过重，第一阶段没有 image/runtime distribution 需求。
- **filesystem**：owner 明确拒绝；SaaS source of truth 不绑定 Control Plane node disk。

## R2. ZIP 解析与内存模型

**Decision**: 使用 `yauzl` 3.4.x `fromBufferPromise()` + lazy entries + `validateEntrySizes`。请求首先受 20 MiB hard cap，保留一个原始 Buffer；先只遍历 central-directory metadata 并保存最多 1,200 个 bounded descriptors，确定逻辑根、最终路径和排序，再按最终 logical path 一次打开一个 entry stream，累计总解压大小、CRC/实际大小、per-file hash 与 canonical digest。

**Rationale**:

- ZIP central directory 需要 random access；`fromBuffer` 直接满足用户提出的“内存读取指定目录”，不需要临时目录。
- `lazyEntries` 明确避免大量 entry 并行带来的失控内存；`validateEntrySizes` 会核对声明与实际解压大小。[yauzl 官方 README](https://github.com/thejoshwolfe/yauzl)
- metadata-first 让完整扫描后再决定逻辑根与最终排序；content-second 保证每个文件内容只读取一次，且 canonical digest 不受 ZIP entry order 影响。
- descriptor 只保存 entry reference、规范路径、类型与声明 metadata，不保存解压内容。峰值模型是一个 ZIP Buffer + 最多 1,200 descriptors + 一个 entry stream。

**Alternatives rejected**:

- **临时隔离目录**：对本阶段没有必要；它主要适用于需要执行传统 filesystem 工具或 archive 大到不能合理保存在内存的场景。
- **把全部文件解压成 Buffer map**：100 MiB expanded cap 会直接成为常驻内存，不符合“一个 ZIP + 一个 entry”的约束。
- **直接 socket streaming unzip**：ZIP central directory/random access、原始 ZIP 持久化与全包校验会显著复杂化；20 MiB cap 下没有收益。

## R3. S3-compatible client 与兼容面

**Decision**: 使用实现时 registry 已核对的 `@aws-sdk/client-s3` 3.1116.0；production implementation 只依赖 PutObject、GetObject、HeadObject、private bucket、Content-Length、Content-Type 与 user metadata。S3 SDK 的 endpoint/region/path-style 配置由 server-only deployment config 提供。

**Rationale**:

- AWS SDK v3 是 Node/TypeScript 的模块化官方 client；PutObject/GetObject/HeadObject 足以完成本阶段。
- AWS S3 对对象 PUT/DELETE/read-after-write 提供 strong consistency；R2 也对 S3 API 直接访问提供 strong consistency。[AWS S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/)；[R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)
- S3-compatible 并不等于所有 header/operation 完全相同；R2 官方兼容表也明确存在差异，因此避免依赖 Object Lock、bucket versioning、notification、vendor lifecycle 或可选 checksum header。[R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- 应用自己计算并持久化 ZIP SHA-256；ETag 在 multipart/encryption 等情况下不是可靠内容身份。AWS 同样把 checksum 作为独立完整性机制。[AWS checksum 文档](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-checksums.html)
- Credential source 明确为：显式 access-key pair 优先，否则 SDK default provider chain；显式值必须 both-or-neither，composition root 在启动时主动解析凭据，两者均失败则 fail closed。该选择支持 SaaS workload identity，而不强迫长期静态 key。

**Compatibility test baseline**: 同一 env-gated contract suite 对 AWS S3 和一个非 AWS S3-compatible service 运行 Put/Get/Head、user metadata、missing object/error mapping、stream cancel 与 byte SHA-256。MinIO 可作为 CI fixture，但不成为产品 deployment adapter。

## R4. 跨 RDB 与对象存储发布

**Decision**: 使用两阶段 application protocol，而不是分布式事务：RDB reserve `uploading` Revision，写入确定 object key；Put/Head；RDB finalize transaction 置 ready 并移动 current pointer。

**Rationale**:

- RDB 与 S3 没有共同 transaction coordinator。先上传再写 DB 会产生无法关联的 orphan；先 finalize DB 再上传会暴露不可读 current。
- Revision 预留行让 object key、父 Revision、ZIP SHA-256 和失败都可关联。相同 `(skillId, baseRevisionId, zipSha256)` 重试只恢复或返回原 Revision，不生成第二个 ready Revision。
- finalize 再次检查 Skill active、expected resource revision、Revision uploading 和 object digest/length，处理 update/archive 竞争。

**Failure semantics**:

- timeout、throttle、5xx、凭据解析或存储配置不可用：Revision 保持 `uploading`，current 不变。相同 tuple 重试先 Head；匹配则继续 finalize，不存在则重试 Put。
- Put 成功、进程在 finalize 前崩溃：相同父 Revision 与 ZIP SHA-256 的重试通过 HeadObject 验证后继续 finalize。
- object integrity conflict，或 finalize 因 archive/base revision 已变化而不可能再成功：Revision -> `failed`，对象保留；后续 hard delete/GC spec 处理物理回收。
- 初次创建未 finalize：Skill `currentRevisionId` 为 null，普通 list/detail 不可见；同一 Team/name 的上传在 Skill row lock 下复用该隐藏 Skill，并按 ZIP SHA-256 恢复相同尝试。
- sequence 只在 ready finalize 时分配，因此 failed/uploading publication 不消耗面向用户的 Revision 编号。
- hidden initial Skill 使用 `resourceRevision=0`；第一次 ready finalize 原子设置为 1，公开 ETag 从 1 开始。

**Rejected**: 为每次 create/publish/archive 保存 `SkillCommand`、operation ID 或持久化 `Idempotency-Key`。第一阶段只需要资源级重复安全：Revision 已提供持久发布状态，archive 已提供目标状态。额外命令表只会永久记录 HTTP 尝试，并未增加用户需要的业务事实。

## R5. Preview 读取

**Decision**: Preview 先从 RDB manifest 校验 path、ready state、previewable 和 256 KiB 上限，再将最大 20 MiB ZIP 读取为 Buffer，用同一 validator/reader 定位 exact entry；不增加 per-file objects 或 range-reader。

**Rationale**:

- 本阶段 archive 上限使一次 GetObject 可控，且保持单内容表示。
- 自定义 S3 Range-backed `RandomAccessReader` 会对 central directory 和 entry 产生多次 provider request、取消/重试/缓存复杂度；在没有 preview traffic 证据时属于精致的提前优化。
- 下载不经过 Buffer，直接把 GetObject stream 透传并设置 private/no-store/content-disposition headers。

**Revisit trigger**: preview p95 超过 1s、对象 egress 成本显著、ZIP cap 上调或 Runtime delivery 需要随机单文件访问时，再评估 range reader 或派生 per-file cache。派生 cache 不得成为 source of truth。

## R6. `SKILL.md` 与 manifest

**Decision**: 使用 `yaml` 2.9.x 解析逻辑根 `SKILL.md` 的 leading frontmatter。第一阶段要求 `name` 与 `description` string；name 在单个 Skill 内不可变，并只在同一 Team 的 active/首次发布中 Skill 之间唯一。archive 释放 active name，随后同名上传创建新 Skill ID。安全解析后的未知 frontmatter 不投影到 RDB；原始 `SKILL.md` 已由不可变 ZIP 与 manifest file entry 保留，未来需要语义时应由新 spec 明确 schema 后重新解析。

**Canonical digest**:

1. Stage 1 忽略明确噪声后，对规范 POSIX logical path 做 Unicode NFC，并收集 bounded descriptor。
2. Stage 1 按 UTF-8 byte ordering 排序 descriptor，不读取文件内容。
3. Stage 2 按排序后的 descriptor 逐一打开 stream，对每个 regular file 输入 path byte length、path bytes、content length、content bytes。
4. SHA-256 得到 `contentSha256`；每文件另存 `sha256`。每个文件内容只消费一次。

ZIP SHA-256 单独对原始 upload bytes 计算。两个摘要解决不同问题，不能互相替代。

## R7. 管理表面

**Decision**:

- Canonical API + Web/CLI 支持全部 CRUD/Revision/preview/download。
- Remote MCP 支持 JSON-safe list/get/history/manifest/preview/archive；不把 20 MiB ZIP 编码成约 26.7 MiB base64 tool argument。
- 二进制 publish 的 agent caller 使用 canonical HTTP upload API 或 `mystra skills upload/publish` CLI。
- Skill 路由不加入 MVP primary menu；从 Team 管理上下文或稳定 `/skills` route 到达。

该差异是 transport capability，而不是第二套业务合同。所有表面仍复用 shared schemas、Team auth、资源级 retry/concurrency 语义与 domain errors。
