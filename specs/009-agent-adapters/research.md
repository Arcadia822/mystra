# Research: Agent Adapter Typed Contracts

## Decision 0: Backfill the Spec-Kit record from landed code

- **Decision**: Treat the current `009-agent-adapters` branch as the source of
  truth and backfill Spec-Kit artifacts from the implemented slices rather than
  pretending the plan happened first.
- **Rationale**: The branch already contains three coherent commits proving the
  feature direction. The safe move is to document that reality and surface the
  remaining gaps clearly.
- **Alternatives considered**:
  - Rewrite the feature history in docs as if the plan had preceded
    implementation. Rejected because it would make the artifact set less
    trustworthy.

## Decision 1: Keep agent-specific behavior in a dedicated package boundary

- **Decision**: `packages/agent-adapters` owns the adapter contract and built-in
  implementations.
- **Rationale**: Command generation, env shaping, process parsing, and adapter
  registry selection are all product-owned provider seams. Housing them in a
  package keeps them testable and reusable instead of scattering them across the
  runner and shell.
- **Alternatives considered**:
  - Keep all agent logic in `apps/runner-daemon`. Rejected because that would
    preserve the same entanglement the feature is trying to remove.
  - Move adapter contracts to `@mystra/shared`. Rejected because the adapter
    boundary is not a low-level neutral primitive; it is a provider seam with
    implementation-specific behavior.

## Decision 2: Use JSON payload handoff from runner to shell

- **Decision**: The runner should serialize command, environment, and
  prepare-directory payloads into environment variables consumed by the shell.
- **Rationale**: This preserves the existing container-task step model from 005
  while removing hardcoded `case "$MYSTRA_AGENT"` branching from the shell.
- **Alternatives considered**:
  - Keep separate Codex/Copilot shell branches. Rejected because it leaves the
    contract untyped and duplicates behavior already modeled in TypeScript.
  - Replace the shell entirely. Rejected because 005 already established the
    explicit workflow-step shell boundary and 009 only needs to change the agent
    execution seam inside it.

## Decision 3: Parse agent process results through the adapter contract

- **Decision**: `parseOutput` and `isSuccess` must influence real workflow
  execution, not just unit tests.
- **Rationale**: Without wiring parsed process results back into the runner,
  output parsing would be decorative. Capturing stdout/stderr/exitCode in the
  shell and passing them back through the adapter makes the contract observable
  in workflow failure semantics.
- **Alternatives considered**:
  - Keep relying only on shell exit codes. Rejected because it leaves
    adapter-specific output semantics unused.
  - Store raw logs centrally. Rejected because stdout/stderr log storage is out
    of current MVP scope.

## Decision 4: Make process parsing defensive

- **Decision**: Adapter parsing should normalize malformed process output before
  validating it with Zod.
- **Rationale**: The spec explicitly calls out unexpected output format as an
  edge case. A malformed `stdout`/`stderr` payload should degrade to a best-effort
  failure result instead of crashing the runner.
- **Alternatives considered**:
  - Throw on any malformed process result. Rejected because that converts a
    recoverable bad payload into a runner-level failure.

## Decision 5: Defer unsupported-agent hardening out of the current MVP slice

- **Decision**: Do not implement a dedicated unsupported-agent runtime error in
  this pass.
- **Rationale**: The owner explicitly said this is unnecessary for MVP so long
  as the run fails and exits. The spec keeps the requirement as a follow-up
  contract rather than silently deleting it.
- **Alternatives considered**:
  - Implement explicit unsupported-agent handling now. Rejected because it would
    widen the current slice against owner direction.

## Decision 6: Record remaining gaps instead of inflating scope

- **Decision**: Leave runtime startup extension for new adapters and prompt
  spill-to-file handling as open follow-ups.
- **Rationale**: Both are meaningful improvements, but neither is required to
  explain or validate the slices already delivered. Recording them as gaps is
  cleaner than bundling them into an already-implemented branch late.
- **Alternatives considered**:
  - Rush both follow-ups into 009 now. Rejected because that would turn a
    finished contract slice into an ever-expanding cleanup branch.
