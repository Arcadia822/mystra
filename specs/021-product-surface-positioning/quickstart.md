# Quickstart: Product Surface Positioning

## Goal

Apply 021 as a direct `Job* -> Task*` terminology cut on current repository surfaces.

## Preconditions

1. Read `spec.md`, `plan.md`, `research.md`, and `contracts/terminology-migration.md`.
2. Confirm the target surface exists today in the repository and is in the current migration scope.
3. Do not introduce compatibility aliases or dual naming.

`contracts/terminology-migration.md` is the single source of truth for batch rules, protected meanings, and the rename-matrix inventory. `quickstart.md` is execution order only.

## Execution order

Follow the batch definitions exactly as written in `contracts/terminology-migration.md`.

### Batch A — Stable docs and historical specs

1. Search current durable docs and historical specs for tenancy-flavored `workspace` wording and other conflicting stable terms.
2. Rewrite only to neutral or already-implemented wording.
3. Avoid changing page structure, page inventory, or object hierarchy language.

Suggested search:

```sh
rg -n '\bworkspace\b|\bJob\b|\bJobSpec\b' PRODUCT.md PLATFORM.md README.md specs
```

### Batch B — Outward/core contract planning or execution

1. Build the rename matrix required by `contracts/terminology-migration.md`.
2. Inventory affected outward/core names in:
   - `packages/shared/src/schemas.ts`
   - `apps/control-plane/src/lib/db/rdb-provider.ts`
   - `apps/control-plane/app/api/tasks/`
   - `apps/control-plane/app/api/mcp/`
3. For each symbol, record the target `Task*` name and touched locations.
4. Rename transport and schema names directly, then run regression tests to prove the cut is complete.

### Batch C — Internal/mechanical cleanup

1. Run only after Batch B direct rename is settled.
2. Limit changes to implementation-local names and tests.
3. Stop if a symbol is imported across package or process boundaries.

## Verification

### Documentation-heavy slice

```sh
sh .specify/extensions/status-report/scripts/bash/get-project-status.sh --json
```

### Shared/public-contract slice

```sh
pnpm --filter @mystra/shared build
pnpm --filter @mystra/shared test
pnpm --filter @mystra/shared typecheck
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/control-plane typecheck
pnpm --filter @mystra/control-plane build
```

## Completion

The feature is ready for `/speckit.tasks` after the owner accepts the batching strategy for the direct cut and any future-only deferred names are clearly marked.
