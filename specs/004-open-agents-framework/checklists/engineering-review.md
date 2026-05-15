# Engineering Review: Open Agents Framework Reuse

**Feature**: `004-open-agents-framework`
**Reviewed**: 2026-05-14
**Inputs**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [quickstart.md](../quickstart.md), [contracts/framework-alignment.md](../contracts/framework-alignment.md), [contracts/provider-seams.md](../contracts/provider-seams.md)

## Outcome

Proceed to task decomposition with revisions captured as implementation
constraints.

The plan is aligned with the constitution and keeps framework reuse inside the
MVP boundary. It correctly avoids pretending that Open Agents is already a
drop-in provider-contract package, and it keeps the first slice small enough to
verify. The main risk is still narrative inflation: later work could start
calling things "reused" when they are only distantly inspired, or skip
documenting divergences because the architecture feels directionally similar.

## Code Evidence

- GitNexus CLI reported the repo stale at commit `d45db5f` and was refreshed
  successfully on the current commit before this review.
- `apps/workflows/src/index.ts` is still a placeholder export, so workflow
  reuse is not yet substantiated by current code.
- `packages/agent-adapters/src/index.ts` is still a placeholder export, so the
  agent boundary is declared but not yet implemented.
- `apps/control-plane/app/api/mcp/route.ts` already exposes a Mystra-owned MCP
  surface with shared-schema validation, which means control-surface reuse must
  be mapped carefully rather than assumed from upstream terminology.
- `apps/runner-daemon/src/index.ts` still owns Docker execution, local runtime
  translation, and run-result reporting, which is the practical execution
  boundary for the first slice.
- `packages/shared/src/events.ts` defines Mystra lifecycle events locally;
  event compatibility with Open Agents is therefore a mapping/review question,
  not a package-import fact.

## Review Findings

1. **Do not make dependency presence the definition of reuse.**
   The upstream source is a reference app. The feature is successful only if
   Mystra can truthfully map its own subsystem boundaries to upstream concepts
   and recorded divergences.

2. **Agent placement is the highest-value divergence to state early.**
   Open Agents keeps the agent outside the sandbox. Mystra's current MVP runs
   Codex or Copilot CLI inside the task container. Downstream workflow and
   adapter specs need that fact to stay explicit.

3. **Workflow and adapter placeholders make good first-slice candidates, but
   only if the slice stays narrow.**
   `apps/workflows` and `packages/agent-adapters` are clearly underdeveloped.
   They are attractive targets for alignment, but this feature should first
   prove one boundary, not redesign both surfaces at once.

4. **Repository-provider wording drift is not cosmetic.**
   Product and spec docs mention GitLab plus GitHub, while some platform docs
   and ADR text still imply GitLab-first or GitLab-only. Tasks must include a
   bounded reconciliation step so follow-on features do not inherit
   contradictions.

5. **Documentation contracts must stay stricter than implementation anecdotes.**
   The mapping and seam artifacts should name exact upstream paths, local
   owners, and downstream dependencies. General statements like "similar to Open
   Agents" are not sufficient.

## Required Task-Decomposition Rules

- Create provenance and mapping tasks before any subsystem code-edit tasks.
- Put document-boundary reconciliation before follow-on subsystem alignment
  tasks when the selected slice touches repository-provider assumptions.
- Require one task dedicated to recording the agent-placement divergence unless
  the chosen slice removes it.
- Keep the first implementation slice scoped to one subsystem boundary.
- Require focused tests or concrete review evidence for any touched code package.

## First-Slice Guidance

Prefer one of these first-slice shapes:

1. **Workflow-boundary traceability**:
   make `apps/workflows` and its relationship to job creation / runner claim /
   sandbox execution explicit, while preserving Mystra's local dummy provider.
2. **Execution-boundary traceability**:
   document and, if needed, slightly refactor the runner/executor ownership so
   the control-plane, workflow, runner, and task-container responsibilities map
   cleanly to the upstream architecture plus explicit divergence.

Avoid starting with auth, UI, or broad GitHub parity in this feature.

## Owner Decisions Needed

No blocking owner decision is required to decompose tasks. The plan already
chooses the conservative path: provenance first, mapping second, one slice
third.

## Post-Implementation Validation Update

The first lifecycle/control-handoff slice now has concrete implementation
evidence in `packages/shared/src/events.ts` and
`apps/control-plane/app/api/mcp/route.ts`.

### Focused Validation Outcome

- PASS: `pnpm --filter @mystra/shared exec vitest run src/events.test.ts -t "exports control-plane handoff and terminal event vocabularies from the shared lifecycle schema"`
- PASS: `pnpm --filter @mystra/control-plane exec vitest run app/api/routes.test.ts -t "advertises shared lifecycle handoff metadata in MCP tools/list"`
- PASS: `pnpm --filter @mystra/shared typecheck`
- PASS: `pnpm --filter @mystra/control-plane typecheck`

### Broader Package Validation Outcome

- PASS: `pnpm --filter @mystra/shared test`
- PASS: `pnpm --filter @mystra/control-plane test`

Current revalidation on the local repository shows that the broader package
checks now pass as well. The remaining runtime signal is only an engine warning
because the active shell is on Node `v26.1.0` while the package engines expect
`>=24 <25`; that warning does not currently prevent the 004 proof slice from
typechecking or passing package tests in this environment.
