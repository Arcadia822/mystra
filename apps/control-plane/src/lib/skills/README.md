# Skill Library server boundary

This directory owns phase-1 Skill content validation, publication, query, preview and S3-compatible storage composition.

## Invariants

- The original ZIP is the only content object for a Revision. `SkillContentStore` has one production implementation, `S3SkillContentStore`; it deliberately has no filesystem or delete method.
- Object keys are generated from server-owned Team, Skill and Revision IDs. User filenames and logical paths never enter a key.
- Upload accepts one raw `application/zip` body capped at 20 MiB. Validation keeps that Buffer, at most 1,200 bounded entry descriptors and one open entry stream. It never creates an extraction directory or a decompressed file map.
- Every entry is metadata-checked before root selection. Regular-file content is then consumed once in final logical-path order for CRC, size, file hash, preview classification and the canonical content digest.
- ZIP content is untrusted data. No script is executed, no module is loaded, and HTML/SVG is never rendered as active content.
- Retryable S3 timeout/throttle/5xx and credential/configuration failures leave a publication `uploading`. Only terminal integrity or concurrency failures may make it `failed`.
- Archive is metadata-only. It does not delete a Revision or object; physical deletion and GC are absent from this port.

## Required deployment configuration

`MYSTRA_SKILL_STORAGE_ENDPOINT`, `MYSTRA_SKILL_STORAGE_REGION` and `MYSTRA_SKILL_STORAGE_BUCKET` are required. `MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE` is an optional `true`/`false` flag.

Production endpoints must use HTTPS. The adapter supports path-style addressing for providers such as S3rver/MinIO/R2 when their endpoint contract requires it.

Credentials are either an explicit both-or-neither access-key pair (`MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID` and `MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY`) or the AWS SDK default provider chain. The default chain is resolved once at startup to fail closed while the refreshable provider remains attached to the client. Credential values are never logged, persisted or returned.

## Focused verification

```bash
pnpm --filter @mystra/control-plane exec vitest run src/lib/skills
```

## Operator surfaces

The Web routes are `/skills` and `/skills/<skill-id>`。The canonical HTTP surface is `/api/skills`。The thin CLI exposes `skills list/show/upload/publish/preview/download/archive`；remote MCP exposes JSON-safe list/get/history/preview/archive only and deliberately excludes ZIP base64 payloads。
