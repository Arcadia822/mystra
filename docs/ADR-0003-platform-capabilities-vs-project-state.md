# ADR-0003: Separate Platform Capabilities from Project State

## Status

Accepted

## Context

Mystra previously treated several important concepts as loosely related fields spread across `TaskSpec`, runner registration payloads, and informal documentation. Platform-scoped concerns such as executor type or runner image identity were easy to blur with project-scoped concerns such as repository branch selection or task prompt.

This made the boundary hard to reason about:

- Runner registration accepted an untyped `Record<string, unknown>` capability bag.
- `TaskSpec.metadata` could become a dumping ground for first-class platform concerns.
- MVP default runtime limits existed in prose, but not as a typed contract.

Mystra needs an explicit, additive model that the current MVP can actually use without overbuilding a registry or multi-tenant configuration system.

## Decision

Introduce explicit shared schemas:

1. `PlatformCapabilities`
   - Runner/platform-scoped declared capabilities.
   - Current fields: `agents`, `executor`, optional `image`.

2. `PlatformDefaults`
   - Platform-level runtime defaults.
   - Current fields: `maxConcurrency`, `runTimeoutSeconds`, `heartbeatExpirySeconds`, `longPollTimeoutSeconds`, `containerCpuQuota`, `containerMemoryGb`.

3. `Project`
   - Durable project-scoped parent configuration.
   - Current fields: `name`, `slug`, `repo`, `baseBranch`, `defaultAgent`, `runtime`, `prewarmConfig`, and `metadata`.

`TaskSpec` remains the current task identity layer plus `projectId`, task branch, prompt, optional merge-request metadata, optional runtime override, and optional repo/baseBranch/agent overrides. Platform concerns do not move into `TaskSpec`.

Runner registration must use typed `PlatformCapabilities` instead of an arbitrary capability record.

## Consequences

Positive:

- Platform/runtime concerns now have a strict schema boundary.
- Project-scoped config can reject platform-only fields.
- MVP runtime defaults are documented as code, not just prose.
- The model gives future features a clear home:
  - platform features extend `PlatformCapabilities` or `PlatformDefaults`
  - project features extend `Project`

Negative:

- Custom runner registration callers must conform to the typed capabilities object.
- `PlatformDefaults` is a typed contract first; not every runtime path consumes it yet.

## Verification

The decision is considered implemented when:

1. shared schema tests cover `PlatformCapabilities`, `PlatformDefaults`, and Project create/update contracts
2. runner registration rejects untyped capability bags
3. control-plane local runner storage uses typed `PlatformCapabilities`
4. spec, architecture notes, and implementation plan describe the separation
5. `pnpm test`, `pnpm typecheck`, and `pnpm build` pass
