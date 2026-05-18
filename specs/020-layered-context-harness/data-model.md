# Data Model: Layered Context Harness

## Entities

### Collaborative Workspace

- **Purpose**: Mutable coordination space where requirements, plan review, and PR review can iterate outside Mystra execution.
- **Key properties**:
  - May continue changing after a job is submitted
  - Can contain chat history, review discussion, and newer revisions
  - Is not itself the execution contract

### Frozen Spec Artifact

- **Purpose**: Immutable execution-facing snapshot created when a job is submitted.
- **Key properties**:
  - Captures the approved spec at submission time
  - Is injected into the execution workspace through Context Bundle semantics
  - Must remain attributable from run outputs and reviews

### Execution Workspace

- **Purpose**: Mystra-controlled runtime context where workflow nodes and sandbox agents execute.
- **Key properties**:
  - Receives injected artifacts, not live collaboration pointers
  - Executes one frozen contract per accepted run
  - Can outlive the original collaborative thread and still explain what it executed

### Execution Contract Reference

- **Purpose**: Durable identifier or attribution link from a run back to the frozen spec artifact it executed.
- **Key properties**:
  - Supports review and audit
  - Distinguishes completed work from newer collaborative revisions

## State Transition

```text
draft collaboration
  -> approved collaboration
  -> submitted job
  -> frozen spec artifact created
  -> execution workspace injected
  -> run outputs attributed to frozen artifact
```

