# Specification Quality Checklist: 薄 Task 生产状态机与 mystra-agent CLI

**Purpose**: 在进入规划前验证状态合同、权限边界和 MVP 范围
**Created**: 2026-08-11
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Focused on Task production lifecycle rather than a general workflow engine
- [x] State names and meanings are business-readable
- [x] All mandatory sections completed
- [x] Mystra verification capability is not fabricated

## Requirement Completeness

- [x] Transition table is complete and deterministic
- [x] Agent and Human permissions are explicit
- [x] Terminal-state and note requirements are explicit
- [x] Optimistic concurrency and idempotency behavior are testable
- [x] Task, Session, Harness, and external Issue states are separated
- [x] Acceptance scenarios cover stale revision, replay, scope mismatch, and missing Agent update
- [x] Deferred scope is explicit

## Contract Readiness

- [x] Agent uses a dedicated status transition service, not generic Task PATCH
- [x] Runtime-injected capability prevents arbitrary Task addressing
- [x] `mystra` and `mystra-agent` have distinct actors and resource boundaries
- [x] Execution code lifetime, scope, transport inputs, and secret-handling constraints are explicit
- [x] TaskExecutionContext includes the minimum sufficient fields and excludes external content and credentials
- [x] Local linctl/gh responsibility and no-platform-fallback behavior are explicit
- [x] Current projection and append-only transition history are defined
- [x] Stable JSON result and error categories are defined
- [x] One Harness attempt still starts only one Autopilot Session
- [x] Requirements are ready for speckit.plan

## Product Requirements Review

Reviewed with the project-local product-requirements and api-and-interface-design rubrics.

**Quality Score**: 98/100

- Business Value & Goals: 30/30
- Functional Requirements: 25/25
- User or Operator Experience: 20/20
- Technical Constraints: 15/15
- Scope & Priorities: 9/10

Notes:

- productionStatus is intentionally named to distinguish it from external Issue status and Session execution state.
- Task has no failed state; failure remains attempt-level truth, while blocked is the Agent-reported business condition.
- Generic Task PATCH is unsuitable for workload identity because it would expose requirement fields.
- waiting_for_review means Agent-declared review readiness, not platform-verified delivery.
- The accepted binary split prevents the workload capability from silently becoming a general Control Plane credential.
- Planning must decide execution-code signing/storage, revocation and redaction mechanics without broadening `mystra-agent`.
- Assign/Start now defines a short atomic Task/Harness transaction followed by asynchronous Workspace preparation and idempotent Session creation.
- Host-local `linctl`/`gh` installation and authentication are deployment preconditions, not Mystra Integration behavior.

## Current-contract evidence

- Current Task update contract only allows title and description; 051 therefore requires a dedicated transition contract.
- Current Session states already describe execution lifecycle and must not be reused as Task business states.
- Feature 047 explicitly excluded Task lifecycle state; 051 supersedes only that clause while preserving provider-owned Issue state.
