# Quickstart: Agent Adapter Typed Contracts

This quickstart verifies the current 009 implementation and highlights the
remaining known gaps.

## 1. Confirm Feature Artifacts

From repo root:

```sh
test -f specs/009-agent-adapters/spec.md
test -f specs/009-agent-adapters/plan.md
test -f specs/009-agent-adapters/research.md
test -f specs/009-agent-adapters/data-model.md
test -f specs/009-agent-adapters/contracts/agent-adapter.md
test -f specs/009-agent-adapters/contracts/runner-agent-step.md
test -f specs/009-agent-adapters/tasks.md
```

## 2. Inspect The Contract Owners

```sh
sed -n '1,220p' packages/agent-adapters/src/index.ts
sed -n '1,220p' packages/agent-adapters/src/index.test.ts
sed -n '780,1145p' apps/runner-daemon/src/index.ts
sed -n '1,360p' apps/runner-daemon/assets/container-task.sh
sed -n '1,260p' apps/runner-daemon/src/container-task.test.ts
```

## 3. Validate The Implemented 009 Path

The delivered proof should show:

```text
runner claim
  -> create built-in adapter registry
  -> select adapter by job.spec.agent
  -> build command/env/prepareDir payloads
  -> shell executes payload generically
  -> shell writes processResult + changedFiles
  -> runner parses processResult through adapter.parseOutput
  -> workflow node succeeds or fails with structured adapter semantics
```

## 4. Focused Verification Commands

Run the narrowest checks first:

```sh
pnpm --filter @mystra/agent-adapters test
pnpm --filter @mystra/agent-adapters typecheck
pnpm --filter @mystra/agent-adapters build
pnpm --filter @mystra/runner-daemon test -- --run src/container-task.test.ts
pnpm --filter @mystra/runner-daemon typecheck
pnpm --filter @mystra/runner-daemon build
```

Then confirm the broader runner package still holds:

```sh
pnpm --filter @mystra/runner-daemon test
```

## 5. Textual Contract Checks

```sh
rg -n "AgentAdapter|CodexAdapter|CopilotAdapter|createAgentAdapterRegistry|parseOutput|isSuccess" packages/agent-adapters/src/index.ts
rg -n "MYSTRA_AGENT_COMMAND_JSON|MYSTRA_AGENT_ENV_JSON|MYSTRA_AGENT_PREPARE_DIRS_JSON|processResult" apps/runner-daemon/src/index.ts apps/runner-daemon/assets/container-task.sh
rg -n "delegates agent command construction|threads agent process results back through adapter parsing" apps/runner-daemon/src/container-task.test.ts
```

## 6. Known Gaps To Review

These are not hidden defects; they are explicit follow-ups:

1. `unsupported-agent` hardening is deferred out of the current MVP slices.
