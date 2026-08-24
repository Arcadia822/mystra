---
title: "Contract：Skill Management API"
taco_scope: plan
---

## Common Rules

- Base path: `/api/skills`
- Auth: existing Human session / active Team context。
- Read permission: `team.resource.access`；write permission: `team.skill.manage`。
- Resource IDs in path never select Team；server resolves them under active Team。
- JSON errors use existing management error envelope with stable code、message、optional field details；never expose bucket/key/provider raw errors。
- `ETag: "<resourceRevision>"` is returned on Skill detail/write responses。
- The first visible Skill response always has `resourceRevision=1` and `ETag: "1"`；internal initial reservation value 0 is never exposed。
- Binary create/publish require `Content-Type: application/zip`。Update additionally requires `If-Match: "<resourceRevision>"`；expected revision 是瞬时并发条件，不持久化到 Revision。

## Routes

### `GET /api/skills`

Query:

- `cursor?: string`
- `limit?: 1..100`，default 50
- `query?: string`，name/description metadata only
- `includeArchived?: boolean`，default false

Response `200`:

```ts
{
  items: SkillSummary[];
  nextCursor: string | null;
}
```

No bucket listing or object read is allowed.

### `POST /api/skills`

Headers:

- `Content-Type: application/zip`
- `Content-Length` required and `<= 20 MiB`

Body: raw ZIP bytes。

Response `201`: `{ skill: SkillDetail, revision: SkillRevisionDetail }`。

Repeat behavior:

- 同一 Team 中 active/首次发布 Skill 的 name 来自 ZIP `SKILL.md`。
- 相同 active name + 相同 ZIP SHA-256 恢复或返回同一 Skill/Revision。
- 相同 active name + 不同 ZIP 在 Skill 已 ready 时返回 `skill_name_conflict`；在首次发布尚未 ready 时，可在同一隐藏 Skill 下开始新尝试。
- 仅存在同名 archived Skill 时不冲突：创建新 Skill ID 与 Revision 1。

Failure codes: `invalid_content_type`、`content_length_required`、`skill_zip_too_large`、`invalid_skill_zip`、`skill_name_conflict`、`skill_storage_unavailable`、`publication_failed`。

Provider failure response/state:

- timeout、throttle or 5xx returns `503 skill_storage_unavailable` with bounded retry guidance；Revision remains `uploading`。
- credential/config/auth failure returns `503 skill_storage_misconfigured` without provider detail；Revision remains `uploading` so an operator repair can unblock the same tuple。
- terminal object integrity conflict or lost archive/base invariant returns a stable conflict/publication failure and records Revision `failed`。
- retrying an `uploading` tuple performs Head first；matching object resumes finalize, missing object retries Put。

### `GET /api/skills/{skillId}`

Response `200`: Skill detail + current ready Revision summary；archived 可直接 ID 读取。

### `GET /api/skills/{skillId}/revisions`

Query: `cursor?`、`limit?`。只返回 ready Revisions；failed/uploading 由 server diagnostics 而非普通产品历史拥有。

### `POST /api/skills/{skillId}/revisions`

Headers:

- same ZIP headers as create
- `If-Match: "<resourceRevision>"` required

Body: raw ZIP bytes。`SKILL.md.name` 必须等于 Skill stable name。

Response `201`: new Revision detail + updated Skill ETag。

Failure adds `skill_archived`、`skill_name_mismatch`、`revision_conflict`。

在进入发布时记录当前 `currentRevisionId` 为 `baseRevisionId`。相同 `skillId + baseRevisionId + zipSha256` 的重复请求恢复或返回同一 Revision，即使第一次成功后 current pointer 已移动；不同 ZIP 或不同 base 是新发布，并必须重新通过 `If-Match`。

### `GET /api/skills/{skillId}/revisions/{revisionId}`

Response `200`: ready Revision detail including ordered embedded manifest；`objectKey`、bucket、publication failure fields are server-private and omitted。

### `GET /api/skills/{skillId}/revisions/{revisionId}/file?path=<encoded logical path>`

Response `200` for previewable text:

```ts
{
  revisionId: string;
  sequence: number;
  file: SkillManifestEntry;
  content: string;
  truncated: false;
}
```

Response `422` with `skill_file_not_previewable` and `{ reason }` for binary/too_large/invalid_utf8/unsupported。Path must exactly match manifest after URL decoding；server does not apply caller path normalization as a lookup fallback。

Headers: `Cache-Control: private, no-store`、`X-Content-Type-Options: nosniff`；active HTML is returned only as escaped/plain text JSON string, never `text/html`。

### `GET /api/skills/{skillId}/revisions/{revisionId}/download`

Streams exact ZIP bytes after RDB authorization。

Headers:

- `Content-Type: application/zip`
- `Content-Length: <recorded compressed size>`
- `Content-Disposition: attachment; filename="<sanitized-name>-r<sequence>.zip"`
- `Digest: sha-256=<base64 digest>` when supported by existing HTTP utilities
- `Cache-Control: private, no-store`

No redirect or presigned public URL in phase 1。

### `POST /api/skills/{skillId}/archive`

Headers: `If-Match` required。Empty body or `{}`。

Response `200`: archived Skill detail。若目标已经 archived，服务先返回当前 archived 表示，不因重试携带的旧 `If-Match` 再制造一次冲突，也不重复写 lifecycle fact。首次 active -> archived 转换仍要求 `If-Match` 匹配，并在同一事务内清空 `activeName`。

## CLI Mapping

```text
mystra skills list [--include-archived]
mystra skills show <skill-id> [--revision <id|sequence>]
mystra skills upload <bundle.zip>
mystra skills publish <skill-id> <bundle.zip> --expected-revision <n>
mystra skills preview <skill-id> --revision <id|sequence> --path <logical-path>
mystra skills download <skill-id> --revision <id|sequence> --output <file.zip>
mystra skills archive <skill-id> --expected-revision <n>
```

CLI reads/writes local ZIP only as an explicit operator action；it never treats a server local path as content input。

## MCP Mapping

JSON-safe tools:

- `skills_list`
- `skill_get`
- `skill_revisions_list`
- `skill_revision_get`
- `skill_file_preview`
- `skill_archive`

Binary create/publish/download do not use base64 MCP payloads in phase 1。Tool descriptions return the canonical API/CLI route for those actions；this is an explicit transport boundary, not an unavailable hidden fallback。
