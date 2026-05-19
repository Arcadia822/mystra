# Implementation Plan: Agent Runtime Skills

**Branch**: `016-agent-runtime-skills` | **Date**: 2026-05-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-agent-runtime-skills/spec.md`

## Summary

Align Mystra's first coordinating skill surface to the current management truth
by building on the existing repo-local companion skills from `008-mcp-skills`
instead of inventing a new SDK. The implementation should keep the skills thin
over the current MCP transport and canonical management truth from `014` and
`015`, tighten their boundary contract, confirm `008` remains the long-term
owner of the three local skill manifests, and add verification that the
submit-and-check-status loop stays aligned with the control-plane API.

## Technical Context

**Language/Version**: Markdown skill manifests plus TypeScript 5.9 / Node.js 24-backed control-plane contracts  
**Primary Dependencies**: repo-local `.agents/skills/`, `/api/mcp`, canonical route semantics in `apps/control-plane/app/api/`, `@mystra/shared` management schemas, and `scripts/submit-job.mjs` as HTTP-side prior art  
**Storage**: N/A for the skill layer itself; skills call the existing control-plane persistence through MCP / HTTP surfaces  
**Testing**: `pnpm --filter @mystra/shared build`, `pnpm --filter @mystra/control-plane test`, focused route/MCP parity assertions, and manual skill/MCP invocation evidence  
**Target Platform**: repo-local agent skill environments that honor `.agents/skills/<skill>/SKILL.md`, with Mystra MCP reachable on localhost or a trusted internal network  
**Project Type**: local skill-pack / interface-contract feature  
**Performance Goals**: one MCP call per primitive action, no hidden retries, and clear failure reporting fast enough for agent orchestration loops  
**Constraints**: stay inside the current MCP tool contract, keep API as truth and skill as policy, do not introduce a shared SDK yet, and preserve private-ops trust-boundary wording until caller auth exists  
**Scale/Scope**: three first-slice coordinating skills, one local extension pattern for future skills, and no new package, publish pipeline, or second contract layer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The feature stays inside the
  current MVP and does not introduce caller auth, retry APIs, callback flows,
  logs APIs, or a new public package contract.
- **Typed Contracts at Service Boundaries**: PASS. The skills remain thin over
  canonical management payloads and shared schemas rather than inventing a new
  type owner.
- **Providers Are Replaceable Boundaries**: PASS. The skill surface sits above
  MCP and the control-plane API. It does not import provider internals.
- **Runner Isolation and Secret Hygiene**: PASS. The skills do not widen runner
  secret handling and should continue to treat connection failures as transport
  failures rather than hiding them.
- **Verification And Documentation Before Delivery**: PASS. Delivery requires
  updated feature artifacts, nearby skill docs, focused route/MCP verification,
  and local usage guidance that matches the current truth.

## Project Structure

### Documentation (this feature)

```text
specs/016-agent-runtime-skills/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── skill-surface.md
│   └── skill-error-semantics.md
└── tasks.md
```

### Source Code (repository root)

```text
.agents/skills/
├── mystra-submit-implementation-request/
│   └── SKILL.md
├── mystra-submit-user-journey/
│   └── SKILL.md
└── mystra-check-job-status/
    └── SKILL.md

apps/control-plane/app/api/
├── mcp/route.ts
├── jobs/route.ts
├── jobs/[id]/route.ts
└── projects/[slug]/route.ts

packages/shared/
└── src/management.ts

specs/008-mcp-skills/
specs/014-management-api-truth/
specs/015-multi-project-lanes/
docs/LOCAL-USAGE.md
scripts/submit-job.mjs
```

**Structure Decision**: Reuse the existing repo-local skill layout under
`.agents/skills/` instead of adding a package or helper library. Treat
`008-mcp-skills` as the long-term owner of the three local Mystra skills, then
use `016` as the alignment slice that reconciles those already-shipped manifests
to the post-`014` / `015` canonical project/job semantics.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. `008-mcp-skills` already shipped the three repo-local skills that `016`
   needs. `016` should not recreate them as a parallel surface.
2. The current skill surface should stay MCP-backed in the first slice, because
   Mystra remote MCP remains the primary submission path for other agents and
   skills in the MVP.
3. `014` and `015` now provide the contract truth the skills should describe and
   validate against: canonical project selection/detail, canonical run snapshot,
   and current-vs-frozen lane attribution.
4. A shared helper module is not justified yet. The first slice is small enough
   that explicit per-skill manifests plus shared contract docs are the simpler
   choice.
5. GitNexus was not necessary for this planning slice. Direct source reads over
   the three skill manifests, MCP route, canonical route handlers, shared
   management schemas, and existing `008` artifacts provided higher-confidence
   evidence than a broader graph walk would add.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/skill-surface.md](./contracts/skill-surface.md)
- [contracts/skill-error-semantics.md](./contracts/skill-error-semantics.md)

The implementation slice for `016` should:

1. Treat the current repo-local skills as the starting surface, not as throwaway
   prototypes.
2. Reconcile those skills to the canonical management semantics frozen by `014`
   and extended by `015`.
3. Keep the surface intentionally small:
   - `mystra-submit-implementation-request`
   - `mystra-submit-user-journey`
   - `mystra-check-job-status`
4. Record, but do not re-home, the shared extension rule for future skill
   authors: new skills may package inputs and outputs differently, but they
   must not invent a second coordination truth or silently widen transport
   semantics. Durable ownership for that rule stays with `008`.
5. Add or refresh verification so the submit-and-check-status loop is proven
   against the current control-plane behavior.

### Boundary Diagram

```text
canonical HTTP routes
  -> shared management schemas
    -> MCP route / tool transport
      -> local coordinating skills (016)
        -> future skill authors reuse the same conventions

submit implementation request / user journey
  -> mystra_create_job
    -> created job id + run state

check status
  -> mystra_get_job
    -> canonical run snapshot
      -> human-readable status summary

non-goals in this slice:
  shared SDK package
  published skill registry
  second transport model
  direct server-internal imports from skills
```

## Code Evidence

- `.agents/skills/mystra-submit-user-journey/SKILL.md`,
  `.agents/skills/mystra-submit-implementation-request/SKILL.md`, and
  `.agents/skills/mystra-check-job-status/SKILL.md` already define the first
  repo-local coordinating skill surface. That is the direct starting point for
  this feature.
- `specs/008-mcp-skills/plan.md`, `tasks.md`, and `quickstart.md` already
  document these skills as implemented MCP companion wrappers. `016` should
  reuse that evidence instead of pretending the surface is greenfield.
- `apps/control-plane/app/api/mcp/route.ts` still owns the transport mapping for
  `mystra_create_job` and `mystra_get_job`; the skill layer should stay above
  those tool contracts.
- `apps/control-plane/app/api/jobs/route.ts`,
  `jobs/[id]/route.ts`, and `projects/[slug]/route.ts` plus
  `packages/shared/src/management.ts` now define the current canonical project
  detail, job snapshot, and lane semantics that the skills should describe and
  validate against.
- `scripts/submit-job.mjs` is still useful prior art for the same coordination
  loop over HTTP: lookup target project, submit job, then poll `GET /api/jobs`.
  It is not the skill surface, but it proves the workflow shape.

## Implementation Order

1. Audit the current three skill manifests against the current canonical
   management semantics from `014` and `015`.
2. Update the skill manifests and `016` contracts so the required inputs,
   failure behavior, and summary expectations are explicit and aligned, while
   reflecting that `008` remains the durable skill owner.
3. Avoid duplicating existing route/MCP coverage. Reuse the current happy-path,
   missing-input, and missing-job route tests as the control-plane proof, then
   add only the missing skill-layer alignment checks and manual transport-failure
   validation.
4. Add automated skill-contract tests that validate explicit fixture payloads
   and promised status-summary fields for the three local skills against current
   route/shared schemas so skill guidance cannot silently drift from the API
   truth.
5. Refresh nearby docs such as `docs/LOCAL-USAGE.md` when the surface wording or
   manual fallback guidance changes.
6. Run engineering review before generating tasks, because this feature touches
   agent surface hierarchy, MCP transport assumptions, and cross-feature
   ownership with `008`, `014`, and `015`.

## What Already Exists

| Existing code / flow | Already solves | Reuse plan |
|---|---|---|
| `008-mcp-skills` feature artifacts | The three local skills already exist and are documented as MCP companion wrappers | Keep as the long-term owner, with `016` serving as the alignment and verification slice |
| `.agents/skills/mystra-*` | Current skill manifests and baseline input/summary rules | Tighten and align them to current canonical semantics |
| `apps/control-plane/app/api/mcp/route.ts` | `mystra_create_job` / `mystra_get_job` transport layer | Reuse as the underlying tool transport, not as a product-truth owner |
| `apps/control-plane/app/api/jobs/*` | Canonical job creation, polling snapshot, cancel semantics | Use as HTTP truth the MCP route should mirror |
| `packages/shared/src/management.ts` | Canonical management error, project, job, lane, and snapshot schemas | Reuse as the semantic owner for skill-facing expectations |
| `scripts/submit-job.mjs` | Existing submit-then-poll flow over HTTP | Reuse as proof of the coordination loop shape |

## NOT in scope

- A shared SDK package, because the user explicitly deferred SDK extraction until
  the management API is mature and stable.
- A published or external skill registry, because the current repository already
  uses repo-local skill discovery under `.agents/skills/`.
- Replacing MCP with direct HTTP calls for this first slice, because Mystra
  remote MCP remains the primary submission path for other agents and skills in
  the MVP.
- New MCP top-level fields or a wider workflow contract, because the current
  job-creation tool contract is already in use and should be extended only when
  the canonical API truly requires it.
- CLI/operator work, because that belongs to `017-operator-cli-surface`.

## Verification Plan

| Surface | Evidence |
|---|---|
| Shared contract compatibility | `pnpm --filter @mystra/shared build` |
| Canonical route / MCP behavior | `pnpm --filter @mystra/control-plane test` |
| Skill-doc contract drift | Add automated tests with explicit implementation-request, user-journey, and status fixtures, then validate those fixtures and summary expectations against current MCP input and canonical snapshot contracts |
| Workspace type safety | `pnpm typecheck` when route/shared code changes justify it |
| Skill discovery | `find .agents/skills -maxdepth 2 -name SKILL.md | grep 'mystra-'` |
| Manual MCP validation | `curl` against `/api/mcp` for one create-job flow and one get-job flow, matching the documented skill expectations |
| Local usage guidance | Reconcile `docs/LOCAL-USAGE.md` and `specs/016-agent-runtime-skills/quickstart.md` with the final surface wording |

## Risks And Mitigations

- **Risk**: `016` duplicates `008` and creates two competing stories for the same
  skills.
  **Mitigation**: Keep `008` as the durable skill owner and position `016` as
  the post-`014` / `015` alignment layer for the same local skills.
- **Risk**: The skills silently drift from canonical management semantics as
  `014` and `015` evolve.
  **Mitigation**: Anchor the plan and contracts to `packages/shared` management
  schemas plus focused route/MCP verification and automated checks against the
  agreed fixture-backed skill contracts.
- **Risk**: A premature helper module or package adds a second contract layer.
  **Mitigation**: Keep the first slice as explicit skill manifests plus docs and
  verification; add shared code only if duplication becomes materially costly.
- **Risk**: Future skill authors copy old prompt/manual patterns instead of the
  current boundary rules.
  **Mitigation**: Make extension rules and expected error semantics part of the
  `016` contract set.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND | 1 material implementation-shape issue, resolved by choosing explicit fixture-backed contract tests |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL:** Both reviews agreed on keeping `008` as the durable owner and adding automated drift detection; the outside voice narrowed the test mechanism to explicit fixtures instead of markdown parsing.

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — ready for task generation.

## Post-Design Constitution Check

- **Specification Owns Product Boundaries**: PASS. The design keeps skill-first
  coordination inside the current MVP and leaves future SDK extraction deferred.
- **Typed Contracts at Service Boundaries**: PASS. The skill surface remains a
  consumer of canonical management schemas and MCP/API truth rather than a new
  owner.
- **Providers Are Replaceable Boundaries**: PASS. The plan does not couple skill
  behavior to storage or provider internals.
- **Runner Isolation and Secret Hygiene**: PASS. The design does not widen
  runner secret handling or add hidden retries that would obscure failures.
- **Verification And Documentation Before Delivery**: PASS. The plan requires
  updated skill docs, contracts, quickstart guidance, and focused verification
  before tasks.
