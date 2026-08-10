# Mystra Repoindex Overview

This onboarding snapshot is GitNexus-first and 5xP-aware. Read `PRODUCT.md`,
`PLATFORM.md`, `PROCESS.md`, `PROFILE.md`, and `AGENTS.md` before feature specs.

## Purpose

Mystra is a headless coding-Agent execution control plane. Callers may capture
durable Task context independently from Session execution, prepare one shared
Task Workspace on a selected Runtime, and use typed Session events to produce
reviewable execution evidence.

## Runtime shape

```text
apps/control-plane    API, MCP, Web, integrations, RDB and Session coordination
apps/runner-daemon    host Runtime enrollment, Workspace materialization and Session execution
packages/shared       canonical Zod contracts, Session events and projection reducer
packages/agent-adapters  Codex/Copilot CLI command and continuation adapters
plugins/mystra        MCP-facing Agent skills
```

## Main flows

1. Create a manual Task through HTTP/MCP/CLI/Web, optionally with Project
   context, or create/open the one Task for an exact Project-scoped Issue.
2. Prepare the Task's shared-mutable Workspace on its selected online Runtime.
3. Launch a Task-bound Session atomically with frozen system prompt, Workspace
   attachment and first user message; no Turn object or second send is created.
4. The enrolled host Runtime claims the Session with an ownership lease, runs
   Codex/Copilot in the Workspace, and appends validated typed Session events.
5. A completed response returns the Session to `ready` and releases current
   execution occupancy; later user messages continue the same Provider session.

## Boundaries

- Task is editable Mystra-owned title/description plus immutable optional
  Project/exact Issue context, never external requirements lifecycle.
- Session is a Team-scoped sibling that independently selects Runtime, Provider,
  Agent and Context; 049 currently requires a Task and its ready Workspace.
- Session has no Turn/SessionTurn. `messageId` is command idempotency and event
  correlation only; `ready` is stable and reusable, while `closed|failed` are terminal.
- Runtime enrollment owns host health and Provider availability. Session leases
  express execution ownership/auth only; current platform capacity is unrestricted.
- SessionEvent is a Session-scoped typed fact ledger, not a global activity or
  arbitrary stdout/stderr log surface.
- API is canonical; MCP/CLI/Web are thin clients.
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
`specs/049-session-launch-framework/` for the canonical Session execution contract.
