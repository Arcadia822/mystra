# Research: Agent-First Control Plane

## Decision 1: Treat the existing control-plane HTTP routes as the canonical management baseline

- **Decision**: Build `013` on the existing `projects`, `jobs`, `runners`, and
  related control-plane route families instead of inventing a second transport
  or a new management authority.
- **Rationale**: Source inspection shows Mystra already owns durable
  project/job/run state and exposes project/job CRUD routes under
  `apps/control-plane/app/api/`. The problem is not absence of a control-plane
  seam; it is that the seam is not yet frozen as the product truth for all other
  management surfaces.
- **Alternatives considered**:
  - Treat MCP as the primary product truth. Rejected because the current MCP
    route is transport-oriented and returns text-wrapped payloads that are less
    suitable as the stable typed boundary.
  - Keep separate API, CLI, and agent contracts. Rejected because that would
    institutionalize drift and make future reviews impossible to reason about.

## Decision 2: Keep shared contract ownership in `packages/shared`

- **Decision**: Continue to own stable project/runtime/job/run/result schemas in
  `packages/shared`, then add any missing management projection schemas there as
  child features land.
- **Rationale**: `packages/shared/src/schemas.ts` already defines the main
  project/runtime/job contracts, and `packages/shared/src/result.ts` already
  defines normalized terminal run-result semantics. Extending that contract owner
  is lower-risk than recreating shapes inside route handlers, SDK code, or shell
  formatters.
- **Alternatives considered**:
  - Define route-local response shapes in `apps/control-plane`. Rejected because
    that would duplicate the boundary contract in the wrong layer.
  - Define SDK-owned types first. Rejected because the SDK is supposed to derive
    from the canonical control-plane truth, not replace it.

## Decision 3: Implement `013` as an orchestration umbrella, not one giant code slice

- **Decision**: Keep `013` as the umbrella spec/plan that sequences and guards
  `014` through `018`, rather than trying to implement API truth, multi-project
  identity, SDK, CLI, and coordination summaries in one branch.
- **Rationale**: The user already agreed the dependency graph is
  `014 -> {015, 016, 017, 018}` with `013` acting as the contract/governance
  frame. Treating `013` as a direct megafeature would maximize coordination
  noise and bury the real dependency order.
- **Alternatives considered**:
  - Collapse all child specs back into `013`. Rejected because it would erase the
    bounded implementation slices already created.
  - Skip `013` plan artifacts entirely. Rejected because the umbrella still needs
    durable sequencing, boundary, and verification guidance.

## Decision 4: Reserve dedicated implementation homes for the derived coordinating skills and CLI

- **Decision**: Plan for dedicated coordinating-skill homes under
  `.agents/skills/` and a dedicated executable app `apps/operator-cli`.
- **Rationale**: The current monorepo already separates long-lived libraries in
  `packages/*` from executable services/apps in `apps/*`, and the repository
  already treats `.agents/skills/` as the local home for reusable agent-facing
  workflows. The coordinating surface belongs there for now; the CLI remains an
  executable operator surface.
- **Alternatives considered**:
  - Put the CLI inside `packages/agent-adapters`. Rejected because the CLI is not
    an adapter library.
  - Put the coordinating surface inside `apps/control-plane`. Rejected because
    that would couple a consumer-facing workflow surface to the server app that
    owns the API.

## Decision 5: Keep MCP as a derived adapter over the canonical contract

- **Decision**: Preserve MCP as a supported submission/integration transport, but
  explicitly treat it as an adapter over the canonical management API and shared
  contracts, not as the sole owner of management semantics.
- **Rationale**: The current MCP route already proves useful as an integration
  surface, but it validates and formats around the same `getDb()` and shared
  schema boundaries. This feature should strengthen that layering instead of
  deleting MCP or forcing product truth into tool descriptions.
- **Alternatives considered**:
  - Add a new dedicated "thin MCP" feature in this phase. Rejected because the
    user explicitly removed it from the roadmap.
  - Deprioritize MCP entirely. Rejected because the constitution still treats
    remote MCP as a primary submission path for other agents/skills in the MVP.

## Decision 6: Record GitNexus evidence, but ground the plan in source files

- **Decision**: Re-run `npx gitnexus analyze`, confirm the repo is up to date,
  and record that status in the plan while keeping file-level evidence as the
  durable source of planning truth.
- **Rationale**: The repo instructions require GitNexus during planning when the
  work touches execution flows and API contracts. In this environment, the local
  index refreshed successfully, but query quality still reported missing FTS
  indexes without a force rebuild. File-level evidence is therefore the durable
  citation path for this plan.
- **Alternatives considered**:
  - Skip GitNexus entirely. Rejected because the project rules explicitly call
    for it during plan/review of contract work.
  - Rely only on GitNexus summaries. Rejected because the current query output is
    not precise enough to replace direct source inspection.
