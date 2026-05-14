# Contract: Blueprint Schema

This contract defines the minimum shape of a Mystra workflow blueprint.

## Required Blueprint Fields

- `name`
- `version`
- `nodes`
- `edges`
- `entryNodes`
- `outputBindings`

## Required Node Fields

- `id`
- `kind`
- `handler`
- `inputBindings`
- `outputSchema`

Optional node fields:

- `timeoutSeconds`
- `retryPolicy`
- `metadata`

## Node Kinds

- `deterministic`
- `agentic`

MVP deterministic handlers should cover clone, quality gate, push, and review
creation. MVP agentic handlers should cover the coding-agent invocation node.

## Validation Rules

- Blueprint names must be unique within a provider registry.
- Node ids must be unique within a blueprint.
- Every edge must reference valid node ids.
- The graph must be acyclic.
- Every entry node must exist in `nodes`.
- Every output binding must resolve from a node output or declared workflow
  input.
- The MVP default blueprint must not include a quality-gate retry loop.

## First MVP Blueprint

The initial default blueprint should represent:

```text
clone -> agent -> quality_gate -> push -> review_create
```

Allowed terminal exits:

- success after review creation
- failure at quality gate
- failure when the agent produces no diff
- cancel or timeout through runner-owned execution control
