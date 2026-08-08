# Data Model: Task Context Container

## Task

Team-owned durable Agent work container.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | UUID | Stable server-generated identity |
| `teamId` | UUID | Required; authenticated active Team; immutable |
| `title` | string | Trimmed, 1..500 characters; mutable |
| `description` | string or null | 0..100,000 characters; mutable; Mystra-owned text |
| `projectId` | UUID or null | Optional context reference; same Team active Project at create; immutable |
| `idempotencyKey` | UUID or null | Internal manual-create key; unique with Team; never exposed as content |
| `issueProvider` | `github` / `linear` or null | All-or-none Issue fingerprint; immutable |
| `issueConnectionId` | UUID or null | Exact IntegrationConnection at create; immutable |
| `issueScopeExternalId` | string or null | GitHub repository external ID or Linear Team external ID; immutable |
| `issueExternalId` | string or null | Provider-stable Issue identity; immutable |
| `issueIdentifier` | string or null | Provider lookup/display identifier captured as reference; not uniqueness key |
| `createdAt` | datetime | Server-generated |
| `updatedAt` | datetime | Changes only when Task-owned mutable content changes |

### Invariants

1. `teamId` is always present; no public request accepts it.
2. `projectId` is nullable and never implies ownership.
3. Manual Task: all Issue fields null; `projectId` may be null or set.
4. Issue-derived Task: `projectId` and all Issue fields present.
5. Partial Issue fingerprints are invalid at schema and SQL levels.
6. `{teamId, idempotencyKey}` is unique when the key is non-null.
7. `{issueProvider, issueConnectionId, issueScopeExternalId, issueExternalId}` is unique when the fingerprint exists.
8. Only `title`, `description`, and `updatedAt` may change after create.
9. No external Issue body/status/priority/assignee/labels/cycle/milestone/comment is persisted.
10. No Session/Runtime/Provider/Agent/Context selection is persisted on Task.

## Public Task Issue Reference

Projection of the persisted fingerprint returned with a Task:

```ts
type TaskIssueReference = {
  provider: "github" | "linear";
  connectionId: string;
  scopeExternalId: string;
  externalId: string;
  identifier: string;
};
```

The reference is ordinary data. `identifier` may become stale; `externalId` plus the exact connection/scope fingerprint determines identity.

## Live Issue Resolution

Transient Task-detail value, never persisted:

```ts
type TaskIssueResolution =
  | { status: "available"; title: string; identifier: string; url: string }
  | { status: "unavailable" };
```

Resolution first verifies that the Task's stored connection/scope still equals the Project's current source. It never falls back to another connection or same-name Issue.

## New Task Draft

Browser-local, non-business state scoped by `{userId, activeTeamId}`:

| Field | Rules |
| --- | --- |
| `title` | Same client validation as manual create |
| `description` | Same client validation as manual create |
| `projectId` | Optional; cleared if no longer in current active Team project list |
| `idempotencyKey` | UUID retained across failed/retried submits; regenerated after success/clear |

It is cleared after successful create, explicit clear, or scope change. It is never sent to another Team and never readable by server-side Session logic.

## Relationship Diagram

```text
Team 1 -------- * Task
                  |
                  +---- 0..1 Project (immutable context reference)
                  |
                  +---- 0..1 exact Issue fingerprint

Session           (no relationship created or changed by 047)
```

## Destructive Pre-0.1 Replacement

The existing Task table requires Project and stores `metadata` plus `issueDispatchKey`. Those rows cannot be interpreted as valid 047 Tasks without inventing title/source semantics. Both database migrations drop/recreate the Task table, and the legacy SQLite adoption path does not copy old Task rows. No alias, backfill, dual read or migration compatibility layer is added.
