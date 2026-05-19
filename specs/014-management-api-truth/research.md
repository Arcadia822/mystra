# Research: Management API Truth

## Decision 1: Freeze the canonical contract on top of the existing HTTP routes

- **Decision**: Build `014` on top of the existing project and job route families
  under `apps/control-plane/app/api/` instead of inventing a second route tree
  or shifting truth into MCP.
- **Rationale**: The existing routes already own real persistence-backed project
  and job behavior. The problem is envelope drift and incomplete contract
  normalization, not absence of a route layer.
- **Alternatives considered**:
  - Promote MCP to the primary truth. Rejected because the current MCP route is a
    transport adapter with text-wrapped payloads.
  - Add a new `/api/management/*` subtree immediately. Rejected because it would
    duplicate behavior before the contract is even frozen.

## Decision 2: Centralize management errors and read models in `packages/shared`

- **Decision**: Add shared Zod schemas for the management error vocabulary,
  action-specific success payloads, project selection, project-card execution
  context, and canonical run snapshot in `packages/shared`.
- **Rationale**: `packages/shared/src/schemas.ts` and `result.ts` already own the
  project/runtime/job/result boundary. Extending them is less risky than
  re-defining route-local response shapes that downstream consumers will later
  copy.
- **Alternatives considered**:
  - Keep route-local `projectError()` and `jsonError()` helpers. Rejected because
    they already drift and are not suitable as a stable multi-surface contract.
  - Let future coordinating-skill or SDK code define the canonical types.
    Rejected because downstream surfaces must be consumers, not the owner.
  - Wrap all success responses in a new `{ data: ... }` envelope. Rejected
    because it would cause broad contract churn without improving the underlying
    product semantics.

## Decision 3: Freeze one canonical polling snapshot now

- **Decision**: Reuse and normalize the existing `JobSnapshot`-style persistence
  view as the single polling/read model for project/run/result observation.
- **Rationale**: `RdbProvider.getJob()` already returns a composite snapshot with
  job, run, events, project, and runtime details. Freezing one read model avoids
  read amplification and downstream semantic drift.
- **Alternatives considered**:
  - Separate `get run` and `get result` into unrelated internal read paths.
    Rejected because coordinating skills, CLI, MCP, and any later SDK would end
    up composing the contract differently.
  - Let each consumer make multiple low-level reads. Rejected because it is
    slower and creates multiple truths.
  - Promote `result` into a new top-level snapshot field. Rejected because the
    result already lives at `run.result`, and duplicating it would create drift.

## Decision 4: Freeze the minimum project-lane identity in `014`

- **Decision**: Include the minimum lane-selection and attribution fields in the
  canonical API freeze instead of pushing all lane identity to `015`.
- **Rationale**: Project selection and result attribution are already part of the
  canonical API contract. Without minimum lane identity here, the `014` freeze
  would be fake and `015` would have to retroactively redefine it.
- **Alternatives considered**:
  - Defer all lane identity to `015`. Rejected because it invalidates the API
    freeze.
  - Merge all of `015` into `014`. Rejected because richer concurrency and lane
    behavior still deserve their own bounded spec.

## Decision 5: Freeze project detail as a project-card view, not a fake composite

- **Decision**: Define `GET /api/projects/{slug}` as a projection of today's
  stable project data, not as a composite response that promises richer
  workflow/context facts than storage currently supports.
- **Rationale**: The current DB layer can reliably return project identity,
  repository, branch, runtime, and related stable fields. Pretending it already
  knows more would create either fake data or hidden scope expansion.
- **Alternatives considered**:
  - Expand storage and query composition in `014` just to populate a richer view.
    Rejected because it widens the slice without being required for the current
    MVP path.
  - Keep the response underspecified. Rejected because that guarantees churn when
    coordinating skill and CLI work starts.

## Decision 6: State the trust boundary explicitly

- **Decision**: Document `014` as a private-ops contract for localhost or a
  trusted internal network until caller auth exists.
- **Rationale**: Caller auth is explicitly out of scope for the MVP, but silence
  would imply a broader safety story than the product actually has.
- **Alternatives considered**:
  - Leave the trust boundary implicit in the constitution. Rejected because it is
    too easy for readers to miss.
  - Add auth now. Rejected because it violates the current MVP boundary.

## Decision 7: Keep MCP as a projection, not the semantic owner

- **Decision**: Update MCP outputs to match the canonical route semantics, while
  keeping MCP as a transport adapter over the shared contract.
- **Rationale**: MCP remains valuable as an integration path, but it should adapt
  the canonical API rather than embed a parallel contract inside tool-specific
  text payloads.
- **Alternatives considered**:
  - Leave MCP drift for later. Rejected because that would let two truths ship at
    once.
  - Remove MCP from this slice. Rejected because it is already in active MVP use.
