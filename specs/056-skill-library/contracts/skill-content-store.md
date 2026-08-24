---
title: "Contract：SkillContentStore 与 S3-compatible 实现"
taco_scope: plan
---

## Internal Port

```ts
interface SkillContentStore {
  putRevisionArchive(input: {
    objectKey: string;
    body: Buffer;
    contentLength: number;
    zipSha256: string;
  }): Promise<void>;

  headRevisionArchive(input: {
    objectKey: string;
  }): Promise<{
    contentLength: number;
    zipSha256Metadata?: string;
  } | null>;

  getRevisionArchive(input: {
    objectKey: string;
  }): Promise<{
    body: NodeJS.ReadableStream;
    contentLength: number;
    zipSha256Metadata?: string;
  }>;
}
```

No `delete` method in phase 1。Hard delete/GC 必须以新规格扩展，而不是让普通 archive service 获得物理删除能力。

## Sole Production Implementation

`S3SkillContentStore` 是第一阶段唯一 production implementation。Port 存在是为了：

- domain/publication service 不依赖 AWS SDK types；
- error mapping、stream cancellation 和 provider contract 可集中测试；
- unit tests 使用 in-memory fake，不意味着存在 filesystem deployment adapter。

不得增加 runtime adapter selection UI、provider registry 或 filesystem fallback。

## Object Rules

- Bucket private；禁止 public ACL 和 anonymous read。
- Key exact pattern: `teams/{teamId}/skills/{skillId}/revisions/{revisionId}/bundle.zip`。
- IDs 由 server 生成并按固定 ASCII encoding 插入；任何 user filename/path 不进入 key。
- Put uses exact `ContentLength`、`ContentType=application/zip` 和 user metadata `mystra-zip-sha256=<hex>`。
- Same Revision/key retries MUST be byte-identical。若 HeadObject metadata/length 与 reservation 不同，返回 `skill_storage_integrity_conflict`，不得 last-write-wins 覆盖。
- Application persists its own `zipSha256`；ETag/versionId 不进入 port、RDB 或业务判断。
- No ListObjects on business paths；orphan inventory belongs to deferred GC spec。

## Deployment Configuration

Server-only required storage location config:

- `MYSTRA_SKILL_STORAGE_ENDPOINT`
- `MYSTRA_SKILL_STORAGE_REGION`
- `MYSTRA_SKILL_STORAGE_BUCKET`
- `MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE` (boolean, default false)

Credential source:

1. If `MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID` and `MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY` are both present, use that explicit pair。
2. If neither is present, resolve the AWS SDK default credential provider chain at process startup；this permits workload identity、container/instance roles and equivalent SaaS deployment credentials。
3. If exactly one explicit value is present, or the selected source cannot resolve credentials, startup fails closed。

Startup validation also fails closed when required location config is absent or endpoint is not HTTPS outside explicit test mode。Secret values must be redacted from errors/logs and never enter RDB or client bundles。

## Error Mapping

| Provider condition | Domain result |
|---|---|
| timeout/throttle/5xx | `skill_storage_unavailable` (HTTP retryable; Revision remains `uploading`) |
| credential resolution/auth/permission | `skill_storage_misconfigured` (operator action; Revision remains `uploading`) |
| missing object on ready Revision | `skill_storage_integrity_error` |
| mismatched length/hash metadata | `skill_storage_integrity_conflict` |
| canceled downstream response | abort GetObject stream; no domain mutation |

Provider availability and configuration are external conditions that may recover, so they do not make a publication Revision terminal. For an `uploading` retry, publication first calls Head: matching object resumes finalize；missing object retries Put；mismatched length/hash metadata is a terminal integrity conflict and moves the Revision to `failed`。

## Compatibility Gate

Provider contract runs against AWS S3 and at least one non-AWS S3-compatible target。Required evidence:

- exact bytes round trip and app SHA-256 match；
- Head user metadata and Content-Length；
- missing key mapping；
- Get stream cancellation；
- deterministic retry of same key；
- no reliance on ETag shape, Object Lock, lifecycle, event notification or bucket versioning。
