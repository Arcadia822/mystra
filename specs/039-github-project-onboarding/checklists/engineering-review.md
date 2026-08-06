# Engineering Review: 039 GitHub Project Onboarding

**Review date**：2026-08-05  
**Branch**：`039-github-project-onboarding`  
**Status**：CLEAR for task decomposition  
**Confidence**：高

## Step 0: Scope Challenge

The plan necessarily crosses shared contracts, SQLite, canonical API, UI and Runner. A UI-only Modal is a shortcut: repository discovery would still use one credential while delivery uses `MYSTRA_GITHUB_TOKEN`, precisely the failure the owner rejected.

Scope accepted as complete end-to-end work with one correction: repository selection now includes cursor Load more so installations with more than 100 repositories are not silently truncated.

## Architecture Review

1. **[P0 resolved] (confidence: 10/10) setup callback spoofing**：GitHub documents that `installation_id` is untrusted. Plan requires OAuth user token validation against `/user/installations` before persistence.
2. **[P1 resolved] (confidence: 9/10) secret in durable/long-lived Runner claim**：Plan keeps claims secret-free and adds a Runner-authenticated no-store exchange immediately before repository phases.
3. **[P1 resolved] (confidence: 9/10) reconnect silently retargets existing Projects**：Connection records are historical and Project references are stable; only the new-project default changes active status.
4. **[P1 resolved] (confidence: 9/10) first-page-only repository picker**：Plan adds cursor Load more and de-duplication; a later-page failure retains earlier pages.

No unresolved architecture decision remains.

## Code Quality Review

- Reuse `GitHubIntegrationProvider` validation/error mapping; do not create a second repository client.
- Isolate OAuth/JWT/token cache in one `github-app.ts` service; route handlers remain thin.
- Use one `SettingGroup`/`SettingRow` business component in Settings and Project Modal; no copied layout markup.
- Pass GitHub repository credential explicitly to Runner providers; do not mutate global `process.env`.
- Retain static credential injection only as a test seam; production registry must not read `MYSTRA_GITHUB_TOKEN`.
- Add inline ASCII lifecycle comment to `github-app.ts` only if implementation sequencing is not self-evident; do not scatter diagrams through simple route handlers.

No unresolved code-quality issue remains.

## Test Review

```text
CODE PATH COVERAGE PLAN
=======================
[+] github-app.ts
    ├── OAuth state + PKCE success                     [planned ★★★]
    ├── cancel/state/verifier/install mismatch         [planned ★★★]
    ├── JWT/sign/token mint/cache/single-flight        [planned ★★★]
    └── timeout/rate-limit/invalid response/redaction  [planned ★★★]

[+] SQLite + Project resolver
    ├── active/inactive/upsert/exact v3 rebuild        [planned ★★★]
    ├── connection/provider mismatch                   [planned ★★★]
    └── stale repository zero partial write            [planned ★★★]

[+] Runner exchange + providers
    ├── auth/session ownership/provider checks         [planned ★★★]
    ├── clone/push/review explicit credential          [planned ★★★]
    ├── expiry/revocation sanitized failure            [planned ★★★]
    └── PAT/env fallback absence regression            [planned ★★★]

USER FLOW COVERAGE PLAN
=======================
[+] Settings connect/reconnect                         [planned route + browser →E2E]
[+] Modal route unchanged/default source               [planned browser →E2E]
[+] disconnected/loading/empty/error/retry             [planned model + browser]
[+] page 1/load more/later-page failure/de-dup         [planned model + route]
[+] select/collapse/change/retain/double-submit        [planned model + browser]
[+] private repo create -> clone -> push -> PR          [planned real App →E2E]
[+] focus/Escape/backdrop/narrow layout                [planned browser]

──────────────────────────────────────────────────────
PLANNED COVERAGE: 22/22 branches and user flows
QUALITY TARGET: ★★★ behavior + edge + error paths
CRITICAL GAPS: 0
──────────────────────────────────────────────────────
```

Regression tests for removing `MYSTRA_GITHUB_TOKEN` and for keeping Add Project route-stable are mandatory, not optional.

## Performance Review

- Token creation is bounded by an in-memory expiry cache with 60-second margin and per-installation single-flight.
- Repository list uses existing 100-item provider pages and user-driven cursor loading; no unbounded eager fetch.
- Filtering is O(number of loaded repositories), appropriate for a human-operated single-node MVP.
- No polling is added; connection and repository state refresh only on open/retry/success.

No blocking performance issue remains.

## Failure Mode Audit

Every production failure in `plan.md` has a planned test, explicit handling and visible error. There are zero silent paths with neither test nor handling.

## What Already Exists

See `plan.md#what-already-exists`. The plan reuses RepoProvider, registry, server-side Project resolution, RdbProvider, Runner bearer/session ownership, askpass delivery and existing shell primitives.

## NOT in Scope

See `plan.md#not-in-scope`. No TODO is proposed: multi-Team connections, webhooks, GitHub Enterprise and server-side full-text search are already explicit product-boundary work, not forgotten cleanup.

## Parallelization

| Lane | Modules | Depends on |
|---|---|---|
| A | shared contracts + DB | — |
| B | GitHub App service + Integration provider | A contracts |
| C | API routes + Project resolver | A, B |
| D | Runner daemon + delivery provider | A, C credential contract |
| E | shell Settings + Project Modal | A, C management API |
| F | browser + real App E2E | C, D, E |

Lanes D and E can proceed in parallel only after C freezes the credential/management contracts. This task did not request subagents; a single worktree will execute sequentially to protect the heavily dirty UI branch.

## Completion Summary

- Step 0: scope accepted as complete; one pagination gap added.
- Architecture Review: 4 issues found, 4 resolved in plan.
- Code Quality Review: 0 unresolved issues.
- Test Review: diagram produced, 0 unresolved gaps.
- Performance Review: 0 unresolved issues.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 proposed.
- Failure modes: 0 critical gaps.
- Outside voice: skipped; user requested direct continuation and no subagent work.
- Parallelization: 6 dependency lanes, sequential execution selected for current dirty worktree.
- Lake Score: 4/4 recommendations use the complete option.
