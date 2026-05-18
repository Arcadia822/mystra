# Research: Workflow Blueprint Architecture

## Decision 0: Keep the MVP goal, but design the interfaces directly in Mystra

- **Decision**: Mystra should keep the same MVP workflow goal, but implement it
  through Mystra-owned extensible interfaces and SDK surfaces instead of trying
  to adopt a third-party coding-agent harness wholesale.
- **Rationale**: The research confirmed there are useful open-source reference
  architectures, but no external package cleanly fits Mystra's existing
  runner/control-plane handoff, provider seams, and product boundaries. Open
  Agents and Stripe Minions remain the main shape references, while other agent
  harnesses are comparative inputs rather than adoption targets.
- **Alternatives considered**:
  - Pause 005 until a matching external SDK appears. Rejected because it blocks
    a core MVP architecture on a dependency that does not exist today.
  - Reframe 005 around adopting a third-party harness. Rejected because that
    would change implementation shape without reducing the integration work that
    Mystra still owns.

## Dependency Audit: Specs 001-004 are sufficient foundations for 005

- **Decision**: Continue 005 without pausing for additional prerequisite spec
  work.
- **Rationale**: 001 provides the `Project` and `RdbProvider` ownership layer,
  002 provides runtime and context-bundle contracts, 003 provides durable runner
  behavior and observation boundaries, and 004 provides the Open Agents mapping
  and fork/seam rules. The only inconsistency discovered was 001's older
  top-level image wording, which has now been aligned to the runtime-contract
  model already established by 002.
- **Alternatives considered**:
  - Pause 005 for another prerequisite spec. Rejected because the dependency
    surfaces needed by 005 are already covered.
  - Keep 001's older wording untouched. Rejected because it would leave one
    misleading contradiction at the exact Project/runtime seam 005 consumes.

## Decision 1: Put the workflow provider boundary in `apps/workflows`

- **Decision**: `apps/workflows` should own the `WorkflowProvider` contract,
  blueprint loading/validation, and local workflow adapter implementation.
- **Rationale**: 004 classified workflows as the deferred framework surface, and
  the package is currently only a placeholder. Putting the contract here turns
  005 into the feature that makes workflow ownership explicit rather than leaving
  it scattered across the runner shell script and daemon.
- **Alternatives considered**:
  - Keep the contract in `apps/runner-daemon`. Rejected because that would
    collapse orchestration and execution ownership into one package.
  - Keep the contract in `packages/shared`. Rejected because the workflow
    adapter is not a low-level shared primitive; it is a provider boundary.

## Decision 2: Define blueprints as Zod-validated data

- **Decision**: The MVP blueprint should be a data structure with named nodes,
  explicit dependency edges, deterministic vs agentic node kinds, and typed
  input/output bindings.
- **Rationale**: The spec explicitly rejects code-defined workflow scripts as a
  scalable architecture. A Zod-validated blueprint makes workflow shape
  inspectable, testable, and extensible without turning lifecycle changes into
  shell edits.
- **Alternatives considered**:
  - Keep a TypeScript function pipeline only. Rejected because it would encode
    workflow shape in code rather than in a reusable contract.
  - Load arbitrary JSON without validation. Rejected because invalid DAGs and
    unsupported node types must fail early and descriptively.

## Decision 3: Keep the runner daemon as execution owner

- **Decision**: The workflow layer coordinates node order and execution
  semantics, but the runner daemon remains responsible for claim polling, Docker
  launch, event publication, and final result submission.
- **Rationale**: Current code already establishes a clean runner/control-plane
  handoff, and 004 recorded the pull-based runner plus agent-in-container model
  as Mystra-specific surfaces. 005 should orchestrate those seams, not erase
  them.
- **Alternatives considered**:
  - Move Docker and result publication into `apps/workflows`. Rejected because
    that would blur provider boundaries and duplicate runner responsibilities.
  - Keep orchestration in the shell script. Rejected because it leaves workflow
    behavior untyped and non-pluggable.

## Decision 4: Remove the default quality-gate fix loop

- **Decision**: `MYSTRA_QUALITY_FIX_ATTEMPTS` and the shell-script quality fix
  loop should not survive as MVP workflow behavior.
- **Rationale**: The constitution and product boundary explicitly exclude
  quality-gate fix loops. 005 should replace the current shell loop with a
  deterministic quality-gate node that fails immediately; future bounded retry
  belongs in an explicit post-MVP blueprint node.
- **Alternatives considered**:
  - Preserve the existing fix loop for compatibility. Rejected because it keeps
    out-of-scope behavior alive under a new abstraction.
  - Remove the quality gate entirely. Rejected because the MVP still requires a
    deterministic `test -> build` gate before push/MR/PR delivery.

## Decision 5: Persist node execution through existing run/event surfaces first

- **Decision**: The first workflow implementation should persist node execution
  snapshots via structured run events and workflow metadata attached to existing
  run/result records instead of introducing a new persistence provider contract.
- **Rationale**: `RdbProvider` already owns run snapshots, events, and results.
  Reusing those surfaces is the lowest-risk way to make blueprint execution
  explainable without expanding 005 into a persistence redesign.
- **Alternatives considered**:
  - Add dedicated workflow execution tables immediately. Rejected because 005
    can prove the blueprint architecture without a persistence split.
  - Keep node execution in memory only. Rejected because the spec requires
    partial runs to be explainable and resume-capable enough for the MVP.

## Decision 6: Use direct source inspection instead of GitNexus for this plan

- **Decision**: Base this plan on direct reads of `apps/workflows`,
  `apps/runner-daemon`, `apps/control-plane/app/api/runner/tasks/*`, and
  `packages/shared`.
- **Rationale**: GitNexus CLI bootstrap failed in this shell, so current-code
  evidence had to come from source inspection. The plan records that limitation
  explicitly rather than pretending graph-backed evidence was available.
- **Alternatives considered**:
  - Skip code evidence entirely. Rejected because 005 changes cross package and
    provider boundaries.
  - Assume the workflow package already had meaningful implementation. Rejected
    because `apps/workflows/src/index.ts` is currently a one-line placeholder.
