# Runner Protocol Contract

The runner protocol is an internal authenticated HTTP contract. Stable Runner identity is public-management data; its credential and heartbeat mechanics remain internal.

## Register

### `POST /api/runner/register`

Authorization uses the shared runner-registration secret documented by the existing Runner enrollment architecture. Anonymous registration is rejected.

```json
{
  "runnerName": "local-docker-1",
  "capabilities": {},
  "maxConcurrency": 2,
  "staleAfterSeconds": 60,
  "eligibleProjectIds": [],
  "eligibleRuntimeProviders": ["docker"]
}
```

**200/201**

```json
{
  "runner": {
    "id": "uuid",
    "name": "local-docker-1"
  },
  "credential": "opaque-secret",
  "heartbeatIntervalSeconds": 20
}
```

Re-registering the same name returns the same Runner ID and a newly rotated credential. The previous credential stops authenticating.

## Heartbeat

### `POST /api/runner/heartbeat`

Authorization uses the current opaque Runner credential.

```json
{
  "runnerId": "uuid",
  "activeSessionIds": ["uuid"]
}
```

The control plane validates that reported active Sessions are assigned to this Runner. It updates health/capacity projections but does not create a connection resource.

## Claim

### `POST /api/runner/sessions`

```json
{
  "runnerId": "uuid",
  "maxSessions": 1
}
```

**200** when work exists:

```json
{
  "session": {
    "id": "uuid",
    "taskId": "uuid",
    "title": "Implement selected issue",
    "objective": "...",
    "agent": "codex",
    "branch": "codex/issue-123",
    "resolvedRuntime": {},
    "taskContext": {
      "projectId": "uuid",
      "repository": {},
      "issue": {}
    }
  }
}
```

**204** when no eligible work exists. Capacity, eligibility, selection and assignment are one provider transaction. A database busy condition produces a retryable response rather than a second assignment.

## Inspect assigned Session

### `GET /api/runner/sessions/:sessionId`

Returns the same execution contract only when the authenticated Runner owns the active assignment. Otherwise return `SESSION_ASSIGNMENT_MISMATCH` or not found behavior that does not leak other work.

## Append internal execution facts

### `POST /api/runner/sessions/:sessionId/events`

```json
{
  "type": "agent.started",
  "severity": "info",
  "data": {}
}
```

The control plane assigns the timestamp, writes the internal Session fact, and
returns only `{ "accepted": true }`. It is not a public management event API and
does not expose an event object or stable event ID. Event types use execution or
Session language and contain no old business nouns.

## Complete

### `POST /api/runner/sessions/:sessionId/result`

```json
{
  "state": "waiting_for_review",
  "result": {
    "branch": "codex/issue-123",
    "commit": "sha",
    "tests": [],
    "preview": {},
    "review": {}
  }
}
```

Terminal state/result validation, Session update and final internal fact append occur atomically. Only the assigned Runner may complete an active Session. Duplicate identical completion is idempotent; contradictory completion returns `SESSION_COMPLETION_CONFLICT`.

## Stale Runner handling

- Runner health derives from `lastHeartbeatAt` and `staleAfterSeconds`.
- Stale processing touches only Sessions assigned to that Runner in active states.
- Queued siblings, terminal Sessions and other Tasks remain unchanged.
- No connection or lease resource is created.
