# Data Model: Open Agents Framework Reuse

This feature's primary entities are documentation and planning records that
govern how Mystra relates to the upstream Open Agents project.

## OpenAgentsSource

- **Purpose**: Identifies the exact upstream source Mystra treats as its
  framework foundation for this feature.
- **Fields**:
  - `repository`: canonical upstream repository identifier
  - `pinnedReference`: immutable revision, release tag, or equivalent
  - `retrievedAt`: when the source was reviewed for this feature
  - `notes`: brief framing of what parts are considered relevant
- **Rules**:
  - Must exist before any implementation slice claims upstream reuse.
  - Must be updated when the feature intentionally changes which upstream
    revision is being compared against.

## ArchitectureMappingEntry

- **Purpose**: Records how one Mystra subsystem relates to the upstream Open
  Agents shape.
- **Fields**:
  - `subsystem`: one of `control-surface`, `workflow`, `sandbox`,
    `persistence`, `repository`, `agent-execution`, or another explicitly named
    MVP-relevant surface
  - `status`: `reused`, `adapted`, `replaced`, `deferred`, or `excluded`
  - `upstreamReference`: upstream concept or source path being mapped
  - `mystraPaths`: local file or directory paths that implement the subsystem
  - `providerSeam`: optional linked provider seam when Mystra replaces a managed
    capability
  - `dependentFeatures`: specs or ADRs that rely on this mapping
  - `notes`: short explanation of the current state
- **Rules**:
  - Every MVP-relevant subsystem must have exactly one current mapping entry.
  - `status=replaced` requires a linked `ProviderSeamRecord`.
  - `status=adapted` or `status=reused` requires an `upstreamReference`.

## ModuleInventoryRecord

- **Purpose**: Records how a concrete Mystra module or provider-facing surface
  should evolve after 004 establishes the framework boundary.
- **Fields**:
  - `surface`: concrete module, package, or provider-facing area
  - `classification`: `adopt`, `extend`, `fork`, `defer`, or
    `mystra-only-extension`
  - `upstreamReference`: relevant upstream source path or concept
  - `localOwner`: Mystra file, package, or spec that owns the current surface
  - `notes`: short explanation of why this classification applies
  - `followOnSpec`: the next feature spec expected to realize the change
- **Rules**:
  - Every MVP-relevant surface named in 004 must have exactly one current module
    inventory record.
  - `classification=fork` requires at least one linked `ForkRule`.
  - `classification=extend` must keep the upstream source visible instead of
    hiding it under local-only naming.

## ProviderSeamRecord

- **Purpose**: Defines a Mystra-owned replacement boundary for an upstream
  managed capability.
- **Fields**:
  - `seamName`: persistence, workflow, sandbox, repository, or agent execution
  - `upstreamCapability`: what Open Agents relies on or demonstrates
  - `mystraContractOwner`: local package/module owning the replacement boundary
  - `firstImplementation`: current local-first provider implementation
  - `leakageGuard`: what must not leak from the first implementation into shared
    contracts
  - `verification`: how the seam is validated in docs/tests
- **Rules**:
  - Every replacement seam must point to a Mystra-owned contract surface.
  - Leakage guards must be phrased in contract terms, not implementation wishes.

## DivergenceRecord

- **Purpose**: Captures an intentional architectural difference from Open
  Agents.
- **Fields**:
  - `title`
  - `boundary`
  - `reason`
  - `impact`
  - `followOnFeatures`
  - `verification`
- **Rules**:
  - Must be created when Mystra intentionally differs in behavior or structure.
  - Must name downstream features affected by the divergence when known.

## ForkRule

- **Purpose**: Defines when Mystra should explicitly fork an upstream Open
  Agents surface instead of stretching local compatibility language.
- **Fields**:
  - `trigger`
  - `appliesTo`
  - `requiredEvidence`
  - `allowedFallback`
  - `owner`
- **Rules**:
  - A fork rule must be concrete enough that a later feature can decide whether
    it is still on the "adopt/extend" path or has crossed into a real fork.
  - A fork rule must point to the owner responsible for updating downstream docs
    when the trigger is met.

## ExtensionRecord

- **Purpose**: Captures a Mystra capability with no clear upstream Open Agents
  equivalent.
- **Fields**:
  - `capability`
  - `owner`
  - `whyNotUpstreamReuse`
  - `validation`
- **Rules**:
  - Must not be used to hide divergence from an actually comparable upstream
    capability.

## AlignmentSlice

- **Purpose**: Defines the first verifiable implementation scope for this
  feature.
- **Fields**:
  - `targetSubsystem`
  - `objective`
  - `affectedPaths`
  - `requiredMappings`
  - `requiredModuleInventoryEntries`
  - `requiredForkRules`
  - `tests`
  - `deferredItems`
- **Rules**:
  - Must target one subsystem boundary.
  - Must list deferred items explicitly so the slice does not silently expand.
  - The approved first slice for 004 is the lifecycle/control handoff boundary,
    centered on `packages/shared/src/events.ts` and the control-plane submission
    handoff.
