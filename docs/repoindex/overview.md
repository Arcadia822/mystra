# Mystra Repoindex Overview

This onboarding snapshot is GitNexus-first and 5xP-aware. Read `PRODUCT.md`,
`PLATFORM.md`, `PROCESS.md`, `PROFILE.md`, and `AGENTS.md` before feature specs.

## Purpose

Mystra is a headless coding-Agent execution control plane. Callers create durable
Tasks, create zero or many independent child Sessions, and use stable Runners to
produce reviewable repository evidence.

## Runtime shape

```text
apps/control-plane    API, MCP, Web, Integrations, SQLite adapter
apps/runner-daemon    stable pull-based execution capacity
packages/shared       canonical Zod contracts and Session lifecycle
packages/agent-adapters
plugins/mystra        MCP-facing Agent skills
```

## Main flows

1. Create Task through HTTP/MCP/CLI or atomically dispatch an Issue to a Task
   plus initial Session.
2. Create additional sibling Sessions for independent subtasks.
3. Enroll a stable Runner and atomically claim an eligible queued Session.
4. Execute sandbox, Agent, quality, preview, branch, and review delivery.
5. Persist terminal Session result and release Runner capacity transactionally.

## Boundaries

- Task is intent and immutable Project/Repository context, never lifecycle.
- Session owns objective, Agent, branch, runtime, state, cancellation, result.
- Runner owns stable identity, health, capacity, credential, and assignments.
- Internal execution facts are not public business resources.
- API is canonical; MCP/CLI/Web are thin clients.
- SQLite is first behind `RdbProvider`; future hosted adapters remain replaceable.

## Important commands

```sh
pnpm audit:task-session-terminology
pnpm typecheck
pnpm test
pnpm build
pnpm dlx gitnexus analyze --force
```

Use `specs/spec-status.md` for Spec-Kit completion and
`specs/038-task-session-model/` for the current model contract.
