# Contract: Coordinating Skill Surface

## Purpose

Define the first local Mystra skill surface for coordinating agents.

`008-mcp-skills` remains the durable owner of the three repo-local skills.
`016-agent-runtime-skills` aligns and verifies that surface against the current
canonical API truth after `014` and `015`.

## First-Slice Skills

The first slice is intentionally small:

```text
mystra-submit-implementation-request
mystra-submit-user-journey
mystra-check-job-status
```

## Surface Rules

1. Skills package intent and validation, not a second transport contract.
2. Skills remain repo-local under `.agents/skills/` in this slice.
3. Skills may summarize outputs for agents, but must not change the underlying
   management meaning.
4. New skills should be additive. Do not fork parallel versions of the same
   coordination flow.
5. Drift detection should use explicit fixture-backed contract checks, not a
   second helper package or ad hoc markdown parsing.

## Route / Tool Mapping

| Skill | Primary MCP tool | Canonical truth behind it |
|---|---|---|
| `mystra-submit-implementation-request` | `mystra_create_job` | `POST /api/jobs` |
| `mystra-submit-user-journey` | `mystra_create_job` | `POST /api/jobs` |
| `mystra-check-job-status` | `mystra_get_job` | `GET /api/jobs/{id}` |

## Required Behaviors

### Submission Skills

- validate required fields before transport use
- stop on invalid input
- stop on connection failure
- return created job identifier and immediate run state

### Status Skill

- require `jobId`
- stop on connection failure
- surface missing-job meaning directly
- summarize current run state, terminal result, and review handle when present

## Extension Rule

A future local Mystra skill may be added when:

1. it packages an already-existing canonical management capability
2. it does not require a new public contract layer
3. it follows the same validation and error-semantics rules as the first slice

## Verification Rule

Alignment tests should validate explicit implementation-request, user-journey,
and status fixtures against the current `mystra_create_job` / `mystra_get_job`
contract and canonical snapshot fields. The tests exist to catch drift between
the skill guidance and the live API semantics without re-homing skill ownership
away from `008`.
