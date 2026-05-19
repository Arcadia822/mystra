# Research: Agent Runtime Skills

## Decision 1: Reuse the already-implemented `008-mcp-skills` surface instead of recreating it

- **Decision**: Treat the three repo-local Mystra skills under `.agents/skills/`
  as the starting point for `016`, not as disposable prototypes.
- **Rationale**: `008-mcp-skills` already implemented
  `mystra-submit-user-journey`, `mystra-submit-implementation-request`, and
  `mystra-check-job-status`. Recreating them under `016` would duplicate the
  same behavior and create two competing historical narratives for one surface.
- **Alternatives considered**:
  - Rebuild the same three skills as a new 016-only implementation. Rejected
    because it spends effort without adding a new capability.
  - Ignore `008` and document `016` as greenfield. Rejected because it would be
    false.

## Decision 2: Keep the first coordinating skill surface MCP-backed

- **Decision**: Continue to package the first-slice agent-facing flows over the
  existing `mystra_create_job` and `mystra_get_job` MCP tools.
- **Rationale**: Mystra remote MCP is still the primary submission path for
  other agents and skills in the MVP. The current local skills already wrap MCP,
  and there is no product need yet to introduce a second transport model for
  the same flows.
- **Alternatives considered**:
  - Pivot the local skills to call HTTP directly. Rejected because that would
    duplicate the transport story while MCP remains the intended agent-facing
    path.
  - Create a shared helper that can switch between MCP and HTTP. Rejected
    because it adds a second contract layer before the first one is stable.

## Decision 3: Use `014` and `015` as the semantic truth for `016`

- **Decision**: Anchor the coordinating skill surface to the canonical project,
  job, and lane semantics frozen by `014-management-api-truth` and
  `015-multi-project-lanes`.
- **Rationale**: `packages/shared/src/management.ts` now owns the machine-readable
  error vocabulary, project list/detail views, canonical run snapshot, and
  current-vs-frozen lane truth. `016` should package those semantics for agents,
  not redefine them.
- **Alternatives considered**:
  - Let each skill describe success and failure in its own words without
    reference to the canonical contract. Rejected because that guarantees drift.
  - Treat MCP response text as the contract. Rejected because MCP is a transport
    projection, not the product-truth owner.

## Decision 4: Do not introduce a shared helper module yet

- **Decision**: Keep the first slice as explicit per-skill manifests plus shared
  contract docs and verification guidance.
- **Rationale**: The surface is still only three skills. Adding a helper script,
  package, or mini-runtime now would over-engineer the problem the user
  explicitly asked not to solve with an SDK yet.
- **Alternatives considered**:
  - Introduce a shared local helper for request packaging and response parsing.
    Rejected because it is functionally a tiny SDK by another name.
  - Keep each skill fully independent with no shared contract docs. Rejected
    because future skill authors would lack a stable extension pattern.

## Decision 5: Make `016` the extension-rule and verification layer for future local skills

- **Decision**: Use `016` to define how future Mystra skills should package
  inputs, preserve canonical error meaning, and summarize outputs without
  inventing a second coordination truth.
- **Rationale**: The current repository already has a local skill-pack model.
  What is missing is not "more code"; it is the durable rule for how future
  agent-facing skills should stay aligned with the control-plane contract.
- **Alternatives considered**:
  - Keep the existing three skills undocumented beyond their own `SKILL.md`
    files. Rejected because that does not scale to future skill authors.
  - Wait for a future SDK and solve extension rules there. Rejected because the
    user explicitly wants the skill surface now.
