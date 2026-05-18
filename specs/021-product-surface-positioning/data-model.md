# Data Model: Product Surface Positioning

This feature does **not** define Mystra's product object hierarchy. It models the migration work itself.

## Entities

### TerminologySurface

- **Purpose**: A repository surface whose wording affects future implementation, contracts, or operator understanding.
- **Fields**:
  - `id`: Stable identifier for planning/tracking.
  - `surfaceType`: One of `durable-doc`, `historical-spec`, `public-contract`, `core-function`, `internal-name`, `evidence-only`.
  - `location`: File path or artifact path.
  - `currentName`: The term currently in use.
  - `intendedMeaning`: What the term is supposed to mean on that surface.
  - `stability`: One of `implemented`, `stable-doc-surface`, `planned`, `speculative`.
  - `exposure`: One of `public`, `operator-visible`, `cross-package`, `local-only`.
  - `notes`: Freeform evidence or conflict summary.

### MigrationBatch

- **Purpose**: A grouped set of terminology changes that share risk and verification requirements.
- **Fields**:
  - `id`: Batch identifier such as `batch-a-docs`, `batch-b-contracts`, `batch-c-mechanical`.
  - `riskLevel`: One of `high`, `medium`, `low`.
  - `scopeRule`: Inclusion rule for the batch.
  - `compatibilityPolicy`: One of `rewrite-direct`, `future-defer`.
  - `verification`: Required checks before completion.

### DeferredRenameCandidate

- **Purpose**: A future-only terminology target that is known to be desirable but must not be executed in the current hard-cut scope.
- **Fields**:
  - `currentSurface`: Reference to `TerminologySurface`.
  - `blockedBy`: Why the rename is deferred, such as `target-object-not-implemented` or `public-contract-not-stable`.
  - `futureTarget`: Candidate replacement term, if known.
  - `revisitTrigger`: Condition that makes the rename actionable later.

### CutoverRule

- **Purpose**: A policy applied to outward/core naming changes during the direct cut.
- **Fields**:
  - `surfaceClass`: `public-contract` or `core-function`.
  - `allowsAliasWindow`: Boolean, expected to be `false` for this feature.
  - `requiresDocUpdate`: Boolean.
  - `requiresFocusedTests`: Boolean.
  - `requiresOwnerReview`: Boolean.

## Relationships

- One `MigrationBatch` groups many `TerminologySurface` entries.
- One `TerminologySurface` may map to zero or one `DeferredRenameCandidate`.
- One `CutoverRule` may apply to many `TerminologySurface` entries in Batch B.

## Derived Planning Rules

1. If `stability` is `planned` or `speculative`, the surface must not enter an active rename batch.
2. If `exposure` is `public`, `operator-visible`, or `cross-package`, the surface belongs to the outward/core path and cannot use the mechanical cleanup policy.
3. If `intendedMeaning` is runtime execution workspace, `workspace` is protected and should not be replaced by a tenancy noun.
4. If a current repository surface exposes `Job*` naming and is `implemented` or `stable-doc-surface`, it belongs in the direct hard-cut inventory rather than a compatibility bucket.
