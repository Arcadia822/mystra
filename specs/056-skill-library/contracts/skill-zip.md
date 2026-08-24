---
title: "Contract：Skill ZIP validation 与 preview"
taco_scope: plan
---

## Input Envelope

- MIME: `application/zip` only。
- Raw bytes: `1..20 MiB`；Content-Length required；request reader stops at cap even if header lies。
- ZIP64 MAY be accepted only when all resolved sizes and offsets remain within these phase-1 limits；multi-disk archives rejected。
- Supported compression methods: stored (0) and deflate (8)。Encrypted entries rejected。

## Two-Stage Entry Scan

解析必须分成 metadata 与 content 两个阶段。所谓 lazy-entry 指逐条遍历 central directory；它不等于在尚未确定逻辑根和排序前立即读取每个文件内容。

### Stage 1 — Central-directory metadata

Every central-directory entry is visited lazily without opening its content stream。For each entry:

1. Validate raw filename decoding and reject NUL/backslash/absolute path/drive prefix。
2. Normalize Unicode to NFC and split POSIX segments；reject empty、`.`、`..`。
3. Determine Unix/DOS file mode；accept directory marker or regular file only；reject symlink/hardlink/device/other special file。
4. Validate declared compression method、encryption flag、offset and declared size against phase-1 bounds。
5. Reject duplicate normalized source path、Unicode-normalized collision and case-folded collision。
6. Count every entry toward anti-abuse limits, including ignored packaging noise。
7. Store one bounded descriptor containing only the parser entry reference、normalized source path、type、declared sizes/CRC and later-resolved logical path/ignored flag。At most 1,200 descriptors exist。

After metadata enumeration completes:

1. Resolve the single logical root using the rules below。
2. Generate each non-noise regular file's final logical path。
3. Run exact、NFC and case-fold collision checks again on final logical paths。
4. Sort logical regular-file descriptors by final logical-path UTF-8 bytes。
5. Keep ignored-noise descriptors separately in deterministic normalized-source-path order；they do not enter manifest or canonical digest。

### Stage 2 — Ordered content

Open at most one regular-file stream at a time。Each regular file content is opened and consumed exactly once:

1. Process logical files in final logical-path order。
2. Enforce actual per-file and aggregate uncompressed limits；validate actual size and CRC。
3. Compute per-file SHA-256、build `SkillManifestEntry` and perform preview classification。
4. Feed the versioned canonical digest framing and content bytes in that same sorted order。
5. Consume ignored-noise regular files afterward to enforce actual size/CRC and archive-wide abuse limits, without adding them to manifest or canonical digest。

The peak content model is one raw ZIP Buffer + at most 1,200 bounded descriptors + one current entry stream。No decompressed file map or temporary extraction directory is allowed。

Limits:

| Limit | Value |
|---|---:|
| Raw ZIP | 20 MiB |
| All entries | 1,200 (includes ignored dirs/noise) |
| Logical regular files | 1,000 |
| Single regular file | 20 MiB |
| Total regular files | 100 MiB |
| `SKILL.md` | 1 MiB |
| Logical path UTF-8 bytes | 512 |
| Path segments | 64 |

The separate 1,200 all-entry cap prevents a ZIP containing 1000 files plus an unbounded directory/noise flood。

## Root Resolution

After safe path normalization:

- Remove only `__MACOSX/**` and any `.DS_Store` from logical manifest consideration；they still counted above。
- Candidate A: `SKILL.md` at logical ZIP root。
- Candidate B: exactly one common first segment across all non-noise entries, and `<segment>/SKILL.md` exists；strip that segment logically。
- If both/none/multiple roots are plausible, reject `ambiguous_skill_root` or `missing_skill_md`。
- After stripping, run collision checks again on final logical paths。

## `SKILL.md`

- Decode UTF-8 with fatal errors；BOM may be stripped once。
- Leading YAML frontmatter required。
- Required: `name` and `description` non-empty strings。
- `name`: 1..80 chars and must match this anchored pattern:

  ```regex
  ^[a-z0-9]+(?:-[a-z0-9]+)*$
  ```
- `description`: 1..500 chars。
- YAML aliases/merge behavior must use safe parser limits；custom tags rejected。
- Unknown frontmatter is safely parsed and ignored in phase 1；only `name` and `description` are projected to RDB fields。The original `SKILL.md` bytes remain unchanged in the immutable ZIP and logical file manifest。

## Preview Classification

Allowlist extensions/media:

- Markdown/text: `.md`, `.mdx`, `.txt`
- Structured text: `.json`, `.yaml`, `.yml`, `.toml`, `.csv`
- Source/script shown as plain text only: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.sh`, `.bash`, `.zsh`

Rules:

- File size must be `<= 256 KiB`。
- Decode with UTF-8 fatal mode；NUL byte rejects text preview。
- Response is JSON string/plain source presentation with `nosniff`；never active HTML/JS execution。
- `.html`/`.svg` are not inline-previewed in phase 1 even if UTF-8；metadata only。

## Canonical Content Digest

Stage 2 processes final logical regular files in UTF-8 path-byte order and updates SHA-256 with this versioned framing:

```text
"mystra-skill-content-v1\0"
repeated(
  uint32be(pathByteLength) || pathBytes ||
  uint64be(contentByteLength) || contentBytes
)
```

This avoids ambiguous concatenation and leaves an explicit future format version。ZIP timestamps、permissions、entry order、compression metadata and ignored noise are excluded。

Two ZIPs containing the same logical files in different central-directory order MUST therefore produce the same `contentSha256`。The implementation MUST NOT update the canonical digest during Stage 1 or in raw ZIP entry order。

## Stable Validation Codes

`invalid_zip`、`unsupported_zip_feature`、`encrypted_entry`、`unsafe_path`、`path_collision`、`unsupported_file_type`、`too_many_entries`、`too_many_files`、`file_too_large`、`expanded_size_too_large`、`crc_or_size_mismatch`、`ambiguous_skill_root`、`missing_skill_md`、`invalid_skill_md`、`skill_name_mismatch`。

Client receives bounded path/limit details only；never parser stack traces or raw provider errors。
