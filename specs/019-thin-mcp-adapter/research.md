# Research: Thin MCP Adapter

## Decision 1: Treat the current MCP route as existing adapter behavior, not greenfield implementation

- **Decision**: Use `apps/control-plane/app/api/mcp/route.ts` as the starting
  surface for `019`.
- **Rationale**: The route already exposes project, job, cancel, runner, and
  health tools, plus transport-local JSON-RPC error handling. Pretending `019`
  starts from zero would create fake scope and duplicate prior work from `007`
  and `014`.
- **Alternatives considered**:
  - Rebuild MCP as a fresh adapter abstraction. Rejected because it adds code
    without improving the current contract boundary.
  - Treat the route as implementation detail and solve `019` in docs only.
    Rejected because adapter-boundary tests still matter.

## Decision 2: Keep business meaning anchored to the canonical management contract

- **Decision**: Reuse shared management schemas and HTTP route semantics as the
  source of truth for MCP business payloads and business failures.
- **Rationale**: `014-management-api-truth` already froze those semantics in
  `packages/shared/src/management.ts` and aligned the routes to them. `019`
  exists to prevent MCP from drifting away from that truth.
- **Alternatives considered**:
  - Let MCP payload text define the contract de facto. Rejected because that
    turns a transport wrapper into the contract owner.
  - Fork a second MCP-only schema family. Rejected because it violates the
    one-truth direction of `013`, `014`, `016`, and `017`.

## Decision 3: Preserve transport-local JSON-RPC failures as transport failures

- **Decision**: Keep invalid params, unknown method, malformed request, and
  unknown tool behavior transport-specific inside the MCP adapter.
- **Rationale**: These failures come from the JSON-RPC/MCP boundary, not the
  management business contract. Mixing them with management errors would blur
  retry/debugging logic for clients.
- **Alternatives considered**:
  - Rewrite all failures into the management error vocabulary. Rejected because
    transport and business failures have different meanings and recovery paths.

## Decision 4: Preserve the current `content[].text` wrapping unless business meaning changes

- **Decision**: Accept the current text-wrapped MCP payload transport as long as
  the embedded payload meaning remains canonical.
- **Rationale**: The route and current clients already use `content[].text`.
  Changing wrapper transport now would spend compatibility tokens on the wrong
  problem.
- **Alternatives considered**:
  - Redesign MCP responses to expose raw objects. Rejected because this feature is
    about thinness of meaning, not transport modernization.

## Decision 5: Align `019` with the post-`016` hierarchy, not the old SDK-first hierarchy

- **Decision**: Update `019` planning and implementation to recognize that the
  current agent-facing layer is the skill surface from `016`, while CLI is `017`.
- **Rationale**: The spec was drafted before `016` fully pivoted from SDK-first
  to skill-first. Leaving that stale assumption in place would make the plan
  self-contradictory.
- **Alternatives considered**:
  - Preserve the old wording and hope implementers infer the newer truth.
    Rejected because that is how architecture drift gets baked into docs.
