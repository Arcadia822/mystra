# ADR-0003: Separate Platform Capabilities from Project State

## Status

Superseded by 040, 044, and 046

The platform-capability separation remains valid. The Project field list and
ownership statements below are historical: Project no longer owns Agent,
Runtime, image, prewarm, Task, or Session defaults. Agent, Project, Task, and
Session are Team-scoped peers; Session independently selects Runtime, Provider,
Agent, and Context and may optionally reference Project and Task.

## Context

Mystra previously treated several concepts as loosely related fields spread across execution submissions, Runner registration payloads, and informal documentation. Platform-scoped concerns such as executor type were easy to blur with Project defaults and Session-owned execution choices.

This made the boundary hard to reason about:

- Runner registration accepted an untyped `Record<string, unknown>` capability bag.
- execution metadata could become a dumping ground for first-class platform concerns.
- MVP default runtime limits existed in prose, but not as a typed contract.

Mystra needs an explicit, additive model that the current MVP can actually use without overbuilding a registry or multi-tenant configuration system.

## Decision

Introduce explicit shared schemas:

1. `PlatformCapabilities`
   - Runner/platform-scoped declared capabilities.
   - Historical fields: `agents`, `executor`, optional `image`; current Provider
     terminology uses `executionProviders` and separates sandbox providers.

2. `PlatformDefaults`
   - Platform-level runtime defaults.
   - Current fields include concurrency, timeout, heartbeat, polling, CPU, and memory defaults.

3. `Project`
   - Historical project-scoped parent configuration.
   - Historical fields: `name`, `slug`, `repo`, `baseBranch`, `defaultAgent`,
     `image`, `prewarmConfig`, and `metadata`.

Current replacement: Task is Team-scoped and not owned by Project. Session is
also Team-scoped, may independently reference `0..1` Task and `0..1` Project,
and selects Runtime, Provider, Agent and Context without Project defaults.

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
