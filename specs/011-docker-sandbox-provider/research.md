# Research: Docker Sandbox Provider

## Decision 1: `SandboxProvider` owns launch, stop, inspect, and cleanup

- **Decision**: Define `SandboxProvider` as the boundary for launching a task
  execution environment, observing exposed ports and session metadata, stopping
  execution for cancellation/timeout, and reporting cleanup outcomes.
- **Rationale**: Those behaviors are currently scattered across runner heuristics
  and event emission. Formalizing them makes Docker a replaceable first
  implementation instead of the only shape the system understands.
- **Alternatives considered**:
  - Leave everything inline in the runner. Rejected because later providers
    would have to copy undocumented behavior.

## Decision 2: The resolved runtime contract stays the launch input

- **Decision**: Keep `ResolvedRuntimeContract` as the only provider launch input
  for image, mounts, context bundles, caches, ports, and secrets.
- **Rationale**: `002-runtime-profile-context` already established the runtime
  contract boundary. Re-deriving Docker semantics in multiple places would
  corrupt that work.
- **Alternatives considered**:
  - Add Docker-specific launch fields to shared runtime schemas. Rejected
    because it would leak the first implementation into the provider-neutral
    contract.

## Decision 3: Retained preview containers are a provider policy/output

- **Decision**: Treat the retained-preview container behavior as an explicit
  provider-owned policy and outcome instead of a shell accident.
- **Rationale**: Preview URLs and retained containers are already part of the
  review loop. UI, MCP, and result handling need one stable place to read that
  behavior from.
- **Alternatives considered**:
  - Leave previews as undocumented metadata. Rejected because consumers already
    depend on the surfaced URLs.

## Decision 4: Cleanup failure needs one structured outcome surface

- **Decision**: Normalize cleanup reporting so timeout/cancel/cleanup failure is
  represented in one provider-owned outcome model.
- **Rationale**: Current behavior is split between run events and result
  metadata. Operators need one explainable surface.
- **Alternatives considered**:
  - Rely on events only. Rejected because final callers often inspect the result
    snapshot first.

## Decision 5: The first refactor slice should wrap, not rewrite

- **Decision**: Start by wrapping the existing Docker behavior behind a provider
  contract and migrate internals incrementally.
- **Rationale**: The current path already works and is covered by tests.
  Rewriting the whole runner/container loop at once would add risk without
  clarifying the boundary first.
- **Alternatives considered**:
  - Full runner rewrite. Rejected because it would blur contract work with
    implementation churn.

## Code Facts Captured

- `apps/runner-daemon/src/index.ts` owns Docker launch args, mounts, ports,
  secret injection, cancellation polling, and cleanup stop/kill behavior.
- `apps/runner-daemon/assets/container-task.sh` owns container-local execution,
  quality gate, preview service startup, and final result writing.
- `docs/RUNNER-DOCKER-MVP.md` records retained previews, dynamic ports, and
  cache behavior that must now be lifted into the provider contract.
