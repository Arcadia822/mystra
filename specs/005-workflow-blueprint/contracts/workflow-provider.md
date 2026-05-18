# Contract: Workflow Provider

This contract defines the pluggable workflow boundary that replaces the
runner-owned lifecycle script as the source of orchestration truth.

## Required Provider Methods

Each workflow provider implementation MUST expose:

- `providerName`
- `defaultBlueprint`
- `supportedNodeKinds`
- `capabilities`
- `loadBlueprint(name, context)`
- `validateBlueprint(blueprint)`
- `executeBlueprint(blueprint, context)`
- `resumeExecution(snapshot, context)`
- `supportsNodeKind(kind)`

## Provider Semantics

- The provider owns node ordering, dependency satisfaction, and execution
  failure semantics.
- The provider does **not** own runner polling, Docker provisioning, sandbox
  secrets, or repository-specific review delivery contracts.
- The provider MUST return final outcomes that can be translated directly into
  the existing `RunResult` contract.

## Execution Context

The execution context MUST include:

- claimed job snapshot
- run snapshot
- resolved runtime contract
- project claim
- cancellation signal / desired-state view
- provider-owned step handlers

The execution context MUST NOT require raw HTTP request objects or route-local
logic.

## Failure Rules

- Invalid blueprints fail before any node executes.
- Deterministic node failure stops downstream nodes unless the blueprint
  explicitly models alternative branches in a future extension.
- Quality-gate failure is terminal in the MVP.
- Unsupported node kinds fail at validation time, not mid-run.

## Replaceability Rule

Any future adapter (`VercelWorkflowAdapter`, `DifyAdapter`, etc.) MUST satisfy
this contract without requiring control-plane route changes or runner-protocol
shape changes.

## Runner Selection Rule

- The runner selects the provider by configured name, defaulting to `local`.
- The runner selects the blueprint by configured name when present; otherwise it
  uses the provider's `defaultBlueprint`.
- Additional providers may be registered at runner startup via configured
  provider modules rather than hardcoded control-plane changes.
- The local provider may load additional JSON blueprint assets at runner startup,
  so alternate data-defined workflows can be selected without code edits.
- Provider selection may change runner startup configuration, but it must not
  change the control-plane event vocabulary or result schema.
