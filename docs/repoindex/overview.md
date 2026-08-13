# Mystra Repoindex Overview

This onboarding snapshot is GitNexus-first and 5xP-aware. Read `PRODUCT.md`,
`PLATFORM.md`, `PROCESS.md`, `PROFILE.md`, and `AGENTS.md` before feature specs.

## Purpose

Mystra is a coding-Agent production control plane. Callers capture durable Task
context, assign an Agent to create a thin production Harness, prepare one shared
Task Workspace on a selected Runtime, and use the resulting Session plus Task
status history to produce reviewable delivery evidence.

## Runtime shape

```text
apps/control-plane    API, MCP, Web, integrations, RDB and Session coordination
apps/runner-daemon    host Runtime enrollment, Workspace materialization and Session execution
packages/shared       canonical Zod contracts, Session events and projection reducer
packages/agent-adapters  Codex/Copilot CLI command and continuation adapters
packages/agent-cli    workload-local mystra-agent context and Task-status client
plugins/mystra        MCP-facing Agent skills
```

## Main flows

1. Create a manual Task through HTTP/MCP/CLI/Web, optionally with Project
   context, or create/open the one Task for an exact Project-scoped Issue.
2. Assign an active Agent and online Runtime/provider. The short transaction
   moves Task `pending` to `in_progress` and creates one frozen Harness attempt.
3. Prepare the Task's shared-mutable Workspace; ready continuation launches the
   Harness's unique Task-bound Session with frozen prompt/input snapshots.
4. The enrolled host Runtime claims the Session, injects an attempt-scoped
   execution code and bundled `mystra-agent`, then runs Codex/Copilot in the
   Workspace while appending validated typed Session events.
5. The Agent uses local authenticated `linctl` and `gh`, then reports `blocked`
   or `waiting_for_review` through `mystra-agent`; Mystra does not proxy or
   verify those external commands or the PR/self-test note.
6. A Human reviews the independently visible Task production state, Harness,
   latest Session and history, then marks the Task done, returns it, or cancels.

## Boundaries

- Task is editable Mystra-owned title/description plus immutable optional
  Project/exact Issue context and an independent productionStatus/history; it
  never mirrors the external requirements lifecycle or Session state.
- Harness freezes one Agent revision and attributes one first-version Session;
  it has no parallel state machine, heartbeat, event subscription or Artifact model.
- Session is a Team-scoped sibling that independently selects Runtime, Provider,
  Agent and Context; 049 currently requires a Task and its ready Workspace.
- Session has no Turn/SessionTurn. `messageId` is command idempotency and event
  correlation only; `ready` is stable and reusable, while `closed|failed` are terminal.
- Runtime enrollment owns host health and Provider availability. Session leases
  express execution ownership/auth only; current platform capacity is unrestricted.
- SessionEvent is a Session-scoped typed fact ledger, not a global activity or
  arbitrary stdout/stderr log surface.
- API is canonical; MCP/operator CLI/Web are thin management clients, while
  `mystra-agent` is a separate attempt-scoped workload client.
- SQLite, PostgreSQL and Supabase-backed PostgreSQL remain behind `RdbProvider`;
  Prisma types do not cross the public/domain boundary.

## Important commands

```sh
pnpm audit:task-session-terminology
pnpm typecheck
pnpm test
pnpm build
pnpm dlx gitnexus analyze --force
```

Use `specs/spec-status.md` for Spec-Kit completion and
`specs/049-session-launch-framework/` for the canonical execution contract,
`specs/050-task-session-experience/` for the Session experience, and
`specs/051-factory-task-harness/` for Task production, Harness assignment and
the workload-local CLI boundary.
