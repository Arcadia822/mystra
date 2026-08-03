# HTTP API Contract

All management responses use shared Zod schemas from `@mystra/shared`. Error responses use `{ error: { code, message, details? } }`. This is a breaking contract; there are no aliases or redirects.

## Task resources

### `POST /api/tasks`

Creates a Task with zero Sessions.

```json
{
  "projectId": "uuid",
  "source": "api",
  "objective": "Investigate and improve repository onboarding",
  "metadata": {}
}
```

The server resolves Project and copies its immutable Repository snapshot. Callers cannot send a repository path or clone URL.

**201**

```json
{
  "task": {
    "id": "uuid",
    "projectId": "uuid",
    "source": "api",
    "objective": "Investigate and improve repository onboarding",
    "repository": {},
    "metadata": {},
    "createdAt": "date-time",
    "updatedAt": "date-time"
  }
}
```

Errors: `PROJECT_NOT_FOUND`, `PROJECT_ARCHIVED`, `INVALID_TASK`.

### `GET /api/tasks`

Returns `{ tasks: TaskListItem[] }`. Each item may include `sessionCount`, `activeSessionCount` and `latestSession`; it never includes a Task lifecycle state.

### `GET /api/tasks/:taskId`

Returns `{ task, sessionSummary }`. `sessionSummary` is a management projection, not aggregated Task state.

Errors: `TASK_NOT_FOUND`.

## Session resources

### `POST /api/tasks/:taskId/sessions`

Creates one explicit child Session.

```json
{
  "title": "Verify the proposed migration",
  "objective": "Run contract and end-to-end verification",
  "agent": "codex",
  "branch": "codex/verify-task-session",
  "runtimeOverride": {}
}
```

The request does not accept `projectId` or `repository`. Agent and branch may be defaulted by canonical server-side rules, but the stored Session contains resolved explicit values.

**201**: `{ "session": Session }`

Errors: `TASK_NOT_FOUND`, `INVALID_SESSION`, `SESSION_BRANCH_CONFLICT`, `RUNTIME_POLICY_VIOLATION`.

### `GET /api/tasks/:taskId/sessions`

Returns `{ taskId, sessions: Session[] }` ordered by creation time with deterministic ID tiebreaker.

Errors: `TASK_NOT_FOUND`.

### `GET /api/sessions/:sessionId`

Returns `{ session, task, project? }`. It does not return internal event rows.

Errors: `SESSION_NOT_FOUND`.

### `POST /api/sessions/:sessionId/cancel`

Requests cancellation for a non-terminal Session.

```json
{
  "reason": "No longer needed",
  "requestedBy": "operator"
}
```

**200**: `{ "outcome": "canceled" | "cancellation_requested", "session": Session }`

Errors: `SESSION_NOT_FOUND`, `SESSION_CANCEL_CONFLICT`.

### `GET /api/sessions/:sessionId/summary`

Returns a compact coordination projection with Session state, timestamps, result/failure availability and review references. It does not return a public event collection or timeline.

Errors: `SESSION_NOT_FOUND`.

## Runner resources

### `GET /api/runners`

Returns `{ runners: Runner[] }` with stable ID/name, capabilities, capacity, eligibility, health, `activeSessionCount` and current Task/Session references.

### `GET /api/runners/:runnerId`

Returns `{ runner: Runner }`.

Errors: `RUNNER_NOT_FOUND`.

Runner management responses never include token, credential hash, internal lease or connection objects.

## Integration dispatch

### `POST /api/integrations/:integration/issues/:identifier/dispatch`

Resolves the Issue and Project repository, then atomically creates or reuses a Task and its initial Session.

```json
{
  "projectId": "uuid",
  "agent": "codex",
  "branch": "codex/linear-abc-123",
  "sessionObjective": "Implement the selected issue"
}
```

**200/201**

```json
{
  "task": {},
  "session": {},
  "created": true
}
```

Identical repeated dispatch returns the same IDs with `created: false`. A reused dispatch key with contradictory immutable identity returns `DISPATCH_CONFLICT`.

## Removed surfaces

- Old management resource routes are absent.
- Old runner claim/result routes are absent.
- Cancellation belongs to Session, never Task.
- There is no public `/events` management route in this feature.
