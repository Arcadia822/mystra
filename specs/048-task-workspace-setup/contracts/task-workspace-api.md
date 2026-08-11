# Contract: Task Workspace API

## Operator routes

### `POST /api/tasks/{taskId}/workspace`

Creates or retries the singular Task Workspace setup intent.

```json
{
  "runtimeId": "uuid",
  "idempotencyKey": "opaque-client-key"
}
```

Rules:

- authenticated Team member；write permission follows Task mutation policy。
- Task、Project、Runtime 必须同 Team。
- 不接受 clone URL、path、base ref、commit 或 branch。
- first valid request: `202` with queued Workspace。
- same frozen intent: `200` or `202` with same Workspace identity/state。
- ready Workspace with different Runtime/intent: `409 workspace_already_prepared`。
- Task no Project: `409 task_project_required`。

Response shape:

```json
{
  "workspace": {
    "id": "uuid",
    "taskId": "uuid",
    "projectId": "uuid",
    "runtimeId": "uuid",
    "state": "queued",
    "sharingMode": "shared-mutable",
    "configuredBaseBranch": "main",
    "baseRef": "refs/heads/main",
    "baseCommit": "sha",
    "branchName": "mystra/linear-eng-123-short-title",
    "failure": null,
    "createdAt": "date-time",
    "updatedAt": "date-time",
    "readyAt": null
  }
}
```

`workspaceRef` 仅供受信 049 Session service/runner contract；普通 Task response 不需要暴露它，更不返回 absolute path。

### `GET /api/tasks/{taskId}/workspace`

- `200` singular Workspace view。
- `404 task_workspace_not_found` when Task exists but setup never ran。
- Team scope mismatch returns existing fail-closed not-found/forbidden policy；不得泄漏 cross-Team existence。

## Service contract

```ts
interface TaskWorkspaceService {
  setup(input: {
    actor: TeamActor;
    taskId: string;
    runtimeId: string;
    idempotencyKey: string;
  }): Promise<TaskWorkspaceSetupResult>;

  get(input: {
    actor: TeamActor;
    taskId: string;
  }): Promise<TaskWorkspaceView | undefined>;

  resolveSessionAttachment(input: {
    teamId: string;
    taskId: string;
    requestedRuntimeId: string;
  }): Promise<SessionWorkspaceAttachment>;
}
```

`resolveSessionAttachment` 只接受 Task identity，只读取 ready Workspace，不重新运行 repository/Issue policy。它返回 attachment，但不创建或持久化 Session、turn、Provider execution 或 launch state。requested Runtime 不匹配、Workspace missing/non-ready、Runtime offline 或 capability missing 均 fail closed。

## Stable failure codes

- `task_project_required`
- `repository_unavailable`
- `repository_branches_unavailable`（Project branch read API；不用于把 Setup 降级到其他 branch）
- `issue_branch_unavailable`
- `branch_invalid`
- `runtime_unavailable`
- `workspace_capability_unavailable`
- `workspace_already_prepared`
- `workspace_not_ready`
- `workspace_missing`
- `workspace_runtime_mismatch`
- `materialization_failed`
- `stale_workspace_attempt`
