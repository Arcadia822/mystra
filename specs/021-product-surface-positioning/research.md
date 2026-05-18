# Research: Product Surface Positioning

## Decision 1: Active migration scope covers current repository surfaces in one hard cut

- **Decision**: Treat all current repository surfaces that still expose `Job*` naming as active migration targets in this feature, and rename them in one direct cut instead of using compatibility windows.
- **Rationale**: The owner explicitly decided that the project is not launched yet, so compatibility layers are unnecessary overhead. The important thing now is repository-wide consistency, not soft migration.
- **Alternatives considered**:
  - Rename future-facing objects now so docs become aspirational: rejected because it would invent or hard-freeze nouns before the corresponding product surfaces exist.
  - Ignore unimplemented surfaces entirely: rejected because the plan still needs to record them as deferred rename candidates.

## Decision 2: Keep runtime `workspace`, rewrite tenancy `workspace` only when the replacement is already real

- **Decision**: Preserve `workspace` where it already means runtime working directory, workspace mount, or execution path. Treat `workspace` as legacy wording when 5xP or historical docs use it as a tenancy umbrella, and rewrite those uses only to currently valid neutral wording unless a stable replacement object already exists.
- **Rationale**: The codebase already uses runtime `workspace` concretely in mounts, paths, sandbox/workflow outputs, and retained log references. By contrast, tenancy `workspace` wording in 5xP is architectural aspiration rather than a backed product object.
- **Alternatives considered**:
  - Rename all tenancy `workspace` wording directly to `Team`: rejected because `Team` is not yet a stable implemented surface in the current repository.
  - Leave all tenancy `workspace` wording unchanged: rejected because it directly conflicts with the stable runtime meaning already present in code and tests.

## Decision 3: Split job-centric naming into active hard-cut scope versus future-only deferred scope

- **Decision**: Current outward/core names (`Job`, `JobSpec`, `/api/jobs`, `mystra_create_job`, `createJob`) are in active hard-cut scope and should be renamed directly. Only future-only surfaces that do not yet exist remain deferred.
- **Rationale**: These names are embedded everywhere important. That is exactly why a single coordinated cut is cleaner than a long half-migrated window.
- **Alternatives considered**:
  - Stage compatibility aliases first: rejected because the project is not launched and the extra indirection adds complexity without user value.
  - Exclude job-centric names from this feature entirely: rejected because they are the core conflict.

## Decision 4: Use three migration batches

- **Decision**:
  1. **Batch A — Stable docs/spec wording**: 5xP, `README.md`, and historical spec wording that can be clarified without introducing unimplemented objects.
  2. **Batch B — Outward/core contract names**: shared schemas, exported types, API/MCP/CLI names, persisted/operator-visible contract labels, and core provider methods. This batch is now a direct hard cut, not a compatibility review.
  3. **Batch C — Internal/mechanical cleanup**: implementation-local helpers, private variables, and test fixtures after outward/core naming is settled.
- **Normative location**: `contracts/terminology-migration.md` is the single source of truth for these batch rules. This research file explains why the split exists.
- **Rationale**: The same word can have very different risk depending on whether it appears in a doc sentence, a shared type, or a public transport surface.
- **Alternatives considered**:
  - One giant rename batch: rejected because it hides compatibility risk.
  - Contract-only planning with no mechanical cleanup path: rejected because it would leave obvious internal drift unresolved after public terms settle.

## Decision 5: Keep intake semantics text-first while renaming the surface directly

- **Decision**: Preserve the current MVP assumption that work enters Mystra through text-first submission, while directly renaming the public/core surface from `Job*` to `Task*`.
- **Rationale**: Terminology migration should not quietly expand into a new intake model. The current shared schema and control-plane request flow already accept text-first input through `prompt` and `taskId`.
- **Alternatives considered**:
  - Fold issue-id intake into this feature: rejected because it changes product scope, not just terminology.
  - Drop the intake decision from the plan: rejected because the naming conflict around `Job`/`Task` is directly tied to the current submission contract.
