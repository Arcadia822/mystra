# Quickstart: Open Agents Framework Reuse

This quickstart is for validating the first alignment slice for feature `004`.

## 1. Confirm Feature Artifacts

From repo root:

```sh
test -f specs/004-open-agents-framework/spec.md
test -f specs/004-open-agents-framework/plan.md
test -f specs/004-open-agents-framework/research.md
test -f specs/004-open-agents-framework/data-model.md
test -f specs/004-open-agents-framework/contracts/framework-alignment.md
test -f specs/004-open-agents-framework/contracts/fork-rules.md
test -f specs/004-open-agents-framework/contracts/module-inventory.md
test -f specs/004-open-agents-framework/contracts/provider-seams.md
```

## 2. Refresh Current-Code Evidence

Confirm GitNexus freshness and current branch context:

```sh
npm exec --yes --package gitnexus@1.6.4 -- gitnexus status
```

If the index is stale:

```sh
npm exec --yes --package gitnexus@1.6.4 -- gitnexus analyze
```

## 3. Review Current Mystra Boundary Owners

Inspect the current boundary files before validating the approved first
implementation slice:

```sh
sed -n '1,220p' apps/control-plane/src/lib/db/rdb-provider.ts
sed -n '1,220p' apps/control-plane/app/api/mcp/route.ts
sed -n '1,220p' apps/runner-daemon/src/index.ts
sed -n '1,160p' apps/workflows/src/index.ts
sed -n '1,160p' packages/agent-adapters/src/index.ts
```

## 4. Validate The First Slice Claims

Before implementation is considered complete, verify:

1. The upstream Open Agents source reference is pinned.
2. Every MVP-relevant subsystem is classified in the framework-alignment
   mapping.
3. Module inventory records exist in `contracts/module-inventory.md` for the
   approved first-slice surfaces.
4. Fork rules exist for every surface that is no longer honestly on an adopt or
   defer path.
5. Every replaced seam is recorded in the provider-seams contract.
6. The chosen subsystem slice is the lifecycle/control handoff boundary, not a
   placeholder module or runner execution migration.
7. Repository-provider wording drift is reconciled if the slice touches that
   boundary.
8. Agent-placement divergence and MCP submission extensions are recorded in
   `research.md` and `docs/ADR-0004-open-agents-local-provider-boundary.md`
   before follow-on planning proceeds.

## 5. Run Verification For Touched Code

Use the narrowest relevant tests for the chosen slice. Typical commands:

```sh
pnpm --filter @mystra/shared exec vitest run src/events.test.ts -t "exports control-plane handoff and terminal event vocabularies from the shared lifecycle schema"
pnpm --filter @mystra/control-plane exec vitest run app/api/routes.test.ts -t "advertises shared lifecycle handoff metadata in MCP tools/list"
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/shared test
pnpm typecheck
```

Only run the package tests relevant to the files changed in the first slice.
For the lifecycle/control-handoff proof, prefer the two focused commands above
before broader package test sweeps.

## 6. Confirm Downstream Initialization

The purpose of 004 is to constrain follow-on plans. Before moving to later
features, confirm:

```sh
sed -n '1,20p' specs/005-workflow-blueprint/spec.md
sed -n '1,20p' specs/010-repo-provider-contracts/spec.md
sed -n '1,20p' specs/011-docker-sandbox-provider/spec.md
```

Those features should reference 004 outputs instead of re-deriving adopt,
extend, or fork policy from chat history.
