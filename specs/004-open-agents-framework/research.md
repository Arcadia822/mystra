# Research: Open Agents Framework Reuse

## Pinned Upstream Source Reference

- **Repository**: `vercel-labs/open-agents`
- **Pinned revision**: `c82d7e0b2949edc62e9937e99eb3757b75b9262f`
- **Why this revision**: it is the reviewed upstream snapshot for 004's
  architecture-gate work and the source of truth for adopt / extend / fork
  decisions in this feature.
- **Authoritative upstream files for 004**:
  - `README.md`
  - `apps/web/app/workflows/chat.ts`
  - `apps/web/app/workflows/chat-post-finish.ts`
  - `apps/web/app/workflows/sandbox-lifecycle.ts`
  - `apps/web/SANDBOX-LIFECYCLE.md`

## Decision 1: Treat Open Agents as a fork/adapt reference app, not a presumed package dependency

- **Decision**: Use the upstream `vercel-labs/open-agents` repository as the
  source architecture and code reference for Mystra framework reuse. Do not
  require this feature to prove reuse by adding a package dependency unless a
  concrete reusable package surface is identified during implementation.
- **Rationale**: The official upstream README describes Open Agents as an
  open-source reference app that is "meant to be forked and adapted." The
  current Mystra repository contains no Open Agents dependency or copied module
  path, so the first truthful step is provenance plus mapping, not a fake
  dependency line.
- **Alternatives considered**:
  - Add a dependency immediately and treat that as reuse. Rejected because the
    upstream surface described in the official README is repo-shaped and
    Vercel-oriented, not obviously a stable package contract for Mystra's needs.
  - Treat Open Agents only as loose inspiration. Rejected because Mystra's
    product and constitution explicitly state it as the framework foundation.

## Decision 2: Preserve the three-layer separation as the main reusable invariant

- **Decision**: Use the upstream `Web -> Agent workflow -> Sandbox VM`
  separation as the primary architecture invariant Mystra should preserve and
  classify.
- **Rationale**: The official upstream README presents this three-layer split
  as the key architectural decision. Mystra already has a comparable structural
  shape with `apps/control-plane`, `apps/workflows`, and `apps/runner-daemon`
  plus Docker task containers, so this is the most valuable alignment axis for
  the first slice.
- **Alternatives considered**:
  - Start with auth/UI parity. Rejected because Mystra intentionally excludes
    caller auth from the MVP and already has its own product surface.
  - Start with GitHub integration parity. Rejected because repository-provider
    scope is still drifting across Mystra docs and should not anchor framework
    reuse first.

## Decision 3: Record agent placement as an intentional divergence

- **Decision**: Classify Mystra's current agent execution model as an explicit
  divergence from Open Agents until proven otherwise.
- **Rationale**: The official upstream README emphasizes that "the agent is not
  the sandbox" and that the agent runs outside the VM while interacting through
  tools. Mystra's MVP currently runs Codex or Copilot CLI inside the task
  container driven by the runner daemon. That is a real architectural
  difference, and hiding it would corrupt later planning.
- **Alternatives considered**:
  - Pretend the models are equivalent because both use isolated execution.
    Rejected because the control locus and agent placement differ materially.
  - Require this feature to eliminate the divergence immediately. Rejected
    because that would turn framework reuse into a speculative repo rewrite.

## Decision 4: The first implementation slice should prove provenance plus one lifecycle/control handoff mapping

- **Decision**: Keep the first implementation slice small: provenance record,
  architecture mapping, module inventory, fork rules, provider seam catalog,
  and one verified subsystem alignment slice centered on the lifecycle/control
  handoff boundary.
- **Rationale**: Current repo reality shows that `apps/workflows` and
  `packages/agent-adapters` are still placeholders, while other surfaces such as
  MCP routes and shared event/state schemas are already real. The runner
  execution boundary is also real, but it carries the largest intentional
  divergence, agent-in-container execution, so it is the wrong first proof
  surface. Trying to rewrite the whole repo around Open Agents in one feature
  would produce a large migration with weak verification.
- **Alternatives considered**:
  - Full-framework migration in this feature. Rejected because it would block
    follow-on work and exceed the verification budget.
  - Documentation-only feature. Rejected because the spec requires at least one
    traceable subsystem alignment slice.
  - Start with placeholder workflow or adapter modules. Rejected because that
    would let the feature claim "alignment" on surfaces that do not yet carry
    meaningful behavior.

## Decision 5: Reconcile repository-provider scope using product-level sources, then split provider-specific contract work

- **Decision**: Treat the product-level statements in `PRODUCT.md` and
  `docs/SPEC.md` as the current intended boundary and record the wording drift
  in `PLATFORM.md`, `README.md`, and `ADR-0004` as a planning issue to resolve
  in the first slice. Capture repository-specific and sandbox-specific contract
  work in separate follow-on specs instead of forcing 004 to own those
  implementation details.
- **Rationale**: Current Mystra docs disagree: some files say GitLab and GitHub
  are MVP targets, while others still describe GitLab-only repository support.
  Follow-on framework mapping cannot be trustworthy if repository-provider scope
  is inconsistent.
- **Alternatives considered**:
  - Ignore the drift as cosmetic. Rejected because follow-on specs such as
    agent adapters, MCP submission, and repository delivery depend on
    repository-provider assumptions.
  - Treat GitLab-only as canonical because the implementation is ahead there.
    Rejected because product boundary docs already widened the target.
  - Keep repository and sandbox contract details inside 004. Rejected because
    004 is the architecture gate, not the permanent home for every provider's
    MVP behavior contract.

## Decision 6: Use GitNexus as freshness evidence, then rely on direct source inspection for the plan

- **Decision**: Refresh GitNexus for the current repo state and use its status
  as evidence that planning is based on current code; use direct file inspection
  for the concrete plan facts in this session.
- **Rationale**: `gitnexus status` initially reported the index as stale at
  commit `d45db5f` while the working branch was on `3b6dba7`. Re-running
  `gitnexus analyze` succeeded, which reduces drift risk. The CLI available in
  this session was sufficient for freshness confirmation, while direct source
  reads were the most reliable way to capture exact current file reality.
- **Alternatives considered**:
  - Skip GitNexus entirely. Rejected because Mystra routing explicitly asks for
    it during plan/review phases when current execution flows matter.
  - Rely only on GitNexus summaries. Rejected because the plan still needs exact
    file-level evidence and the available session did not surface MCP query
    tools directly.

## Recorded Divergences And Extensions

### Divergence 1: Agent Execution Lives Inside The Task Container

- **Boundary**: agent execution / sandbox execution
- **Upstream reference**: `README.md` ("the agent is not the sandbox")
- **Mystra surfaces**: `apps/runner-daemon/assets/container-task.sh`,
  `apps/runner-daemon/src/index.ts`
- **Reason**: Mystra's MVP keeps the coding loop inside the task container so
  the runner can ship one local-first execution path without depending on an
  upstream agent-outside-sandbox runtime shape.
- **Follow-on impact**: `005-workflow-blueprint`, `009-agent-adapters`, and
  `011-docker-sandbox-provider` must preserve this as an explicit divergence
  until a later feature proves a different contract.

### Extension 1: MCP Submission Is A Mystra-Owned Control Surface

- **Boundary**: control surface
- **Upstream reference**: `README.md` (web/control layer)
- **Mystra surfaces**: `apps/control-plane/app/api/mcp/route.ts`
- **Reason**: Mystra's primary submission path is remote MCP for other agents
  and skills, which is a product-level extension rather than a reusable Open
  Agents package surface.
- **Follow-on impact**: `007-mcp-server` and `008-mcp-skills` must consume the
  004 lifecycle vocabulary instead of treating MCP itself as the framework
  contract.
