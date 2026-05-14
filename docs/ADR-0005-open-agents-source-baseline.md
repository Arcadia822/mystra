# ADR-0005: Open Agents as Source-Authoritative Baseline, Mystra-Owned Interfaces

## Status

Accepted

## Context

ADR-0004 established that Mystra should align directly with Open Agents instead
of merely borrowing vague inspiration from it. Follow-on planning uncovered a
critical ambiguity in that wording: contributors could read "framework
foundation" as if Open Agents already shipped a packaged SDK with complete,
reusable interface definitions for Mystra's workflow, provider, and harness
surfaces.

That interpretation is not accurate. Open Agents provides valuable architectural
shape and source-level ownership signals, especially around control surface,
workflow ownership, and sandbox separation. But several Mystra seams still do
not exist upstream as reusable package contracts. Workflow orchestration is the
most immediate example: upstream source demonstrates the right lifecycle model,
but Mystra still has to define its own interface and SDK surfaces to connect the
control plane, runner daemon, repository delivery, and agent execution path.

Without an explicit clarification, specs and 5xP documents will keep drifting
toward an imagined upstream SDK and future work will repeatedly lose time
waiting for interfaces that are not actually present.

## Decision

Treat Open Agents as a **source-authoritative framework baseline and reference
architecture**, not as a packaged SDK with complete extension interfaces for all
Mystra surfaces.

Mystra will:

1. Reuse Open Agents source structures, lifecycle ownership patterns, and
   architecture decisions where they are authoritative and compatible.
2. Define **Mystra-owned interfaces and SDK surfaces** wherever upstream does
   not expose a reusable contract that fits Mystra's runner/control-plane and
   provider boundaries.
3. Record each such seam explicitly in specs, ADRs, and 5xP files so future
   contributors know whether a surface is adopted, extended, replaced, or
   excluded.

This decision does **not** change the MVP product goal. It changes how Mystra
describes and implements the technical path to that goal.

## Alternatives Considered

### Keep saying "framework foundation" without clarification

- Pros: Minimal wording change.
- Cons: Continues to imply a complete upstream SDK surface, which causes
  repeated planning mistakes.
- Rejected: Ambiguity is already harming downstream specs.

### Fully decouple from Open Agents wording

- Pros: Removes confusion about upstream contracts.
- Cons: Discards the architectural value of the upstream source baseline.
- Rejected: Mystra still benefits from Open Agents as the reference shape.

### Wait for an external SDK to appear and adopt that instead

- Pros: Less internal design work if a perfect match existed.
- Cons: Blocks current architecture on a dependency that does not exist today
  and does not remove Mystra-specific seam design.
- Rejected: Delays MVP-critical design with no guaranteed payoff.

## Consequences

Positive:

- 5xP and spec documents can describe the real implementation path honestly.
- Future feature specs can stop assuming upstream package contracts exist where
  they do not.
- Mystra can design extensible local interfaces without pretending they came
  from an unavailable SDK.
- Open Agents remains a strong architectural reference without becoming a source
  of false contract assumptions.

Negative:

- Mystra now owns more interface design responsibility at workflow and harness
  seams.
- Contributors must distinguish between source-level alignment and package-level
  reuse more carefully.
- Some prior wording in README, 5xP, specs, and ADRs must be updated to remain
  consistent.

## Verification

This decision is validated when:

1. 5xP root files describe Open Agents as a source-authoritative baseline rather
   than an assumed packaged SDK.
2. `docs/SPEC.md` describes Mystra-owned interfaces at provider and orchestration
   seams.
3. Workflow and harness specs can reference Open Agents and Stripe Minions as
   architecture inputs while still defining Mystra-owned contracts explicitly.
