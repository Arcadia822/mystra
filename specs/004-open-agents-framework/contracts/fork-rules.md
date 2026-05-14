# Contract: Fork Rules

This contract defines when Mystra should explicitly fork an upstream Open
Agents surface instead of continuing to describe a local change as simple
adoption or extension.

## Required Fork Rule Fields

Each fork rule MUST contain:

- `appliesTo`
- `trigger`
- `requiredEvidence`
- `allowedFallback`
- `owner`
- `downstreamImpact`
- `mappingLinks`
- `moduleInventoryLinks`

## Baseline Fork Triggers

### Rule 1: Missing Shared Contract Surface

- **appliesTo**: workflow, lifecycle, repository, sandbox, or agent execution
  surfaces
- **trigger**: the required upstream behavior exists only inside workflow-local
  or app-local implementation and cannot be referenced cleanly as a reusable
  contract target
- **requiredEvidence**: pinned upstream file path plus the concrete Mystra
  requirement that cannot be satisfied by adoption or extension alone
- **allowedFallback**: create a Mystra-owned forked contract with a source note
  back to the pinned upstream path
- **owner**: the feature spec that introduces the fork
- **downstreamImpact**: update 004 mapping/module inventory plus the consuming
  follow-on spec

### Rule 2: Semantic Conflict With Mystra Invariants

- **appliesTo**: any upstream surface that conflicts with Mystra's product or
  provider invariants
- **trigger**: the upstream semantic meaning conflicts with local-first provider
  ownership, runner isolation, or job/result contract boundaries
- **requiredEvidence**: exact upstream source reference plus the Mystra
  constitution or spec rule that would be violated
- **allowedFallback**: explicit fork or explicit divergence record, not hidden
  adaptation language
- **owner**: the feature spec that detects the conflict
- **downstreamImpact**: update divergence records and dependent specs before
  implementation proceeds

### Rule 3: Placeholder Proof Rejection

- **appliesTo**: placeholder or stub modules
- **trigger**: a feature tries to claim framework alignment using a surface that
  does not yet carry meaningful behavior
- **requiredEvidence**: current local file proof that the surface is still a
  placeholder or name-only export
- **allowedFallback**: mark the surface `defer` and choose a real boundary for
  proof instead
- **owner**: 004 until a later feature fully owns the surface
- **downstreamImpact**: do not let tasks or implementation claim adoption on the
  placeholder path

## Planning Rule

Before a later feature chooses `fork` in the module inventory, it MUST:

1. Reference one of the baseline fork rules above or add a new explicit fork
   rule here.
2. Show the pinned upstream source path and the concrete local conflict.
3. Record which downstream spec or contract now depends on the fork.

## Cross-Link Rule

Every concrete fork decision in 004 or a later feature MUST point back to:

- one or more subsystem rows in `framework-alignment.md`, and
- one or more concrete surfaces in `module-inventory.md`.
