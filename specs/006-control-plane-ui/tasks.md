# Tasks: Control Plane UI Optimization

**Input**: Design documents from `/specs/006-control-plane-ui/`
**Prerequisites**: plan.md, spec.md

**Tests**: Use existing `apps/control-plane` test/build/typecheck commands for any revived implementation work.

**Organization**: Retroactive status backfill. The original UI optimization scope largely landed in `apps/control-plane/app/`, while later visual-system work moved under `011-control-plane-design-system`. This feature is now closed at prototype scope; queue filtering and companion-skill discovery UI are intentionally excluded from 006 completion.

## Phase 1: Retroactive Scope Reconciliation

- [x] T001 Re-audit the current dashboard in `apps/control-plane/app/page.tsx`, `layout.tsx`, and `globals.css` against `spec.md`.
- [x] T002 Reconcile this feature with later control-plane design-system work under `specs/011-control-plane-design-system/`, treating 011 as the visual-system follow-on rather than a replacement for operator workflow surfaces.
- [x] T003 Refresh the retroactive Spec Kit notes so this feature records the shipped dashboard scope instead of a placeholder-only plan.

## Phase 2: Operator Health and Job Visibility

- [x] T004 [US1] Add/refresh component health panels using existing control-plane status data, including live summary tiles plus runner heartbeat/capacity panels in `apps/control-plane/app/page.tsx`.
- [x] T005 [US2] Add job-detail presentation for lifecycle events, workflow execution, run result, MR link, and cancellation controls in `apps/control-plane/app/page.tsx`.

## Phase 3: Submission and Integration Panels

- [x] T006 [US3] Improve the task submission form for project, prompt, branch, and merge-request metadata in `apps/control-plane/app/page.tsx`.
- [x] T007 [US4] Add MCP connection info in the dashboard, including transport/path details and a live `tools/list` preview panel in `apps/control-plane/app/page.tsx`.

## Phase 4: Closure

- [x] T008 Record that remaining UI-only visual refinements now live under `011-control-plane-design-system`, and that deeper queue/discovery ergonomics are follow-on scope rather than part of the 006 prototype.
- [x] T009 Validate the current dashboard against existing control-plane checks:
      `pnpm --filter @mystra/control-plane typecheck`,
      `pnpm --filter @mystra/control-plane test`,
      `pnpm --filter @mystra/control-plane build`.
