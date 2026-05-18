# Tasks: MCP Companion Skills

**Input**: Design documents from `/specs/008-mcp-skills/`
**Prerequisites**: plan.md, spec.md

**Tests**: Validate by invoking the relevant skills against a live or local Mystra MCP endpoint.

**Organization**: Retroactive status backfill. The core companion skill pack now exists as repo-local skills under `.agents/skills/`, and these tasks record the implemented slice plus endpoint-backed validation evidence.

## Phase 1: Refresh and Audit

- [x] T001 Audit the current Mystra MCP surface in `apps/control-plane/app/api/mcp/route.ts` and related shared schemas.
- [x] T002 Inventory existing repo-local skills and note that current wrappers are Spec Kit / operational helpers, not the user-journey / implementation / task-status companion skills described by this feature.
- [x] T003 Refresh the retroactive plan/tasks notes with the current installation/discovery mechanism before future implementation resumes.

## Phase 2: Submission Skills

- [x] T004 [US1] Define and implement the user-journey submission skill input contract and MCP mapping in `.agents/skills/mystra-submit-user-journey/SKILL.md`.
- [x] T005 [US2] Define and implement the implementation-request submission skill input contract and MCP mapping in `.agents/skills/mystra-submit-implementation-request/SKILL.md`.
- [x] T006 [US1] [US2] Add validation/error behavior for connection failures and invalid inputs in those companion skill wrappers.

## Phase 3: Status and Discovery

- [x] T007 [US3] Define and implement the status skill wrapper for result/progress retrieval in `.agents/skills/mystra-check-task-status/SKILL.md`.
- [x] T008 [US4] Document installation metadata for the repo-local companion skills in `specs/008-mcp-skills/quickstart.md`.
- [x] T009 [US4] Add discovery guidance so developers can find the companion skills in `specs/008-mcp-skills/quickstart.md`.

## Phase 4: Closure

- [x] T010 Update docs/examples now that the real companion skill wrappers exist.
- [x] T011 Run end-to-end MCP-backed validation for at least one submission flow and one status-check flow.

## Notes

- The implementation intentionally uses the existing `mystra_create_task` and `mystra_get_task` MCP tools without adding a new workflow-name field to the MCP contract.
- Workflow blueprint hints for implementation requests are carried in `metadata.workflow` and echoed in the generated prompt so the wrapper stays inside the current contract.
