# Feature Specification: Open Agents Framework Reuse

**Feature Branch**: `004-open-agents-framework`
**Created**: 2026-05-14
**Status**: Implemented
**Input**: Mystra PRODUCT.md and constitution declare Open Agents as the framework foundation, but the current codebase has no actual Open Agents dependency, import, or code reuse. The current spec also assumed Open Agents already exposes package-level provider contracts, event schemas, and a runner protocol that Mystra can simply depend on. The upstream project is better treated as the source architecture and codebase to map against, then adapt deliberately where Mystra replaces cloud-managed components with local-first providers. The approved first slice is now narrowed to pinned upstream provenance, module inventory, fork rules, and one real lifecycle/control handoff alignment slice rather than a broad multi-module migration.

## User Scenarios & Testing *(mandatory)*

This is platform architecture work. The scenarios use technical scenarios with named actors because consumer-style user stories would obscure the real operators.

### Technical Scenario 1 - Maintainers Can Trace Mystra Back to Open Agents (Priority: P1)

A platform maintainer can inspect Mystra and understand which subsystems are adopted from Open Agents, which are wrapped, and which are replaced, without reverse-engineering the decision from chat history.

**Why this priority**: Mystra claims Open Agents as its framework foundation. That claim must become traceable reality before more provider, workflow, MCP, and adapter work accumulates around custom assumptions.

**Independent Test**: A maintainer picks one complete subsystem boundary, such as control-surface to workflow handoff or execution runtime isolation, and can trace the Mystra implementation back to a documented Open Agents source module or architectural concept plus any recorded Mystra-specific adaptation.

**Acceptance Scenarios**:

1. **Given** Mystra states that Open Agents is the framework foundation, **When** a maintainer reviews the feature artifacts, **Then** they find the exact upstream source of truth for Open Agents reuse, including repository and pinned revision or release.
2. **Given** a Mystra subsystem is marked as reused or adapted from Open Agents, **When** a maintainer inspects that subsystem, **Then** they can identify the matching upstream concept or source path and the local adaptation boundary.
3. **Given** Mystra intentionally does not mirror an Open Agents subsystem directly, **When** the maintainer reviews the mapping, **Then** the omission or replacement is explicit rather than accidental.

---

### Technical Scenario 2 - Local-First Providers Replace Managed Open Agents Infrastructure Cleanly (Priority: P1)

A provider implementer can see exactly where Mystra preserves Open Agents architecture and where it replaces managed infrastructure with local-first provider seams for persistence, workflow, sandbox, repository, and agent execution.

**Why this priority**: Constitution principle III requires replaceable provider boundaries. Open Agents is the architectural baseline, but Mystra must own the replacements for local-first execution without leaking Vercel-managed assumptions into product contracts.

**Independent Test**: A provider implementer reviews Mystra's provider seams and can tell, for each major dependency area, whether Mystra reuses upstream behavior, wraps it, replaces it behind a provider contract, or excludes it from MVP scope.

**Acceptance Scenarios**:

1. **Given** Open Agents uses a managed service or cloud-tied capability, **When** Mystra replaces it for MVP, **Then** the replacement boundary is documented as a Mystra-owned provider seam with the preserved contract surface and the replaced implementation responsibility.
2. **Given** Mystra defines shared contracts for jobs, runs, workflow state, sandbox execution, or agent execution, **When** a provider implementer reviews them, **Then** the contracts do not leak provider-specific behavior from the first local implementation.
3. **Given** a future provider implementation satisfies the documented Mystra seam, **When** it is introduced, **Then** the feature specification does not require control-plane or runner behavior to be redesigned merely because the first provider was local-first.

---

### Technical Scenario 3 - Divergences And Extensions Are Recorded Before Follow-On Specs Build On Them (Priority: P1)

A future Mystra agent can continue work on workflow, MCP, UI, and agent adapters by reading the Open Agents mapping plus divergence records, rather than rediscovering whether a behavior is upstream, adapted, or Mystra-only.

**Why this priority**: Specs `005-workflow-blueprint`, `007-mcp-server`, `008-mcp-skills`, `009-agent-adapters`, `010-repo-provider-contracts`, and `011-docker-sandbox-provider` all depend on the framework boundary being explicit. Undocumented divergence would silently fork the architecture.

**Independent Test**: A future agent can review this spec and determine which follow-on features are constrained by upstream Open Agents concepts, which are Mystra extensions, and which are deliberate MVP exclusions.

**Acceptance Scenarios**:

1. **Given** Mystra diverges from Open Agents, **When** a maintainer reviews the feature artifacts, **Then** each divergence has a reason, affected boundary, and follow-on impact recorded in this spec or a linked ADR.
2. **Given** Mystra introduces a capability not clearly present in Open Agents, **When** the capability is reviewed, **Then** it is labeled as a Mystra extension rather than being misrepresented as upstream reuse.
3. **Given** a later feature spec depends on workflow, MCP, or agent-provider abstractions, **When** planning starts, **Then** the planner can reference the Open Agents mapping and divergence records instead of inventing a parallel foundation.

---

### Technical Scenario 4 - Initial Alignment Slice Is Small, Verifiable, And Centered On One Proving Boundary (Priority: P2)

A project owner can align Mystra with Open Agents in a staged way: first prove traceable reuse at one high-value subsystem boundary, then expand deliberately, instead of blocking the entire MVP on an all-at-once rewrite.

**Why this priority**: The codebase already contains custom work. A small verified alignment slice reduces rework without turning framework reuse into a large speculative migration.

**Independent Test**: One subsystem-level alignment slice, centered on the lifecycle/control handoff boundary, is completed, documented, and verified without requiring every Mystra package to be rewritten in the same change.

**Acceptance Scenarios**:

1. **Given** the first implementation slice only aligns one subsystem deeply, **When** the slice is completed, **Then** the feature still counts as progress as long as pinned provenance, module inventory, and fork rules are documented for the remaining subsystems.
2. **Given** a subsystem is not yet aligned, **When** a maintainer reviews the spec, **Then** they can see whether it is intentionally deferred, excluded, or blocked on another feature.

### Edge Cases

- What if Open Agents does not expose a reusable package or stable provider contract for the area Mystra needs? Treat the upstream project as the source architecture and code reference, and define a Mystra-owned seam that documents the mapping rather than pretending a package contract already exists.
- What if an upstream Open Agents concept depends on a managed Vercel capability that Mystra excludes from MVP? Record it as a replacement or exclusion with reason, not as incomplete work hidden in a vague TODO.
- What if Mystra needs a capability that Open Agents does not appear to provide? Record it as a Mystra extension with validation expectations and follow-on impact.
- What if current Mystra docs disagree about supported repository providers or other MVP boundaries? Planning for this feature must reconcile those contradictions before downstream specs rely on them.
- What if the first slice tries to prove reuse on a placeholder module or on the runner execution divergence itself? Reject that slice and keep the first proof centered on the lifecycle/control handoff boundary instead.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra MUST identify the exact Open Agents upstream source of truth it is reusing, including repository and pinned revision, release, or equivalent immutable reference.
- **FR-002**: Mystra MUST maintain an architecture mapping that classifies each relevant subsystem as one of: reused, adapted, replaced behind a Mystra-owned provider seam, deferred, or excluded.
- **FR-003**: The architecture mapping MUST cover at least the control surface, workflow orchestration, execution environment isolation, persistence, repository integration, and agent execution surfaces relevant to the MVP.
- **FR-004**: Mystra MUST preserve the core architectural separation that Open Agents demonstrates between control surface, durable orchestration, and isolated execution, unless a documented divergence explicitly says otherwise.
- **FR-005**: For every managed or cloud-tied upstream capability that Mystra replaces, the replacement MUST be expressed as a Mystra-owned provider seam whose shared contract does not leak first-implementation details.
- **FR-006**: Every intentional divergence from Open Agents MUST be documented with reason, affected boundary, and follow-on impact in this spec or a linked ADR.
- **FR-007**: Every Mystra-only capability that cannot be honestly described as upstream reuse MUST be documented as an extension, not hidden inside reuse language.
- **FR-008**: This feature MUST produce a module inventory that classifies MVP-relevant Mystra surfaces, including control plane, workflow, runner execution, repository provider, sandbox provider, and agent adapters, as adopt, extend, fork, defer, or Mystra-only extension.
- **FR-009**: This feature MUST define explicit fork rules so later specs and plans know when Mystra should fork an upstream Open Agents surface instead of stretching local compatibility language.
- **FR-010**: Follow-on feature plans that depend on workflow, MCP, repository, sandbox, or agent-provider contracts MUST reference this feature's mapping and divergence records before introducing new abstractions.
- **FR-011**: The first implementation slice for framework reuse MUST be independently verifiable at one subsystem boundary without requiring a full-repository rewrite, and that first slice MUST be centered on the lifecycle/control handoff boundary rather than on placeholder modules or runner execution migration.
- **FR-012**: Existing Mystra tests for affected packages MUST continue to pass after the initial framework-alignment slice.

### Key Entities

- **OpenAgentsSource**: The exact upstream Open Agents repository and pinned revision or release that Mystra treats as the source architecture and code reference.
- **ArchitectureMapping**: A feature artifact that records, per subsystem, whether Mystra reuses, adapts, replaces, defers, or excludes the upstream Open Agents shape.
- **ModuleInventoryRecord**: A per-surface classification entry that marks a Mystra module or provider boundary as adopt, extend, fork, defer, or Mystra-only extension.
- **ProviderSeam**: A Mystra-owned contract boundary used when replacing an upstream managed capability with a local-first implementation.
- **DivergenceRecord**: A documented explanation of where Mystra intentionally differs from Open Agents and why.
- **ForkRule**: A documented trigger that explains when an upstream Open Agents surface is insufficient and Mystra should fork or explicitly extend it.
- **ExtensionRecord**: A documented Mystra-only capability that has no clear upstream Open Agents equivalent.

### Artifact Outputs

- **Framework Alignment Mapping**: `specs/004-open-agents-framework/contracts/framework-alignment.md`
- **Module Inventory**: `specs/004-open-agents-framework/contracts/module-inventory.md`
- **Provider Seam Catalog**: `specs/004-open-agents-framework/contracts/provider-seams.md`
- **Fork Rules**: `specs/004-open-agents-framework/contracts/fork-rules.md`
- **Divergence And Extension Records**: `specs/004-open-agents-framework/research.md` and `docs/ADR-0004-open-agents-local-provider-boundary.md`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A maintainer can trace at least one complete Mystra subsystem boundary directly to an Open Agents source module or architectural concept plus any local adaptation note.
- **SC-002**: Every MVP-relevant subsystem named in this spec is classified in the architecture mapping as reused, adapted, replaced, deferred, or excluded.
- **SC-003**: The feature produces explicit module inventory and fork rules that later specs can use without re-deriving framework-adoption policy from chat history.
- **SC-004**: Every intentional divergence and Mystra-only extension discovered during the first alignment slice is recorded before follow-on planning proceeds.
- **SC-005**: At least one initial framework-alignment slice lands without breaking existing tests for the affected Mystra packages.
- **SC-006**: A future agent can explain Mystra's foundation by reading the Open Agents source reference, this spec's architecture mapping, module inventory, fork rules, and linked divergence records without relying on prior chat context.
