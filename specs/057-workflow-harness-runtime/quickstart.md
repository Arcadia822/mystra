---
title: "Quickstart：固定 Task Workflow Runtime 验证"
taco_scope: plan
---

## Prerequisites

1. Node `24.14.0`、pnpm `10.25.0`。
2. Approved RDB + private Skill object storage。
3. Publish Team Skills named `repository-development-guide`、`idea-refine`、`incremental-implementation`、`code-review-and-quality`。
4. Online host Runtime/Runner，Project-bound Task，ready Workspace。

## Journey

### Enable

Owner/Admin enable with UUID command ID。Verify `understand`/v1。Replay same request returns same state；new enable while active does not reset Stage。

### Launch

Create Session and inspect frozen evidence：optional `workflow` component follows provider and precedes Agent Context/execution context；contains only fixed CLI guidance；contains no stage/action/skill/state identity/version。Runner applies exact projection before Provider start。

### Current and transitions

Inside provider cwd:

```bash
"$MYSTRA_AGENT_PATH" workflow current --json
"$MYSTRA_AGENT_PATH" workflow transition understanding-complete --expected-revision 1 --json
"$MYSTRA_AGENT_PATH" workflow transition implementation-complete --expected-revision 2 --json
"$MYSTRA_AGENT_PATH" workflow transition verification-failed --expected-revision 3 --json
"$MYSTRA_AGENT_PATH" workflow transition implementation-complete --expected-revision 4 --json
"$MYSTRA_AGENT_PATH" workflow transition verification-passed --expected-revision 5 --json
```

Each response returns full next context/exact Skills。`completed` has no Actions and does not mutate Task/Session/Issue/Workspace state。

### Concurrency/recovery

Send 20 requests against one version；one success maximum。Inject materialization failure after valid transition；Stage commits once，last complete manifest remains。Restore provider and run current；same generation converges without another transition。

### Disable/re-enable

Disable with expected version。Old Session immediately gets `capability_expired`；new Session has no Workflow prompt；other Skill sources remain。Re-enable creates new state at `understand`；old Session remains denied。

## Gates

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm gitnexus:doctor
```

Also run SQLite/PostgreSQL provider contracts、schema parity、runner filesystem、agent-cli、Session e2e and GitNexus `detect_changes` against `main`。A green unit subset is not completion evidence。

## Verification evidence — 2026-08-25

- `pnpm typecheck`: passed for all seven runnable workspace projects.
- `pnpm test`: passed after contract fixture reconciliation；shared 164、UI 41、agent adapters 9、spec prototype 41、agent CLI 11、Control Plane 490、Runner 36 tests，with PostgreSQL-gated cases excluded as described below.
- `pnpm lint`: passed for all seven runnable workspace projects.
- SQLite/provider/schema gate: `35 passed`；the full Control Plane run includes the fixed Workflow SQLite E2E and provider concurrency contract.
- PostgreSQL/Supabase-backed PostgreSQL live provider contract: **not executed** because `MYSTRA_TEST_POSTGRES_URL` is absent in this environment. The PostgreSQL Prisma schema/client generation and SQLite↔PostgreSQL schema parity checks passed；23 live PostgreSQL-gated cases were skipped. This remains partial evidence, not a claim of live PostgreSQL execution.
- Fixed journey: enable → atomic Session capability/prompt → claim → current → committed transition → injected projection failure → same-generation repair → verification loop → completed → disable → re-enable passed against SQLite.
- Filesystem/security: traversal、symlink、archive/file hash、cwd marker、atomic replacement、stale managed removal、unknown-directory retention、lease/execution scoping and object-key redaction tests passed.
- GitNexus: repository index and native dependency doctor passed；`detect_changes(scope=compare, base_ref=main)` reported 125 changed indexed symbols、23 affected processes、`critical` risk. The affected processes are the expected RDB、Session launch/claim、MCP and workload CLI paths；full contract/E2E gates cover them and no unrelated execution domain was identified.
- Spec-Kit analyze/status: 30 functional requirements map to the 47 implementation tasks；no placeholder、uncovered constitution MUST、generic Harness/Resource/plugin registry type、dynamic command registration、Workflow UI or generic list/replace/switch surface was found. Status reported all artifacts/checklists present；Taco refresh remains the final task.
