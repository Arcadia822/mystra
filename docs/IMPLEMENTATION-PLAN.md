# Mystra MVP Implementation Plan

Feature-level delivery is owned by Spec-Kit artifacts. The active contract
migration is documented in `specs/038-task-session-model/`.

## Landed foundations

- TypeScript monorepo with shared Zod contracts.
- Next.js control plane and SQLite `RdbProvider`.
- GitHub Repository/Issue Integration and read-only Linear Issue Integration.
- Remote immutable Repository snapshots on Projects and Tasks.
- Direct SandboxProvider, AgentProvider, and RepoDeliveryProvider execution.
- Test/build/preview/review evidence with `waiting_for_review` handoff.
- API, MCP, CLI, and secondary Web management clients.

## Current canonical model

- Task: durable intent with zero or many Sessions and no lifecycle state.
- Session: independent child execution with its own objective, Agent, branch,
  runtime, lifecycle, cancellation, and result.
- Runner: stable identity with enrollment credential rotation, heartbeat,
  capacity, eligibility, claim, and current Session assignments.
- Internal execution facts: persistence/protocol details only.

## Delivery order for remaining MVP work

1. Keep provider and Integration contracts aligned with Task/Session/Runner.
2. Complete end-to-end Issue → Task → Session → Runner → review verification.
3. Complete the 025 Web shell and object-page integration without changing
   canonical API ownership.
4. Harden deployment documentation and repeatable development-host validation.
5. Close finished specs using `aaa-spec-close` and keep `specs/spec-status.md`
   authoritative.

## Quality gates

```sh
pnpm audit:task-session-terminology
pnpm typecheck
pnpm test
pnpm build
```

Contract-changing features also require focused shared, SQLite, route, MCP,
Runner, CLI, and Web tests plus GitNexus impact/detect-changes review.

## Explicitly deferred

Caller auth, public logs, retries, callbacks, public activity timelines,
quality-fix loops, hosted RDB implementation, Kubernetes, shared cross-Runner
caches, public Team administration, and orchestration above the Agent.
