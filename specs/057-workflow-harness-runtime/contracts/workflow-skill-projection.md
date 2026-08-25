---
title: "Contract：Workflow Skill Projection"
taco_scope: plan
---

## Desired set

Fixed runtime emits logical `{sourceKey, skillName}` requirements。Control Plane resolves within Task Team to exact `{skillId, revisionId, sequence, manifest, zipSha256}` and writes desired generation。Same Skill is valid only if all sources request the same exact Revision。

## Session claim

Workflow-bound assignment optionally includes:

```ts
type SkillProjectionAssignment = {
  workspaceId: string;
  generation: number;
  entries: Array<{
    skillId: string;
    revisionId: string;
    relativePath: `.mystra/skills/${string}`;
    zipSha256: string;
    manifest: SkillManifestEntry[];
    downloadPath: string;
  }>;
  removals: string[];
};
```

Runner downloads with Session lease token。Server verifies lease -> Session -> Workspace -> desired exact Revision before object-store read。

## Workload sync

`current/transition` exposes the same exact manifest through execution-code authorization。CLI uses cwd as Workspace root and requires a matching bound Workspace marker。

## Materialization rules

1. Destination remains beneath `<workspace>/.mystra/skills/`，using server Skill UUID path only。
2. Enforce Feature 056 archive size and ZIP SHA-256。
3. Extract manifest-listed regular files only；reject symlink/device/duplicate/traversal/backslash/absolute paths。
4. Verify per-file size/hash while streaming；never execute/import content。
5. Build under `.mystra/.staging/<generation>/<skillId>` then atomic rename。
6. Write `.mystra/skills-manifest.json` last with generation/exact revisions/sources。
7. Remove directory only when aggregate sources are empty；unknown directories untouched。
8. Failure keeps last complete directory/manifest and never reports desired generation ready。

## Report

Lease and workload paths report `{generation,status:"ready|failed",failureCode}`。Stale reports are ignored and cannot change sources/Stage；raw filesystem/provider messages are not persisted。

## Failure semantics

- Initial failure: Provider does not start；bounded Session failure；Stage unchanged。
- Post-transition failure: Stage committed；CLI exits projection error；next current retries same generation。
- Disable cleanup failure: logical authority/sources revoked；physical residue ineffective。
- Missing/archived/unready Skill: stable resolution failure；no fallback。
