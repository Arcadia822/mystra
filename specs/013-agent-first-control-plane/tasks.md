# Tasks: Agent-First Control Plane

**Input**: Design documents from `/specs/013-agent-first-control-plane/`
**Prerequisites**: child specs `014` through `019`

**Backfill note**: This umbrella execution record was reconstructed after child
feature documentation drifted on `main`. It records the landed umbrella outcome:
the management hierarchy now exists across API, skills, CLI, MCP, and durable
docs.

## Completed Tasks

- [x] T001 Freeze the canonical management contract in `specs/014-management-api-truth/` and keep HTTP as the product truth
- [x] T002 Land multi-project lane selection and inspection in `specs/015-multi-project-lanes/`
- [x] T003 Land the coordinating skill surface in `.agents/skills/` through `specs/016-agent-runtime-skills/`
- [x] T004 Land the shell-first operator surface through `specs/017-operator-cli-surface/` and its CLI implementation
- [x] T005 Land the coordination-summary surface through `specs/018-coordination-run-summaries/`
- [x] T006 Keep MCP and UI as downstream consumers rather than competing management truths
- [x] T007 Refresh cross-surface operating docs in `docs/LOCAL-USAGE.md` and related feature artifacts after reconciling child-spec drift
- [x] T008 Refresh Spec-Kit status tracking so the umbrella feature no longer reports stale partial completion
