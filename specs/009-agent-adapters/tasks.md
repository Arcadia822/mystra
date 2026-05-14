# Tasks: Agent Adapter Typed Contracts

**Input**: Design documents from `/specs/009-agent-adapters/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/

## Phase 1: Contract Package (Completed)

- [x] T001 [US1] Replace the `packages/agent-adapters` stub with Zod-backed
      contracts in `packages/agent-adapters/src/index.ts`.
- [x] T002 [US1] Implement `CodexAdapter` and `CopilotAdapter` command/env
      builders in `packages/agent-adapters/src/index.ts`.
- [x] T003 [US1] Add focused adapter unit tests in
      `packages/agent-adapters/src/index.test.ts`.

**Checkpoint**: Adapter package exports real functionality and passes package
tests independently.

## Phase 2: Runner Payload Wiring (Completed)

- [x] T004 [US2] Add `@mystra/agent-adapters` to
      `apps/runner-daemon/package.json`.
- [x] T005 [US2] Create the runner-side adapter registry and serialize adapter
      payloads in `apps/runner-daemon/src/index.ts`.
- [x] T006 [US2] Replace hardcoded agent shell branching with generic payload
      execution in `apps/runner-daemon/assets/container-task.sh`.
- [x] T007 [US2] Add runner text assertions in
      `apps/runner-daemon/src/container-task.test.ts`.

**Checkpoint**: Runner no longer hardcodes `codex exec` / `copilot` command
construction in the shell path.

## Phase 3: Process Parsing Integration (Completed)

- [x] T008 [US3] Harden adapter `parseOutput` against malformed process results
      in `packages/agent-adapters/src/index.ts`.
- [x] T009 [US3] Add defensive parsing and timeout/env coverage in
      `packages/agent-adapters/src/index.test.ts`.
- [x] T010 [US3] Capture `stdout`, `stderr`, and `exitCode` into agent step
      output in `apps/runner-daemon/assets/container-task.sh`.
- [x] T011 [US3] Feed `processResult` back through `adapter.parseOutput(...)` in
      `apps/runner-daemon/src/index.ts`.
- [x] T012 [US3] Extend runner text tests to prove `processResult` integration in
      `apps/runner-daemon/src/container-task.test.ts`.

**Checkpoint**: Adapter output parsing affects workflow execution, not just unit
tests.

## Phase 4: Recorded Follow-Ups

- [ ] T013 [US4] Add explicit unsupported-agent runtime error handling at job
      claim / adapter selection time in the runner. Deferred by owner out of
      current MVP scope.
- [x] T014 [US4] Add runtime startup extension for third-party adapter module
      registration in `apps/runner-daemon/src/index.ts` and adjacent config.
- [x] T015 [US4] Add prompt spill-to-file support when agent commands exceed OS
      argument limits.

## Verification Summary

- [x] `pnpm --filter @mystra/agent-adapters test`
- [x] `pnpm --filter @mystra/agent-adapters typecheck`
- [x] `pnpm --filter @mystra/agent-adapters build`
- [x] `pnpm --filter @mystra/runner-daemon test`
- [x] `pnpm --filter @mystra/runner-daemon typecheck`
- [x] `pnpm --filter @mystra/runner-daemon build`

## Notes

- `T013` remains intentionally deferred by owner direction.
