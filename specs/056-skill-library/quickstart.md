---
title: "Quickstart：实现与验证 Skill Library"
taco_scope: plan
---

## Toolchain

```bash
fnm install 24.14.0
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
```

## Server-only test configuration

Use a dedicated private test bucket and least-privilege credentials。Do not commit values。

```text
MYSTRA_SKILL_STORAGE_ENDPOINT=https://...
MYSTRA_SKILL_STORAGE_REGION=...
MYSTRA_SKILL_STORAGE_BUCKET=...
# Optional explicit pair; omit both to use the SDK default provider chain.
MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID=...
MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY=...
MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE=false
```

Credential policy needs only PutObject/GetObject/HeadObject for the fixed Skill prefix。DeleteObject、ListBucket、ACL、bucket administration are not required in phase 1。

The production endpoint must use HTTPS。Local compatibility testing may use a test-only in-process adapter configuration；browser/runtime acceptance in this feature used an ephemeral self-signed HTTPS S3rver endpoint trusted only by the spawned Node process。

The explicit access-key variables are both-or-neither。When both are absent, startup eagerly resolves the SDK default provider chain；when exactly one is present or neither source resolves, startup fails closed。

## Recommended implementation order

1. Add shared contracts and permission with tests。
2. Add both Prisma schemas and RdbProvider contract methods together。
3. Build the ZIP validator entirely behind adversarial fixtures before wiring HTTP。
4. Add S3 content-store contract and env validation。
5. Build publication service with injected failures at every RDB/S3 boundary。
6. Add API then CLI/MCP adapters, then production Web composition。

## Focused verification

```bash
pnpm --filter @mystra/shared test
pnpm --filter @mystra/control-plane test -- skill
pnpm --filter @mystra/control-plane typecheck
pnpm --filter @mystra/spec-prototype test
pnpm --filter @mystra/spec-prototype typecheck
pnpm --filter @mystra/spec-prototype build
```

Full gate before implementation handoff:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm gitnexus:doctor
```

Before commit, run GitNexus `detect_changes` against `main` and inspect affected flows。Because `RdbProvider` impact is CRITICAL, focused Skill tests are insufficient; complete provider contracts and schema parity are mandatory。

## Contract scenarios

- Create valid root ZIP -> Revision 1 ready/current。
- Create valid single-folder ZIP -> prefix stripped logically。
- Update with correct If-Match -> Revision N+1；old bytes unchanged。
- Update with stale If-Match -> 409；no new ready Revision。
- Archive 后上传相同 name -> 新 Skill ID + Revision 1；旧 archived Skill 按 ID 保留。
- Archive while finalize waits -> archive/current invariants preserved；publication failed/object retained。
- Retry same base Revision + ZIP SHA-256 after PutObject before finalize -> same Revision/key finalized。
- Timeout/throttle/5xx before or after Put -> Revision remains uploading；provider recovery + same tuple resumes the same Revision。
- Object metadata mismatch or archive/base loss -> Revision failed；same tuple returns stable terminal failure。
- Hidden first publication uses resourceRevision 0；first visible response/ETag is 1。
- Retry archive after response loss -> current archived representation；no duplicate lifecycle write。
- Same logical files in differently ordered ZIP entries -> identical contentSha256；each regular file stream opened once。
- Exactly 1,000 regular files -> accepted；the 1,001st file or descriptor cap overflow -> rejected before publication。
- Unknown SKILL.md frontmatter -> safe parse succeeds but only name/description project to RDB；raw file remains in ZIP。
- Cross-Team list/detail/preview/download -> indistinguishable not-found/forbidden result。
- Binary/HTML/SVG/oversize preview -> metadata + stable non-preview reason。
- ZIP corpus: traversal、absolute、backslash、NUL、collision、Unicode/case collision、symlink、encrypted、zip bomb、CRC mismatch、noise flood。

## Prototype review

```bash
pnpm dev:prototype
```

Open <http://localhost:3010/056-skill-library> and verify list、include archived、Revision switch、text/binary preview、upload dialog、download notice and archive boundary at 320/768/1024/1440px。

Prototype is review evidence only。It contains fixtures and writes nothing。

## Performance evidence

Run each target independently rather than constructing the theatrical 10-billion-entry Cartesian product：

- 10,000-Skill metadata fixture for list/detail p95；
- one Skill with 1,000 ready Revisions for history pagination；
- one Revision with 1,000 manifest entries for detail/file lookup；
- 20 MiB ZIP publish fixture and 256 KiB preview fixture against the selected S3-compatible provider。

For each performance target record environment、database/provider、fixture shape and at least 100 warmed samples with p50/p95。

## Recorded implementation evidence（2026-08-24）

### S3 provider compatibility

AWS SDK command semantics and error mapping are covered by the injected `S3Client.send` contract；a real non-AWS S3-compatible round trip runs against `s3rver@3.7.1`：

```bash
pnpm --filter @mystra/control-plane exec vitest run \
  src/lib/skills/skill-content-store.test.ts \
  src/lib/skills/skill-content-store.s3rver.test.ts
```

Result：2 files、7 tests passed。The contract covers PutObject、HeadObject found/missing、streaming GetObject、application-owned SHA-256 metadata、content length、provider error redaction and stream cancellation。The S3rver fixture uses an ephemeral directory and loopback endpoint；no filesystem content-store adapter is introduced into Mystra。

### Warmed capacity/performance report

Command：

```bash
pnpm --filter @mystra/control-plane exec vitest run \
  src/lib/skills/skill-performance.test.ts \
  --disableConsoleIntercept --reporter=verbose
```

Environment：Apple M2 Pro、16 GiB、macOS 26.2、Node v24.14.0、SQLite，object operations use injected in-memory S3 semantics so provider/network latency is intentionally excluded from the publication algorithm measurement。Each result below uses 5 warmups followed by 100 measured samples：

| Independent fixture | p50 | p95 | Gate |
|---|---:|---:|---:|
| 10,000 Skills，first 100 list | 6.15 ms | 8.53 ms | < 300 ms |
| 10,000 Skills，one detail | 0.23 ms | 0.28 ms | < 300 ms |
| one Skill，1,000 ready Revisions，first 100 history | 1.04 ms | 1.67 ms | < 300 ms |
| 20 MiB-cap ZIP publication（20,969,818 bytes） | 184.33 ms | 189.28 ms | < 5 s |
| 256 KiB exact text preview | 1.82 ms | 2.25 ms | < 1 s |

The benchmark asserts one raw ZIP Buffer、最多 1,200 bounded descriptors、one concurrent entry stream and no temporary extraction directory。Provider-specific network p95 is not inferred from this local algorithm benchmark。

### Static and build gates

- Shared：20 files、157 tests passed。
- Focused Skill/provider/API/CLI/MCP/UI：15 files、111 tests passed。
- Full workspace：151 files passed、1 PostgreSQL-gated file skipped；724 tests passed、23 PostgreSQL-gated tests skipped。
- SQLite full RdbProvider contract and dual-schema parity passed；PostgreSQL runtime contract remains environment-gated when `MYSTRA_TEST_POSTGRES_URL` is absent，while PostgreSQL schema/migration parity is always checked statically。
- `pnpm typecheck`、`pnpm lint`、dual Prisma schema validation and `pnpm build` passed for the full workspace；production routes `/skills` and `/skills/[skillId]` plus all canonical Skill API routes are present in the Next.js build manifest。

### Shared-code prototype browser evidence

The interactive `/056-skill-library` route was checked in the Codex in-app Chromium browser at 320、768、1024 and 1440 px widths with a 1,000 px viewport height。All four widths reported `document.documentElement.scrollWidth === window.innerWidth`，and the console contained no warning or error。The run exercised active/archived filtering、Revision 3 → 2 → 3 switching、text preview、binary metadata-only reason、download notice、create/update ZIP dialog and archive-preserves-history boundary。

The 320 px pass exposed a shared `UiButton` height-specificity collision that compressed multi-line Skill rows to 28 px；both prototype and production Skill-library CSS now explicitly allow auto-height list rows，and the repaired rows measured about 93 px without text overlap。Prototype tests（9 files、40 tests）、typecheck and production build passed again after the correction。

### Production browser acceptance

The authenticated production routes `/skills` and `/skills/{skillId}` were exercised in the Codex in-app Chromium browser against an ephemeral SQLite database and self-signed HTTPS `s3rver` bucket。The run used generated non-sensitive ZIP fixtures and verified：

- empty Team-scoped list and local authentication；
- raw ZIP create -> active Skill + immutable Revision 1；
- exact `SKILL.md` text preview and original ZIP browser download；the downloaded bytes matched the uploaded fixture SHA-256 `0c3f354f993e5c4f10bd84d6bab73350c5fb2b532291ae8d700e0e5e705be774`；
- new ZIP publish -> Revision 2 current，Revision 1/2 switching preserved each version's exact content；
- binary `application/octet-stream` manifest entry exposed metadata plus stable `Preview unavailable` reason and was never rendered；
- archive removed the Skill from the default list，disabled mutation actions，preserved both Revisions under the ID route，and `includeArchived=true` exposed it；
- uploading the same `browser-review` name after archive created a new active Skill ID `6a81d9b7-ad4b-40fd-a3c4-bc7004e3efe8` while the archived ID `c0580ef6-3d95-42bb-92ac-be5efcade789` remained independently readable。

Responsive production evidence covered 320、768、1024 and 1440 px widths at 1,000 px height。Every pass reported `document.documentElement.scrollWidth === window.innerWidth` and the browser console contained no warning or error。The 320 px pass found an inherited Feature 054 selector that compressed the text-bearing `Upload ZIP` header action to 24 px；the Skill route now gives that action an explicit auto-width contract，measured at 100 px with its full label visible at all four widths。

After both browser-found CSS corrections，the full workspace gate was repeated：151 test files passed（1 PostgreSQL environment-gated file skipped）、724 tests passed（23 PostgreSQL-gated tests skipped），plus workspace typecheck、lint and production build。

### GitNexus and Spec-Kit audit

`pnpm gitnexus:doctor` passed with the repository-pinned GitNexus 1.6.9 and native LadybugDB module。`detect_changes(scope: all)` classified the uncommitted feature surface as CRITICAL because it extends the shared `RdbProvider`/Prisma client and Control Plane MCP/instrumentation seams；the expected mitigation is the complete SQLite provider contract、dual-schema parity、full API/MCP suites and workspace-wide regression gate above，not a narrower Skill-only test run。

The required `detect_changes(scope: compare, base_ref: main)` was also run。At audit time `main` was two commits ahead of the feature worktree HEAD，so that comparison included the inverse of unrelated main-only UI changes and reported 72 files；the `scope: all` result isolated the 26 tracked files actually modified in the worktree。No unexpected Skill-owned execution path was found。

The Spec-Kit status reporter refreshed `specs/spec-status.md` and recognized `056-skill-library` as the active feature with complete spec、plan、research、data model、quickstart、contracts and checklist artifacts。It reported 50/52 tasks complete before production-browser acceptance and final Taco packaging。
