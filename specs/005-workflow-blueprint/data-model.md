# Data Model: Workflow Blueprint Architecture

## WorkflowProvider

- **Purpose**: Defines the pluggable contract for loading, validating, and
  executing workflow blueprints.
- **Fields**:
  - `providerName`
  - `capabilities`
  - `defaultBlueprint`
  - `supportedNodeKinds`
- **Rules**:
  - The provider must be registerable without modifying control-plane routes.
  - The local provider is the default when no other workflow provider is
    configured.

## Blueprint

- **Purpose**: Data-defined representation of a task lifecycle.
- **Fields**:
  - `name`
  - `version`
  - `entryNodes`
  - `nodes`
  - `edges`
  - `outputBindings`
- **Rules**:
  - Must form a DAG.
  - Must fail validation on cycles, duplicate node ids, or unsupported node
    kinds.
  - Must remain serializable as TypeScript object literals or JSON-compatible
    data.

## BlueprintNode

- **Purpose**: A single workflow step.
- **Fields**:
  - `id`
  - `kind` (`deterministic` or `agentic`)
  - `handler`
  - `inputBindings`
  - `outputSchema`
  - `retryPolicy`
  - `timeoutSeconds`
- **Rules**:
  - Deterministic nodes must not require agent adapters.
  - Agentic nodes must reference a compatible agent adapter surface.
  - MVP nodes should include clone, agent execution, quality gate, git push, and
    review creation.

## BlueprintEdge

- **Purpose**: Declares execution dependencies and data flow between nodes.
- **Fields**:
  - `from`
  - `to`
  - `binding`
  - `required`
- **Rules**:
  - Edges must point to existing node ids.
  - The resulting graph must remain acyclic.
  - Required bindings must be present before the downstream node executes.

## WorkflowExecutionSnapshot

- **Purpose**: Durable record of one blueprint execution for a run.
- **Fields**:
  - `runId`
  - `blueprintName`
  - `provider`
  - `status`
  - `currentNodeId`
  - `nodeExecutions`
  - `startedAt`
  - `updatedAt`
- **Rules**:
  - Must be reconstructable from structured events and/or run metadata.
  - Must identify the current or last attempted node when execution fails.

## NodeExecutionSnapshot

- **Purpose**: Captures one node's runtime state.
- **Fields**:
  - `nodeId`
  - `kind`
  - `status`
  - `attempt`
  - `input`
  - `output`
  - `error`
  - `startedAt`
  - `finishedAt`
- **Rules**:
  - Failed nodes must record machine-readable error details.
  - Partial output may exist for failed deterministic nodes and must be
    preserved when useful for debugging.

## WorkflowAdapterContext

- **Purpose**: Bundles the existing Mystra runtime surfaces that the local
  workflow adapter needs to execute a blueprint.
- **Fields**:
  - `job`
  - `run`
  - `project`
  - `runtime`
  - `runner`
  - `signal`
- **Rules**:
  - Must be derived from existing runner claim and runner-observation routes.
  - Must not require the workflow provider to parse raw HTTP requests directly.

## BlueprintExecutionOutcome

- **Purpose**: Final workflow result returned by the provider to the runner.
- **Fields**:
  - `status`
  - `summary`
  - `branch`
  - `reviewUrl`
  - `metadata`
  - `terminalNodeId`
- **Rules**:
  - Must map cleanly to the existing `RunResult` contract.
  - Must preserve quality-gate failure, no-change failure, cancel, and timeout
    semantics already used by Mystra.
