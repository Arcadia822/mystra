---
title: "Implementation Plan：Control Plane Skill 库与不可变 Revision"
taco_scope: plan
---

**Branch**: `056-skill-library` | **Date**: 2026-08-17 | **Spec**: [spec.md](spec.md)

## Summary

056 建立 Team-scoped Skill 库，内容输入只接受 ZIP。Control Plane 在 20 MiB 有界 Buffer 中先扫描 central-directory metadata、保存最多 1,200 个 descriptors 并确定最终路径排序，再一次读取一个 entry stream，生成逻辑 manifest、原始 ZIP SHA-256 和规范内容 SHA-256；不创建临时解包目录。每次创建/更新都产生不可变 `SkillRevision`，RDB 保存 Skill/Revision/manifest/发布状态，对象存储保存一个不可变原始 ZIP。发布使用 `uploading row -> PutObject -> finalize transaction` 协议，retryable provider/config failure 保持 `uploading`，只有 `ready` Revision 能原子成为 current。删除为 archive，历史 Revision 和对象不删除。

第一阶段交付 canonical HTTP API、`mystra` CLI、适用于 JSON/读取操作的 remote MCP 工具、以及 secondary Web UI。Agent/Session/Runtime 绑定与内容交付、hard delete、restore、retention 和 GC 全部后置。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0
**Primary Dependencies**: Next.js 16、React 19、Zod 4、Prisma 7.9.1、Vitest 4、`@mystra/ui`；新增 `@aws-sdk/client-s3`、`yauzl` 3.4.x、`yaml` 2.9.x
**Storage**: SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 通过 `RdbProvider` 保存元数据；单一 S3-compatible `S3SkillContentStore` 保存不可变 ZIP；无 filesystem adapter、RDB BLOB 或 per-file object source of truth
**Testing**: shared Zod/unit、ZIP adversarial corpus、RdbProvider contract/schema parity、route/CLI/MCP、S3-compatible provider contract、publication failure injection、React component、prototype/production browser journey
**Target Platform**: SaaS Control Plane Node runtime；已认证 Team 用户；320px–1440px Web；prototype route `/056-skill-library`
**Project Type**: TypeScript monorepo Web/API service、CLI 与 remote MCP adapter
**Performance Goals**: list/detail 元数据查询 p95 < 300ms；20 MiB ZIP 发布在无 provider throttling 时 p95 < 5s；ready ZIP 下载首字节 p95 < 500ms；256 KiB preview p95 < 1s；列表与详情不触发 bucket listing。每项通过对应独立 fixture 的至少 100 次 warmed samples 报告 p50/p95、环境与 provider
**Constraints**: 单请求原始 ZIP上限 20 MiB；总解压 100 MiB；单文件 20 MiB；最多 1,000 files/1,200 all entries；`SKILL.md` 1 MiB；preview 256 KiB；峰值内容模型为一个 ZIP Buffer + 最多 1,200 bounded descriptors + 一个 entry stream；无临时目录；对象 key 仅平台生成；跨 Team fail closed
**Scale/Scope**: 10,000 Skills/Team、1,000 ready Revisions/Skill 与 1,000 manifest entries/Revision 是分别验证的独立容量目标，不承诺三者在同一 Team 同时达到；第一阶段无内容搜索索引或 Runtime delivery

## Constitution Check

- **Product boundary**: PASS。Skill library 是明确的新 Team resource；不借机增加 workflow、automation、Artifact、Agent/Session orchestration 或 Runtime delivery。
- **Typed contracts**: PASS。shared Zod 定义 Skill、Revision、manifest、分页、错误与 preview；API/CLI/MCP/Web 共享该合同。
- **Provider boundaries**: PASS WITH NARROW SEAM。对象存储位于 `SkillContentStore` port 后，但第一阶段只有 `S3SkillContentStore` implementation；这不是 deployment adapter catalog。RDB 仍只通过 `RdbProvider`，不泄漏 Prisma 或 dialect。
- **RDB blast radius**: PASS WITH CRITICAL IMPLEMENTATION GATE。GitNexus 对 `RdbProvider` 返回 CRITICAL：44 direct、153 total、44 flows。实现必须将 Skill 方法作为窄分组加入，更新 SQLite/PostgreSQL schema parity 和完整 provider contract，不得改写现有方法语义。
- **Team authorization**: PASS。新增 `team.skill.manage` 映射 Owner/Admin；读取复用 `team.resource.access`；任何 object read 必须先从 Team-scoped RDB relation 解析，不接受 caller object key。
- **Secret hygiene**: PASS。S3 endpoint/bucket 是平台部署配置；credential 优先使用 both-or-neither 的显式 pair，否则在启动时解析 SDK provider chain。两者均失败则 fail closed；credential 不进入 RDB、公开响应、日志或浏览器。
- **UI prototype reuse**: PASS。prototype route `/056-skill-library` 使用 `PrototypeShell` 和 `@mystra/ui` 的 surface/action/field/dialog/icon；feature-owned 只有 mock data、composition 与 layout CSS。1440×1000、720×1000 已截图检查。
- **Verification/docs**: PASS。计划包含安全语料、跨存储失败注入、provider contract、浏览器验收和 Taco；implementation 前仍需完成 engineering review gates。

Post-design re-check：PASS WITH GATES。设计没有新增 filesystem deployment path、per-file object fan-out、public object URL、Runtime delivery 或硬删除。跨 RDB/S3 原子性使用可恢复 publication protocol，而不是假装两个系统共享事务。

## Architecture And Data Flow

```text
Authenticated Team actor
        │
        ├─ list/detail/history ──> RdbProvider ──> Skill + ready Revision + manifest
        │
        ├─ preview ──────────────> authorize in RDB
        │                            └─ GetObject ZIP (bounded Buffer)
        │                                 └─ lazy scan to exact manifest path
        │                                      └─ UTF-8 allowlist + 256 KiB
        │
        └─ download ─────────────> authorize in RDB
                                     └─ GetObject stream through Control Plane

No read path uses ListObjects. No client receives bucket, key, credential, or durable object URL.
```

```text
Create / Publish new Revision

bounded application/zip bytes
  └─ validate every entry + parse SKILL.md + build manifest/digests
       └─ RDB tx A
            ├─ lock active-name Skill or current Skill
            ├─ find/resume by baseRevisionId + zipSha256
            └─ create Revision(uploading, sequence null, deterministic object key)
                 └─ S3 PutObject(original bytes, immutable key)
                      └─ HeadObject length/application metadata check
                           └─ RDB tx B (expected Skill revision + active guard)
                                ├─ assign next sequence; Revision uploading -> ready
                                ├─ Skill.currentRevisionId -> new Revision
                                └─ Skill.resourceRevision + 1

Failure before tx A: no state
Failure after tx A: retry same base Revision + ZIP SHA-256 resumes same Revision
Failure after PutObject: retry HeadObject + finalize; no second object key
Retryable timeout/throttle/5xx/config failure: Revision remains uploading; current unchanged
Terminal object integrity or lost archive/base invariant: Revision marked failed
Archive wins before finalize: finalize rejected, Revision marked failed, object retained for deferred GC
```

初次创建没有 base Revision：事务通过 `(teamId, activeName)` 锁定隐藏或可见 Skill，再用 ZIP SHA-256 定位同一尝试。隐藏 Skill 使用 `resourceRevision=0`，第一次 ready finalize 设置为 1。archive 在事务内把 `activeName` 清为 null，从而允许新的 Skill ID 复用历史名称。该设计没有 `SkillCommand`、operation ID 或持久化请求幂等键。

## Project Structure

```text
packages/shared/src/
├── skill.ts                            # Skill/Revision/manifest/page/preview Zod contracts
├── team.ts                             # team.skill.manage permission
├── management.ts                       # HTTP request/response exports
└── index.ts                            # public exports

apps/control-plane/
├── prisma/{sqlite,postgresql}/schema.prisma
├── src/lib/db/
│   ├── rdb-provider.ts                 # narrow Skill persistence methods
│   ├── rdb-provider.contract.ts        # shared provider behavior
│   └── prisma-{provider,mappers}.ts
├── src/lib/skills/
│   ├── skill-content-store.ts          # internal port, no deployment selection catalog
│   ├── s3-skill-content-store.ts       # sole production implementation
│   ├── skill-storage-config.ts         # server-only deployment config
│   ├── skill-zip-validator.ts          # bounded lazy-entry validation/manifest
│   ├── skill-publication-service.ts    # resource/content-keyed two-system protocol
│   ├── skill-query-service.ts          # authorized list/detail/history
│   ├── skill-preview-service.ts        # exact Revision file read
│   └── skill-errors.ts                 # stable domain/error mapping
├── app/api/skills/                     # canonical list/create/detail/revision/archive/files/download
├── app/skills/                         # production Skill library/detail route
└── app/_components/                    # production adapters using @mystra/ui

apps/control-plane/app/api/mcp/route.ts # JSON-safe list/get/history/preview/archive tools
scripts/operator-cli.mjs                # mystra skills list/show/upload/publish/download/archive
apps/spec-prototype/                    # approved mock composition, no production adapters
specs/056-skill-library/                # spec/plan/research/model/contracts/review
```

**Structure Decision**: 沿用 monorepo、shared schema、RdbProvider、canonical route 和 thin adapter 分层。对象存储属于新的 external service port，但只有一个 S3-compatible implementation；不新建 service、package 或 provider registry。生产 Web composition 可以复用 prototype 的信息结构，但必须通过 production adapters 调用 canonical API，fixture 不得迁移。

## Implementation Slices

1. Shared Skill/Revision/manifest/error contracts、`team.skill.manage` 与 contract tests。
2. SQLite/PostgreSQL Prisma schema parity、Skill persistence narrow methods、provider contract 与 cursor ordering。
3. ZIP validator：Buffer cap、metadata/content 两阶段扫描、bounded descriptors、root detection、最终路径排序、path/type/collision/size/CRC、安全语料与 entry-order-independent 规范摘要。
4. S3-only content store/config/provider contract：Put/Get/Head、private bucket、显式 pair/default provider chain、metadata、length/checksum mapping、stream cancellation。
5. Publication service：Revision uploading/ready/failed、retryable-stays-uploading、terminal failure、activeName reservation、baseRevisionId + zipSha256 retry、resourceRevision 0->1、archive/finalize race 和 failure injection；不增加 command ledger。
6. Canonical API：list/create/detail/revisions/manifest/preview/download/archive；统一 auth/RBAC/error/content headers。
7. Thin CLI 和 JSON-safe MCP；二进制 upload/publish 由 API、CLI 与 Web 提供，MCP 不传 26+ MiB base64 payload。
8. Production `/skills` UI：list/filter/include archived、detail/Revision/file、preview/download、upload/new Revision、archive confirm；不加入 primary menu。
9. 全量 typecheck/test、schema parity、S3-compatible integration、20 MiB memory evidence、安全回归、browser acceptance、docs/Taco/status refresh。

## Engineering Review Gate

工程评审记录见 [engineering-review.md](engineering-review.md)。规划状态为 `CLEARED_WITH_GATES`：没有未决产品决策；实现前必须执行 RdbProvider CRITICAL blast-radius、publication recovery、ZIP adversarial、S3 compatibility、Team authorization 和 MCP binary-boundary gates。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| External Taco Review | ChatGPT review | Contract consistency | 1 | REQUIRED FIXES RESOLVED | retry state, two-stage digest, frontmatter plus 3 non-blocking closures |
| Eng Review | `/plan-eng-review` | Architecture, failure modes, tests, security, performance | 1 | CLEAR WITH GATES | 6 gates, 0 unresolved product decisions |
| Design Review | shared-code prototype | UI/UX contract | 1 | PASS | 1440/720 visual check; browser interaction remains implementation gate |
| DX Review | `/plan-devex-review` | Developer experience | 0 | — | — |

**VERDICT**: ENGINEERING CLEARED WITH EXPLICIT IMPLEMENTATION GATES；等待 owner 审阅 Taco 后再进入 `/speckit.tasks` 与 implementation。
