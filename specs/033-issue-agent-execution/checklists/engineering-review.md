# Engineering Review Checklist: Issue-driven Agent Execution

**Reviewed**: 2026-07-23
**Plan**: [../plan.md](../plan.md)
**Result**: CLEAR

## Scope

- [x] Full workflow abstraction removal remains required.
- [x] Historical development data may be deleted; no compatibility layer.
- [x] UI, plugin hooks, Linear write-back, GitLab and Castrel remain out of scope.
- [x] Existing Job/Run/provider contracts are reused instead of parallel execution state.

## Architecture

- [x] API is canonical and CLI is HTTP-only.
- [x] Linear external responses are validated at the integration boundary.
- [x] Dispatch refetches and freezes the exact Issue.
- [x] Duplicate dispatch has an indexed, stable conflict key.
- [x] Direct runner lifecycle has no provider-selected graph or node registry.
- [x] GitHub and Copilot tokens are scoped to individual execution phases.
- [x] Private repository clone has authenticated cold-clone fallback.
- [x] Review handoff requires two host-side preview probes.
- [x] `waiting_for_review` releases runner capacity and retains sandbox.

## Code Quality

- [x] Direct execution moves out of the runner entrypoint into one testable service.
- [x] The service is not a new workflow/provider extension point.
- [x] Castrel-specific preview mutation is removed from the active path.
- [x] Test and build produce separate structured results.
- [x] State and execution pipeline diagrams are planned near the implementation.

## Tests

- [x] Linear success and every external failure category are covered.
- [x] Dispatch atomicity, snapshot and conflict are covered.
- [x] Cancel/timeout/cleanup get regression tests.
- [x] Secret phase isolation is asserted.
- [x] Every direct execution phase failure is covered.
- [x] Host preview reachability and retained sandbox are covered.
- [x] CLI route mapping, transport failure and wait timeout are covered.
- [x] Real E2E is mandatory and evidence is redacted.

## Performance

- [x] Linear list uses bounded cursor pagination.
- [x] Dispatch conflict uses indexed lookup.
- [x] CLI wait uses bounded polling; no new server-side wait resource.

## Risk

- [x] GitNexus direct graph output recorded.
- [x] Independent blast-radius risk classified HIGH despite graph under-reporting imports.
- [x] No unresolved architecture, test, performance or silent-failure gap remains.
