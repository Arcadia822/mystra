# Contract: Runtime Workspace Protocol

## Capability advertisement

Host registration/provider report advertises a source-agnostic Runtime capability:

```json
{
  "workspaceMaterialization": {
    "version": 1,
    "kinds": ["task-repository"],
    "sharingModes": ["shared-mutable"]
  }
}
```

This is distinct from Agent CLI Provider capabilities. Runtime owns both sets of advertised capabilities without treating workspace as an Agent Provider.

## Claim

### `POST /api/runner/workspaces/claim`

Authenticated by existing runner identity. Request includes `runnerId` and bounded long-poll preference. Response is `204` or one attempt:

```json
{
  "workspaceId": "uuid",
  "attemptId": "uuid",
  "attemptSequence": 1,
  "leaseExpiresAt": "date-time",
  "workspaceRef": "host-task-workspace:uuid",
  "repository": {
    "provider": "github",
    "connectionId": "uuid",
    "repositoryExternalId": "provider-id",
    "baseRef": "refs/heads/main",
    "baseCommit": "sha",
    "transport": { "kind": "https", "endpoint": "https://host/path.git" }
  },
  "branch": {
    "name": "mystra/linear-eng-123-short-title",
    "strategy": "linear-issue-v1"
  },
  "credential": {
    "kind": "http-basic-token",
    "secret": "transient-value"
  }
}
```

Security rules:

- claim only returns attempts for Runtime bound to that `runnerId`。
- credential exists only in transport response memory；never persist or log full payload。
- endpoint must be provider-produced and validated；runner rejects non-HTTPS/network policies outside connection contract。
- `workspaceRef` is UUID-derived opaque identity；runner independently maps it under configured safe root。
- claim/lease only fences Workspace materialization and retry. It is not a Session claim, Runtime slot, capacity counter or execution-occupancy record。

## Materialization

Host implementation algorithm:

1. Resolve configured task workspace root; never accept root/path from claim。
2. Derive final and temp names from validated UUIDs; assert both remain descendants of root。
3. Spawn Git with argv, disabled interactive credential prompts, bounded timeout and redacted environment。
4. Clone/fetch into temp directory, verify exact `baseCommit`, create branch from that commit。
5. If final target/branch cannot be safely proven as same Workspace attempt, fail closed。
6. Atomically rename/publish temp directory to final target where platform permits；otherwise use a validated same-filesystem publish sequence with cleanup tests。
7. Resolve final local path behind opaque `workspaceRef`；never return path to operator API。

Attachment resolution rechecks the marker, Git repository and configured
working branch. The frozen base commit must remain an ancestor of current
`HEAD`; equality is required only while recovering an atomic publish whose
success report was lost. Normal Task Session commits are allowed to advance
`HEAD` without making a shared-mutable Workspace unavailable.

Optional mirrors/caches are implementation-private and cannot change visible provenance or Task isolation.

## Report

### `POST /api/runner/workspaces/{workspaceId}/attempts/{attemptId}`

Success:

```json
{
  "runnerId": "uuid",
  "attemptSequence": 1,
  "status": "succeeded",
  "workspaceRef": "host-task-workspace:uuid",
  "observed": {
    "baseCommit": "sha",
    "branchName": "mystra/linear-eng-123-short-title"
  }
}
```

Failure:

```json
{
  "runnerId": "uuid",
  "attemptSequence": 1,
  "status": "failed",
  "failure": {
    "code": "materialization_failed",
    "message": "redacted operator-safe detail"
  }
}
```

- current active attempt + matching runner can mutate state。
- stale/expired/foreign reports return `409 stale_workspace_attempt`。
- success requires observed commit/branch exact match before transaction marks ready。
- report never echoes credential, endpoint or absolute path。

## Missing detection

Before a consumer enters a Task `workspaceRef`, runner verifies the mapped directory/repository/branch exists. Missing result reports `workspace_missing`; control plane marks TaskWorkspace `unavailable`, after which attachment resolution fails closed. MVP performs no automatic rebuild or Runtime migration. Session creation and Provider launch remain feature 049 responsibilities.
