# Quickstart: Workflow Blueprint Architecture

This quickstart validates the 005 workflow provider plan and the first local
blueprint migration slice.

## 1. Confirm Feature Artifacts

From repo root:

```sh
test -f specs/005-workflow-blueprint/spec.md
test -f specs/005-workflow-blueprint/plan.md
test -f specs/005-workflow-blueprint/research.md
test -f specs/005-workflow-blueprint/data-model.md
test -f specs/005-workflow-blueprint/contracts/blueprint-schema.md
test -f specs/005-workflow-blueprint/contracts/workflow-provider.md
```

## 2. Review Existing Runtime Owners

Before implementation, inspect the current lifecycle owners:

```sh
sed -n '1,220p' apps/workflows/src/mvp-coding-blueprint.json
sed -n '1,220p' apps/workflows/src/index.ts
sed -n '1,260p' apps/runner-daemon/src/index.ts
sed -n '1,260p' apps/runner-daemon/assets/container-task.sh
sed -n '1,220p' apps/control-plane/app/api/runner/jobs/route.ts
sed -n '1,220p' apps/control-plane/app/api/runner/jobs/[id]/events/route.ts
sed -n '1,220p' apps/control-plane/app/api/runner/jobs/[id]/result/route.ts
```

## 3. Validate The Planned Blueprint Boundary

Before tasks are created, verify:

1. `apps/workflows` is the owner of the workflow provider contract.
2. Blueprints are defined as data with explicit node kinds and DAG edges.
3. The local workflow adapter orchestrates runner-owned execution rather than
   taking over Docker or repository provider ownership.
4. The default quality-gate fix loop is removed from MVP behavior.
5. Existing run states, lifecycle events, and result schemas remain the source
   of truth for workflow status reporting.

## 4. Focused Verification Commands

Use the narrowest checks first once implementation begins:

```sh
pnpm --filter @mystra/workflows test
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/shared test
pnpm typecheck
```

The workflow package should now prove the MVP blueprint loads from a JSON asset,
validates against the Zod schema, and executes through the local provider.

When validating runner-side provider selection, also confirm the config surface:

```sh
rg -n "MYSTRA_WORKFLOW_PROVIDER|MYSTRA_WORKFLOW_BLUEPRINT|MYSTRA_WORKFLOW_BLUEPRINT_FILES" apps/runner-daemon/src/index.ts
rg -n "MYSTRA_WORKFLOW_PROVIDER_MODULES|createRunnerWorkflowProviderRegistry|loadWorkflowBlueprints" apps/runner-daemon/src/index.ts apps/runner-daemon/src/workflow-providers.ts
rg -n 'case "\$\{1:-\}" in|Deprecated container workflow entrypoint|Missing container workflow command' apps/runner-daemon/assets/container-task.sh
```

## 5. MVP Workflow Proof

The first implementation slice should prove this path:

```text
job claimed
  -> blueprint loaded
  -> clone node
  -> agent node
  -> quality gate node
  -> push node
  -> review creation node
  -> terminal result
```

For quality-gate failure, the proof should instead end immediately at a failed
terminal result with no retry loop.

The runner should also prove this selection behavior:

```text
configured provider name? -> yes: use named provider
                        -> no: use local

configured blueprint name? -> yes: load named blueprint from provider
                          -> no: load provider.defaultBlueprint

configured blueprint files? -> yes: add JSON blueprints to local provider startup set
                           -> no: built-in MVP blueprint only
```

The retained shell should only expose explicit workflow step commands for runner
invocation. Calling it without a step should fail fast, while `main` remains an
explicit compatibility path with a deprecation warning rather than the default
workflow authority.

## 6. Inspection Snapshot Proof

After `workflow.node.*` events are appended, job inspection routes should expose
an additive `workflow` snapshot derived from those events:

```text
job snapshot
  -> workflow.provider
  -> workflow.blueprintName
  -> workflow.status
  -> workflow.currentNodeId
  -> workflow.nodeExecutions[]
```

This snapshot is derived from structured node lifecycle events and does not
replace the existing `events[]` history.
