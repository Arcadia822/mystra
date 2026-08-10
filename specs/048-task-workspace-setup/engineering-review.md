# Engineering Review: Task Workspace Setup

**Branch**: `048-task-workspace-setup`
**Review date**: 2026-08-10
**Status**: Implementation review passed; PostgreSQL runtime evidence blocked by missing test URL

## Step 0: Scope challenge

### Minimum complete slice

The smallest complete feature is not “add a path to Task”. It requires one coherent chain:

1. singular TaskWorkspace persistence and setup idempotency;
2. ordinary Project base-branch configuration, standard Git remote inspection and Issue branch policy;
3. Runtime capability advertisement plus outbound claim/report;
4. host Git/filesystem materialization with safe-root and secret handling;
5. canonical setup/read action and minimal Task status surface;
6. a ready Task Workspace attachment contract that 049 can consume.

Removing any one item leaves an unowned seam or a Workspace that cannot actually be executed. Conversely, push/PR, automatic rebuild/migration, cache policy and disk lifecycle are not required for this closure and remain excluded. Current 048/049/050 scope is Task-bound only; Project-only and standalone Sessions are deferred without a speculative second Workspace type.

## What already exists

| Need | Existing baseline | 048 addition |
|---|---|---|
| Project repository identity/config | 039/041 exact connection + external ID；040 `repositoryBaseBranch` | standard Git branch read and live base ref/commit decision; no new Setup repository input |
| Issue identity | 047 exact optional Issue reference | deterministic branch policy |
| Runtime identity/liveness | 044 host enrollment, Provider discovery, heartbeat | source-agnostic workspace materialization capability |
| Domain persistence | `RdbProvider` + Prisma SQLite/PG | TaskWorkspace/attempt methods and schemas |
| Runner transport | outbound register/report/heartbeat | outbound workspace claim/report loop |
| Task detail | existing `/tasks/[id]` | minimal status/action panel; 050 owns full launch/history UX |

The existing `projectSchema`/Prisma field and Project PATCH contract are reused. The existing scoped opaque cursor pattern in `project-issue-cursor.ts` is reused with a branch-specific payload rather than inventing unsigned ad hoc pagination. `RepoProvider.listRepositories/getRepository` remains unchanged; the new standard Git reader consumes the exact connection's existing credential/access seam.

### Scope reductions accepted

- One dedicated Task directory is sufficient; repository mirrors/caches remain Runtime-private optimization.
- No auto-rebuild or cross-Runtime migration for `unavailable` Workspace.
- No Session-level worktree, lock, merge or reset.
- No public path、clone URL or Setup-time branch override；Project Default branch remains an ordinary editable setting.
- No new queue service; RDB claim/lease is adequate for the self-hosted MVP.

## NOT in scope

- Provider-specific GitHub/GitLab branch REST adapters：standard Git protocol already supplies the required refs.
- Durable repository branch cache or branch snapshot：the list is configuration assistance；Workspace provenance freezes only the selected exact commit.
- Strongly consistent pagination across remote mutations：refresh restarts the picker；Setup independently resolves the saved branch.
- Repository push、PR/review delivery and Issue write-back：existing/later delivery boundaries own them.
- Automatic Workspace rebuild、migration、deletion、disk quota and garbage collection：they require separate lifecycle policy.
- Session-level clone/worktree isolation or automatic shared-write conflict resolution：owner selected shared-mutable semantics.

## Architecture review

### Verdict

The ownership split is coherent:

- Project configuration selects **what base branch**;
- standard Git repository reader lists remote branches and resolves **what exact commit**;
- Integration repository provider remains responsible only for repository discovery/identity and exact connection access;
- Issue provider decides **what branch name**;
- TaskWorkspaceService decides **whether/when setup is valid**;
- Runtime decides **how/where to materialize**;
- 049 creates a Task-bound Session and consumes **the ready Task Workspace attachment**.

This avoids three dangerous alternatives: provider adapters duplicating standard Git branch APIs, provider adapters writing host files, and runner code inventing business branch policy.

### Required invariants

1. `UNIQUE(taskId)` and transactional create/claim/report enforce `1 : 0..1`.
2. configured base branch、canonical base ref/commit and work-branch decision freeze before the first attempt and do not change on retry.
3. only active attempt sequence may transition Workspace state.
4. only `ready` has a consumable opaque ref.
5. Task Session runtime must equal Workspace runtime; no copy or fallback.
6. absolute paths and repository credentials never cross the trusted Runtime resolution boundary into operator views/events/RDB.
7. Task Sessions share mutable contents. The platform must not label this isolated or snapshot-based.
8. The attachment contract currently has one `task/shared-mutable` shape. Future Project-only or standalone preparation must reuse the same Workspace/attachment contract and is not designed by 048.

### Shared-mutable concurrency

Owner explicitly selected no Session isolation. Runtime execution policy therefore controls whether writes can overlap; 048 must not quietly add a Workspace mutex, invent a capacity number, or imply concurrent safety. Cross-feature tests must cover that allowed concurrent writers observe one shared directory and that conflicts remain visible rather than “resolved” by hidden copies.

### Runtime protocol

Outbound claim/report is consistent with feature 044. Attempt sequence is a fencing token, not merely telemetry. Lease expiry followed by retry must make late success a `409 stale_workspace_attempt` rather than a ready transition.

### Credential boundary

The plan correctly distinguishes hosted App tokens from self-hosted PATs. A PAT is not short-lived merely because it traveled briefly. Both standard Git branch reads and Runtime materialization must resolve exact connection credentials just in time, hold them only in memory, disable interactive Git prompts, redact process errors, and never return or persist credential-bearing remotes/config.

## Code-quality review

### Impact evidence

Fresh implementation-baseline index（2026-08-10，7,720 nodes / 13,281 edges / 300 flows）：

- `RdbProvider`: **CRITICAL**，94 affected / 24 direct / 38 execution flows。Required action: additive domain methods, both database contract suites, all mocks/fixtures updated in the same compiling slice, and no Prisma/dialect leakage.
- `RepoProvider`: **MEDIUM**, 19 affected symbols / 6 direct. Disposition: keep its list/get contract unchanged; do not pay this blast radius for standard Git operations.
- `IssueProvider`: **MEDIUM**，24 affected / 7 direct / 0 indexed execution flows；GitHub、Linear、registry 与 issue-scope consumers 必须同步。
- `PrismaRdbProvider.registerHostRuntime`: **LOW**，3 affected / 1 direct / 1 contract flow。
- `buildHostRuntimeRegistrationPayload`: **LOW**，0 indexed upstream dependents；runner registration tests remain the authoritative guard。
- `ProjectDetail`: **LOW**，1 direct consumer；Task page symbol未被图谱独立命名，编辑前按实际 symbol 再查。
- current GitNexus flows contain no existing Task Workspace materialization to preserve.

No code symbol may be edited until the corresponding fresh impact check is run on the implementation baseline. HIGH/CRITICAL changes must be reported before editing, per repository rules.

### Interface design

- Required `IssueProvider` branch-policy methods are preferable to optional feature-detection shims because the repository is pre-0.1.
- `RepoProvider` receives no branch methods. `GitRemoteRepositoryReader` is a separate provider-neutral platform port with typed inspect/resolve inputs and outputs.
- `GitRemoteRepositoryReader.inspectBranches` returns one bounded advertisement；the Project branch service owns stable sorting、query filtering and scoped cursor pagination. This keeps Git protocol concerns out of API pagination and avoids two remote round trips for `HEAD` plus branches.
- Public DTOs must use shared strict Zod schemas and stable error enums.
- Git remote access context and `RepositoryWorkspaceDecision.transport` are transient；do not reuse `RepositorySnapshot` as an execution intent or expose credential-bearing URLs.
- Workspace preparation attempt remains operational data, not a public top-level business object.
- Do not add `workspacePath` to Task or Session.

### Host filesystem/Git implementation

- derive all directory names from validated UUIDs under one configured root;
- use `spawn`/argv, not a shell command string;
- create in a sibling temp directory and publish atomically on the same filesystem;
- reject symlink/path traversal and unknown pre-existing targets;
- verify exact commit and branch before success;
- cleanup is allowed only for the exact attempt temp directory after descendant validation.

## Test review

### Coverage diagram

```text
CODE PATH COVERAGE PLAN
=======================
[+] Project Default branch read API
    ├── Project/team/RBAC lookup
    ├── exact connection + repository live resolve
    ├── transient GitRemoteAccess resolve
    ├── inspectBranches (HEAD + refs/heads/* in one advertisement)
    │   ├── normal / empty-unborn repository
    │   ├── auth / timeout / malformed output
    │   └── >10,000 refs / >8 MiB output
    ├── stable sort + query + first(1..100) + scoped cursor
    └── success page OR repository_branches_unavailable

[+] Project Default branch edit
    ├── picker success -> selected branch text
    ├── picker failure -> visible error + ordinary text input
    └── PATCH syntax-valid config; no Provider state mutation

[+] Task Setup Workspace
    ├── resolve configured refs/heads/<branch> with --exit-code
    │   ├── exact commit -> freeze intent
    │   └── status 2/auth/transport -> fail closed, no HEAD fallback
    ├── Issue branch decision OR no-Issue deterministic fallback
    ├── unique Workspace + fenced preparation attempt
    ├── runner clone/verify/branch/atomic publish
    └── ready opaque ref OR stable failed state

USER FLOW COVERAGE PLAN
=======================
[→E2E] Private repo -> read branches -> choose non-HEAD branch -> Setup -> ready
[→E2E] Branch read unavailable -> save text branch -> Setup resolves successfully
[→E2E] Saved branch deleted -> Setup fails, never switches to HEAD/default
[→049] Three Task Sessions resolve the same ready Task Workspace attachment and observe shared mutations
[DEFERRED] Project-only and standalone Session preparation; no parallel Workspace type exists
```

### Required layers

| Layer | Critical cases |
|---|---|
| Shared schemas | strict payloads, state/ref invariants, stable errors, branch limits |
| Standard Git reader | exact connection/repo, symbolic `HEAD`, branch list pagination/filter, exact base commit, list failure text-config degradation, Setup failure no branch fallback |
| Provider policies | RepoProvider list/get regression, GitHub/Linear Issue naming, Issue failure no fallback |
| RDB contracts | unique Task relation, 20x setup race, attempt fencing, SQLite/PG parity |
| Service/API | Team/RBAC, no Project, capability/offline, replay/retry/conflict, secret/path omission |
| Runner unit | safe root, argv injection, timeout, redaction, stale attempt, collision |
| Runner Git integration | clone/checkout exact commit, branch creation, partial failure, atomic publish |
| Cross-feature 049 | Task-bound only; repeated resolution preserves `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable` and fails closed for missing/non-ready/offline/mismatch |
| UI/browser | absent/preparing/ready/failed/unavailable, locked Runtime, shared-mutability warning |

PostgreSQL absence is a blocked verification item, not a SQLite-derived pass. A listening port or static page is not runtime evidence.

## Performance review

- Setup API remains asynchronous; no clone/fetch inside the human request.
- Claim query needs `(runtimeId/state/createdAt)` or equivalent bounded index and atomic selection.
- Repository cloning dominates latency and bytes; record duration/bytes/failure code without secret/path logging.
- Project branch reads use one remote advertisement, a 30-second timeout, 10,000-ref cap and 8 MiB stdout cap. API pages are 1..100/default 50, sorted by canonical ref and scoped to Project/connection/repository/query in the cursor.
- The plan deliberately omits shared cache. Add it only after measuring repeated clone cost; it would introduce locking, eviction and credential hygiene.
- Task status polling should back off in terminal states and does not justify SSE/WebSocket in this MVP.

## Failure-mode review

| Failure | Test | Handling | User-visible |
|---|---|---|---|
| repository/Issue policy fails | required | no Runtime claim；stable failed state | stable setup error |
| branch advertisement auth/timeout/malformed/oversized | required | abort child process；redact；no fake empty page | `repository_branches_unavailable` + text input |
| empty/unborn repository | required | valid empty page、`head=null` | empty state + text input |
| cursor scope/query mismatch | required | reject before Git call | stable invalid cursor error |
| configured base branch missing during Setup | required | exact resolve status 2；no Runtime claim or fallback | `repository_unavailable` with safe detail |
| branch invalid | required | reject before child process/runner | `branch_invalid` |
| runner lease expires | required | next attempt may claim；old report fenced | retryable failed/preparing state |
| clone succeeds but publish fails | required | failed；temp cleaned safely；no ready ref | `materialization_failed` |
| ready directory later missing | required | mark unavailable；Session fail closed | Workspace unavailable |
| Runtime offline | required | no new claim/Session；no automatic migration | Runtime unavailable |
| concurrent Session writes | required | visible shared state/conflict；no hidden clone | shared-mutable warning/result |
| secret appears in stderr | required | redact before event/log/persistence | safe generic error |

Critical silent gaps：0。

## Dependency and delivery order

```text
048 Task Workspace Setup
  -> 049 Session Launch Framework
       -> 050 Task Session Experience
```

- 048 lands standard Git/Issue policy, persistence, Runtime and setup/read contracts while keeping Integration RepoProvider branch-neutral.
- 049 lands canonical Task-bound Session creation and persists the ready Task Workspace attachment.
- 050 lands the complete human Task Workspace + launch/history experience.

Project-only and standalone Sessions are deferred. Neither 049 nor 050 may invent an alternate Workspace or clone path while waiting for a future preparation policy. That sort of convenience is how parallel contracts become permanent archaeological layers.

## Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Shared contracts | `packages/shared` | — |
| Standard Git read + Project branch API | `apps/control-plane/src/lib/git`、Project API | Shared contracts |
| Workspace persistence/service | DB、task-workspaces、Workspace API | Shared contracts |
| Issue branch policy | integrations | Shared contracts |
| Runtime materialization | runner daemon、runner routes | Shared contracts |
| Task/Project UI + 049/050 contract checks | control-plane UI、cross-feature specs/tests | Prior lanes merged |

- Lane A：Shared contracts first。
- Lanes B/C/D：standard Git/API、Workspace persistence/service、Issue policy + Runtime materialization may proceed in separate worktrees after A；Issue and Runtime can be split if desired。
- Lane E：UI and cross-feature acceptance after B/C/D merge。
- Conflict flag：B and C both touch control-plane route test infrastructure；keep route files separate and integrate their shared fixtures once, not by parallel copy-paste。

## Required gates before `/speckit.tasks`

- [x] Product choices Q1-Q3 reflected in spec and plan.
- [x] Project config、Integration RepoProvider、standard Git reader、Issue、Runtime/RDB ownership and attempt fencing documented.
- [x] Cross-feature sequence and attachment semantics documented.
- [x] GitNexus baseline impact recorded.
- [x] Refresh the independent UI prototype for Workspace states, locked Runtime and shared-mutable warning; verify the implementation in a real browser.
- [x] Owner confirms the exclusion of automatic rebuild/migration/deletion for ready/unavailable Workspace.
- [x] Owner scope correction freezes the 049/050 consumer as Task-bound only; the shared/control-plane focused suite and typecheck pass at the dependency checkpoint.

## Final verdict

**Architecture: pass. Data flow: pass. Testability: pass. Performance: pass for MVP.**

The implementation and completion audit pass for all locally executable gates. PostgreSQL runtime contract execution remains explicitly blocked because `MYSTRA_TEST_POSTGRES_URL` is absent; SQLite contracts plus SQLite/PostgreSQL schema parity and Prisma validation pass, but are not reported as a substitute. Confidence: **high** for architecture, ordering, credential handling, Task-bound attachment, and host Git/filesystem behavior.

## Implementation review findings

- Next.js/Turbopack required extensionless local imports in the new control-plane modules; production build now validates this boundary.
- Client components must import the browser-safe `@mystra/shared/task-workspace` subpath instead of the Node-bearing shared package root.
- A lost success report after atomic publish must recover only a Mystra-owned target whose marker, exact commit, and branch match frozen intent; mismatched or unknown targets still fail closed.
- `resolveSessionAttachment` rechecks that the ready Workspace Runtime remains online and advertises materialization capability before returning the opaque ref.
- Lease expiration updates Workspace and attempt atomically and checks both affected row counts before accepting the transition.
- The ready resolver originally required current `HEAD` to equal the frozen base commit. That would reject a healthy shared-mutable Workspace after a Session commit. It now requires the frozen base to remain an ancestor of current `HEAD`; lost-report publish recovery separately retains exact-commit matching.

## Task-only 049 dependency checkpoint

On 2026-08-10, `sessionWorkspaceAttachmentSchema` was directly replaced with one strict `kind: "task"` shape. Focused shared/control-plane tests and both package typechecks passed. The checkpoint contains no second union branch, compatibility alias, fallback, or guessed future fields. 049 may rebase/stack on this contract before the remaining 048 completion audit finishes.

## Completion evidence

- shared: 18 files / 171 tests passed.
- control-plane: 65 files passed、1 skipped；306 tests passed、17 skipped.
- runner-daemon: 5 files / 19 tests passed, including lost-report recovery and post-Session commit ancestry resolution.
- root typecheck、lint、control-plane production build、SQLite/PostgreSQL Prisma schema validation: passed.
- real HTTPS Git + SQLite + runner closure: symbolic `HEAD=main`, branches `main` and `release/0.1`, exact base commit frozen, working branch materialized, opaque ref returned, public secret/path leak false. A later commit advanced `HEAD` and remained resolvable as shared-mutable.
- real control-plane browser: branch-read failure visibly degraded to editable text config, `release/0.1` saved, ready Task Workspace facts and locked Runtime rendered, 320px had no horizontal overflow, and a clean tab had no console warnings/errors.
- PostgreSQL runtime contract: blocked because `MYSTRA_TEST_POSTGRES_URL` is absent. No SQLite-derived pass is claimed.
- GitNexus fresh index: 8,147 nodes / 14,305 edges / 300 flows. `detect_changes` reported low risk for symbols it mapped, but mapped only tracked documentation because the feature files are untracked; this limitation is recorded rather than presented as full blast-radius proof. Pre-edit impact evidence remains authoritative for the CRITICAL `RdbProvider` and MEDIUM `IssueProvider` surfaces.

## Spec-Kit completion analysis

The final read-only consistency pass counted 34 functional requirements and 58 tasks. Every requirement maps to at least one contract/test/implementation/verification task; unmapped tasks: 0; placeholders: 0; duplicate requirements: 0; ambiguity findings: 0; constitution conflicts: 0; critical findings: 0. During the pass, stale capability naming, component paths, attachment type naming, unverifiable latency numbers, and the 048-owned SC-002 boundary were corrected before this final zero-finding result.

Current consumer audit:

- 049 requires `taskId`, consumes exactly `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable`, persists `session.workspace_attached`, and rejects missing Task launch.
- 050 only exposes Task-bound launch, reads ready 048 Workspace, and locks the Workspace Runtime.
- Both explicitly defer Project-only and standalone Session modes and require any future preparation policy to reuse the same Workspace/attachment contract.

## Review completion

- Step 0: Scope Challenge — scope accepted as-is；although the complete feature spans more than eight files, removing branch read、persistence、Runtime materialization or attachment leaves a non-executable seam.
- Architecture Review: 1 issue found and resolved，standard Git operations removed from RepoProvider.
- Code Quality Review: 1 issue found and resolved，Git ref advertisement separated from API pagination.
- Test Review: diagram produced；0 unresolved implementation gaps，1 external PostgreSQL runtime-evidence blocker recorded.
- Performance Review: 1 issue found and resolved，30s/10,000 refs/8 MiB/100-item page bounds fixed.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 items；no durable deferred work beyond explicit feature exclusions.
- Failure modes: 1 shared-mutable HEAD regression found and fixed；0 remaining critical gaps.
- Outside voice: skipped；current correction came directly from owner and no independent agent was requested.
- Parallelization: 5 dependency stages，3 post-contract lanes may run in parallel，final UI/cross-feature stage sequential.
- Lake Score: 3/3 complete options selected.
