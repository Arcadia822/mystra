# Mystra Repoindex Overview

This onboarding snapshot is GitNexus-first and 5xP-aware. Read `PRODUCT.md`,
`PLATFORM.md`, `PROCESS.md`, `PROFILE.md`, and `AGENTS.md` before feature specs.

## Purpose

Mystra is a coding-Agent production control plane. Callers capture durable Task
context, launch a Session through a selected Provider, and let Mystra lock the
Task to one Runtime, prepare its shared Task Workspace, and deliver reviewable
execution evidence through Sessions plus Task status history. Operators can also
maintain a Team-scoped Skill library whose immutable ZIP revisions are available
for review and download independently of Runtime delivery.

## Runtime shape

```text
apps/control-plane    API, MCP, Web, integrations, Skill library, RDB and Session coordination
apps/runner-daemon    host Runtime enrollment, Workspace materialization and Session execution
packages/shared       canonical Zod contracts, Session events and projection reducer
packages/agent-adapters  Codex/Copilot CLI command and continuation adapters
packages/agent-cli    workload-local mystra-agent context and Task-status client
plugins/mystra        MCP-facing Agent skills
```

## Main flows

1. Create a manual Task through HTTP/MCP/CLI/Web, optionally with Project
   context, or create/open the one Task for an exact Project-scoped Issue.
2. Select a Provider for the first Session. Mystra deterministically resolves
   an eligible online Runtime, atomically locks `Task.runtimeId`, moves
   `pending` to `in_progress`, and creates the Task's unique TaskExecutionContext.
3. Session launch automatically prepares or reuses the shared-mutable
   `<Task, Runtime>` Workspace; ready continuation creates the Task-bound Session.
4. The enrolled host Runtime claims the Session, injects a Session-scoped
   execution code and the authoritative `MYSTRA_AGENT_PATH`, then runs
   Codex/Copilot in the Workspace while appending validated typed Session events.
5. The Agent uses local authenticated `linctl` and `gh`, then reports `blocked`
   or resumes `in_progress` through `mystra-agent`; Mystra does not proxy or
   verify those external commands or the PR/self-test note.
6. A Human reviews the independently visible Task status, Sessions and history,
   then marks the Task done, resumes blocked work, or cancels it.
7. An Owner/Admin uploads a ZIP to create a Skill or publish an immutable
   Revision. Mystra validates and previews selected archive files in memory,
   stores Skill/Revision metadata through `RdbProvider`, and stores the original
   ZIP in S3-compatible object storage for authorized preview and download.

## Boundaries

- Task is editable Mystra-owned title/description/metadata plus immutable optional
  Project/exact Issue context, an independent five-state `status`/history, and a
  first-write immutable Runtime context; it
  never mirrors the external requirements lifecycle or Session state.
- TaskExecutionContext freezes optional Agent, Task, Runtime and Provider inputs,
  coordinates Workspace preparation, and remembers only the first Autopilot
  Session; later Task Sessions share its capability boundary without replacing it.
- Session is a Team-scoped sibling that independently selects Runtime, Provider,
  Agent and Context; 049 currently requires a Task and its ready Workspace.
- Session has no Turn/SessionTurn. `messageId` is command idempotency and event
  correlation only; `ready` is stable and reusable, while `closed|failed` are terminal.
- Runtime enrollment owns host health and Provider availability. Session leases
  express execution ownership/auth only; current platform capacity is unrestricted.
- SessionEvent is a Session-scoped typed fact ledger, not a global activity or
  arbitrary stdout/stderr log surface.
- API is canonical; MCP/operator CLI/Web are thin management clients, while
  Runtime-provided `mystra-agent` is a separate Task-scoped workload client.
  Workspace copies of Mystra source or generated CLI are work product, not the
  authoritative live execution contract.
- SQLite, PostgreSQL and Supabase-backed PostgreSQL remain behind `RdbProvider`;
  Prisma types do not cross the public/domain boundary.
- Skill is Team-scoped and archive-only; publishing creates immutable Revisions.
  Skill names are unique only among active Skills, so archiving permits a new
  Skill with the same name. Revision ZIPs use one S3-compatible source of truth;
  there is no filesystem adapter, RDB BLOB, per-file object catalog, Session/Agent
  binding, or Runtime delivery in Spec 056.

## Important commands

```sh
pnpm audit:task-session-terminology
pnpm typecheck
pnpm test
pnpm build
pnpm gitnexus:rebuild
```

Use `specs/spec-status.md` for Spec-Kit completion and
`specs/049-session-launch-framework/` for the canonical execution contract,
`specs/050-task-session-experience/` for the Session experience, and
`specs/054-navigation-task-workbench/` for Task status, TaskExecutionContext,
automatic Runtime/Workspace launch, navigation and the workload CLI boundary.
Use `specs/056-skill-library/` for Skill CRUD, immutable Revision, ZIP validation,
S3-compatible storage, preview, download, and archive semantics.
