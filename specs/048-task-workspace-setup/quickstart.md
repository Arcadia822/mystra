# Quickstart: Task Workspace Setup verification

本文件记录 048 的可重复验证路径与 2026-08-10 实际证据。所有命令在 Node `24.14.0` 与 pnpm `10.25.0` 下运行。

## 1. Static and contract gates

```sh
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/shared test
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/control-plane test
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/runner-daemon test
fnm exec --using=24.14.0 corepack pnpm typecheck
fnm exec --using=24.14.0 corepack pnpm lint
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/control-plane build
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/control-plane db:validate
```

实际结果：

- shared：18 files / 171 tests passed；task-only attachment schema regression included。
- control-plane：65 files passed、1 skipped；306 tests passed、17 skipped。
- runner-daemon：5 files / 19 tests passed。
- root typecheck、lint、control-plane production build、SQLite/PostgreSQL Prisma schema validation passed。
- SQLite `RdbProvider` contract suite passed。环境未配置 `MYSTRA_TEST_POSTGRES_URL`，因此 PostgreSQL runtime contract execution 保持 blocked；schema parity/validation 不能冒充真实数据库执行。

Owner boundary reconciliation 后再次验证：shared 18 files / 171 tests、control-plane 65 files passed + 1 skipped / 306 tests passed + 17 skipped、runner-daemon 5 files / 19 tests，以及 shared/control-plane/runner package typecheck 全部通过。本地 generated Prisma client 起初落后于已提交 schema，执行 `pnpm --filter @mystra/control-plane db:generate` 后恢复；generated output 未形成 tracked source change。

## 2. Task-only 049 dependency checkpoint

`SessionWorkspaceAttachment` 当前只接受：

```text
kind=task
taskWorkspaceId
runtimeId
workspaceRef
sharingMode=shared-mutable
```

`resolveSessionAttachment` 只接受 Task ID，只读取 ready Workspace，且保持相同的 `taskWorkspaceId/runtimeId/workspaceRef/shared-mutable`。missing、non-ready、Runtime offline、capability missing 或 Runtime mismatch 全部 fail closed。Project-only 与 standalone Session 整体 deferred；当前没有第二个 union branch、alias、fallback 或猜测字段。

048 不创建或持久化 Session、initial turn、Provider execution 或 launch state，也不返回 `turnId`。Workspace preparation claim/lease 只用于 materialization fencing/retry，不是 Session Runtime capacity、slot 或 execution occupancy。049 负责原子 launch transaction：创建 Session、解析全部输入、拼接 system prompt 与第一条 user message，再发起选定 Provider。

Checkpoint 命令：

```sh
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/shared test -- task-workspace.test.ts
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/control-plane test -- \
  src/lib/task-workspaces/task-workspace-service.test.ts \
  app/api/task-workspace-routes.test.ts
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/shared typecheck
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/control-plane typecheck
```

上述 checkpoint 已通过，可供 049 rebase/stack；它不依赖 T052–T058 全部关闭。

## 3. Standard Git and Runtime materialization

真实 HTTPS dumb-Git fixture 完成 branch read → Setup → claim → materialize → report：

```text
status ready
symbolicHead main
branches main, release/0.1
exactCommit 357d20e830cef0822bde739a6d06f45e30ccdaa8
currentCommit da4c9d36638560b940fe4b20f4662c1db5864934
workingBranch mystra/task-487ee0e9-51c
workspaceRef host-task-workspace:9565c8c9-a723-4810-b9d2-69567ff85c15
sharedMutationAccepted true
publicSecretLeak false
publicPathLeak false
```

复现命令：

```sh
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/runner-daemon exec tsx \
  ../../scripts/testing/verify-task-workspace-real.ts
```

验证点包括 configured non-HEAD base branch、exact base commit、provider-owned working branch、safe-root atomic publish、opaque ref，以及 trusted/public projection 中不泄露 credential 或 absolute path。fixture 随后在工作分支新增 commit；resolver 保留 base ancestry 并接受前进后的 current commit，证明 shared-mutable Workspace 不会因正常 Session 提交而被误判 missing。

## 4. Browser verification

在真实 control-plane 与新建 SQLite fixture 上完成：

- Project branch read 因测试 connection 无 credential 明确失败，UI 显示错误并退化为普通文本配置；`release/0.1` 保存成功。
- Task detail 显示 ready Workspace、locked Runtime、configured base、exact commit、working branch 与 `shared-mutable`；ready 状态下 Setup disabled。
- 320px viewport 的页面 `clientWidth/scrollWidth` 为 `309/309`，无横向溢出。
- 全新浏览器标签页 console 无 error/warning。

Fixture 命令：

```sh
fixture_dir=$(mktemp -d /tmp/mystra-048-browser.XXXXXX)
export MYSTRA_DB_PATH="$fixture_dir/mystra.db"
fnm exec --using=24.14.0 corepack pnpm db:migrate:deploy
fnm exec --using=24.14.0 corepack pnpm --filter @mystra/runner-daemon exec tsx \
  ../../scripts/testing/seed-task-workspace-ui.ts
```

## 5. Failure matrix

| Injection | Expected |
|---|---|
| Task without Project | `task_project_required`, no Workspace |
| disabled/wrong repository connection | `repository_unavailable`, no Runtime claim |
| branch list/read unavailable | `repository_branches_unavailable`, text setting remains available |
| configured branch missing during Setup | `repository_unavailable`, no remote `HEAD` fallback |
| Issue missing/provider down | `issue_branch_unavailable`, no fallback |
| invalid branch candidate | `branch_invalid`, no Runtime claim |
| Runtime offline/no capability | stable eligibility error；attachment fail closed |
| Git clone/checkout failure | Workspace `failed`, no ready ref |
| stale attempt reports success | `409 stale_workspace_attempt`, state unchanged |
| success report lost after atomic publish | retry reuses only exact marker/commit/branch match |
| ready directory deleted | Workspace `unavailable`, attachment fail closed |
| branch collision with unknown owner | `materialization_failed`, no overwrite |

## 6. Completion audit

```sh
fnm exec --using=24.14.0 corepack pnpm dlx gitnexus analyze --force
fnm exec --using=24.14.0 corepack pnpm dlx gitnexus status
git diff --check
```

最终运行 Spec-Kit status、GitNexus change detection、scoped `git diff --check` 与 targeted consistency search。048 与已落入本地 `main` 的 049/050 spec、实现、测试及 5xP/constitution 一致表达：当前仅 Task-bound Session，单一 Workspace/attachment contract，未来 deferred modes 只允许更换准备逻辑。本次 GitNexus MCP reader 因 database storage version 42 / reader version 40 不兼容而失败，影响结论记为 unknown；targeted source/reference + diff audit 作为降级证据，没有把旧统计数字冒充当前结果。
