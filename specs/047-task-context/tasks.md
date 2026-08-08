# Tasks: Task 上下文容器与创建入口

**Input**: Design documents from `/specs/047-task-context/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/task-management.md`, completed engineering review

**Tests**: Required. Behavioral changes follow RED → GREEN and every phase has an independent checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel after its dependencies; this execution remains sequential because no sub-Agent was authorized.
- **[US1..US4]**: Maps to the four user stories in `spec.md`.

## Phase 1: Setup and Baseline

**Purpose**: Confirm the merged 045/046 baseline, toolchain and scoped replacement surface.

- [x] T001 Verify Node 24.14.0, pnpm 10.25.0, current `main` ancestry and clean 047-only scope with `git status`, `.nvmrc`, and `package.json`
- [x] T002 Record fresh GitNexus impacts for every existing symbol that will be edited, including Task contracts, `RdbProvider`, route handlers, New UI, Issue browser and shell grouping
- [x] T003 [P] Run the current focused Task/Issue/shell tests before changes to establish a green or explicitly documented failing baseline

**Checkpoint**: Baseline evidence exists and no HIGH/CRITICAL symbol is modified without warning.

---

## Phase 2: Foundational Task Contract and Persistence

**Purpose**: Directly replace the old Project-owned Task shape behind shared typed contracts and dual-database `RdbProvider`.

- [x] T004 [P] Add RED shared Task schema tests for manual create, exact Issue reference, mutable update, limits, strict fields and response shapes in `packages/shared/src/task.test.ts`
- [x] T005 [P] Add RED management integration tests for nullable Project and Task detail Issue resolution in `packages/shared/src/management.test.ts`
- [x] T006 Implement explicit Task Zod contracts and exports in `packages/shared/src/task.ts`, `packages/shared/src/management.ts`, `packages/shared/src/schemas.ts`, and `packages/shared/src/index.ts`
- [x] T007 Add RED Prisma parity assertions and migration-shape tests for nullable Project, explicit text, idempotency and exact Issue uniqueness in `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts` and `apps/control-plane/src/lib/db/removed-persistence.test.ts`
- [x] T008 Replace Task models and add destructive 047 migrations in `apps/control-plane/prisma/sqlite/schema.prisma`, `apps/control-plane/prisma/postgresql/schema.prisma`, and both provider migration directories
- [x] T009 Regenerate both Prisma clients with `pnpm db:generate` and verify `pnpm db:validate`
- [x] T010 Add RED dual-provider contract cases for no-Project/Project create, manual replay, 20-way Issue race, Team isolation, archived Project and immutable refs in `apps/control-plane/src/lib/db/rdb-provider.contract.ts`
- [x] T011 Implement Task create/create-from-Issue/get/list/update plus exact-source batch link lookup contracts in `apps/control-plane/src/lib/db/rdb-provider.ts`, `prisma-provider.ts`, `prisma-client.ts`, `prisma-mappers.ts`, and `prisma-errors.ts`
- [x] T012 Remove legacy Task-row adoption instead of backfilling incompatible pre-0.1 data in `apps/control-plane/src/lib/db/sqlite-adoption.ts` and its tests
- [x] T013 Update the nearby persistence invariants in `apps/control-plane/src/lib/db/README.md` and verify focused SQLite provider/parity tests pass

**Checkpoint**: Shared contracts and SQLite provider tests are green; Task can exist with no Project and exact Issue uniqueness is database-enforced.

---

## Phase 3: User Story 1 — Manual Task Create from New (Priority: P1)

**Goal**: Create no-Project or Project-context Task from `/new`, API, MCP and CLI without Session effects.

**Independent Test**: Submit title-only and Project-scoped manual Tasks, retry the same key, and verify one Task per operation plus zero Session requests.

- [x] T014 [P] [US1] Add RED HTTP tests for active-Team manual create/list/get, nullable Project, replay, validation and cross-Team Project in `apps/control-plane/app/api/routes.test.ts` and `authorization-routes.test.ts`
- [x] T015 [US1] Replace `GET/POST /api/tasks` and Task GET response with shared 047 contracts in `apps/control-plane/app/api/tasks/route.ts` and `apps/control-plane/app/api/tasks/[id]/route.ts`
- [x] T016 [P] [US1] Add RED MCP tests for create/list/get/update Task schemas and no execution fields in `apps/control-plane/app/api/mcp/route.test.ts`
- [x] T017 [US1] Replace MCP Task tool definitions/handlers with strict 047 contracts in `apps/control-plane/app/api/mcp/route.ts`
- [x] T018 [P] [US1] Add RED CLI tests for optional Project, title/description, idempotency key and update request in `apps/control-plane/src/lib/operator-cli.test.ts`
- [x] T019 [US1] Replace Task CLI parsing, request bodies and human output in `scripts/operator-cli.mjs`
- [x] T020 [P] [US1] Add RED draft model tests for scoped restore, success clear, Team switch, unavailable Project and stable retry key in `apps/control-plane/app/_components/new-task-model.test.ts`
- [x] T021 [US1] Implement pure New draft helpers in `apps/control-plane/app/_components/new-task-model.ts`
- [x] T022 [US1] Rebuild the accessible manual Task form with title, description, optional Project and explicit draft clear in `apps/control-plane/app/_components/new-task-composer.tsx`
- [x] T023 [US1] Add canonical `/new`, redirect `/`, update New navigation/title and bilingual copy in `apps/control-plane/app/new/page.tsx`, `apps/control-plane/app/page.tsx`, `shell-navigation.ts`, `app-shell.tsx`, and `shell-copy.ts`
- [x] T024 [US1] Implement responsive New form/error/focus styles and remove obsolete Issue-picker styles in `apps/control-plane/app/globals.css`

**Checkpoint**: US1 works through HTTP, MCP, CLI and `/new`; Project is optional; draft/retry behavior is deterministic; Session mutation count is zero.

---

## Phase 4: User Story 2 — One-click Issue to Task (Priority: P1)

**Goal**: Create-or-open the one Task for an exact GitHub or Linear Issue from its existing row, with no intermediate page and no automatic navigation.

**Independent Test**: For both providers click once, remain on the list, observe `Open Task`, refresh, then navigate only by explicit Open Task.

- [x] T025 [P] [US2] Add RED GitHub/Linear exact single-Issue lookup tests for external ID, repository/Team scope, 404 and malformed response in `apps/control-plane/src/lib/integrations/github.test.ts` and `linear.test.ts`
- [x] T026 [US2] Implement provider-specific exact Project Issue lookup in `apps/control-plane/src/lib/integrations/github.ts` and `linear.ts`
- [x] T027 [P] [US2] Add RED ProjectIssuesService tests for expected connection/scope comparison before provider access in `apps/control-plane/src/lib/integrations/project-issues.test.ts`
- [x] T028 [US2] Extend ProjectIssuesService with exact-source Issue resolution in `apps/control-plane/src/lib/integrations/project-issues.ts`
- [x] T029 [P] [US2] Add RED Task service tests for manual composition, Issue create-or-return, source mismatch, upstream failure and detail availability in `apps/control-plane/src/lib/tasks/task-service.test.ts`
- [x] T030 [US2] Implement the source-verify → provider-read → atomic Task pipeline in `apps/control-plane/src/lib/tasks/task-service.ts`
- [x] T031 [P] [US2] Add RED API tests for GitHub/Linear Issue Task route, auth, repeated create, stay-on-list response and zero write-back in `apps/control-plane/app/api/project-issues.test.ts`
- [x] T032 [US2] Implement `POST /api/projects/[slug]/issues/[provider]/task` in `apps/control-plane/app/api/projects/[slug]/issues/[provider]/task/route.ts`
- [x] T033 [US2] Extend provider Issue list schemas and exact-source batch route decoration with optional local `taskId` in `packages/shared/src/project-issues.ts`, its tests, and `apps/control-plane/app/api/projects/[slug]/issues/[provider]/route.ts`
- [x] T034 [P] [US2] Add RED UI model tests for Create/creating/error/Open transitions without automatic navigation in `apps/control-plane/app/_components/issue-task-action-model.test.ts`
- [x] T035 [US2] Implement the bilingual accessible row action and wire GitHub/Linear tables/browser refresh in `apps/control-plane/app/_components/issue-task-action.tsx`, `project-issue-tables.tsx`, `project-issues-browser.tsx`, and `shell-copy.ts`
- [x] T036 [US2] Add responsive Issue action, live-status and table overflow styles in `apps/control-plane/app/globals.css`

**Checkpoint**: Both providers pass exact-source tests; repeated Issue creation resolves one Task; provider link remains; UI never opens a modal/New/Issue detail or Session route.

---

## Phase 5: User Story 3 — Maintain Task-owned Content (Priority: P1)

**Goal**: Read and update title/description while Project and Issue references remain immutable and external Issue failure is non-fatal.

**Independent Test**: Update manual and Issue-derived Tasks; compare IDs/refs before/after; then make source unavailable and read Task successfully.

- [x] T037 [P] [US3] Add RED PATCH/detail route tests for title/description updates, relation injection rejection, cross-Team not-found and unavailable Issue projection in `apps/control-plane/app/api/routes.test.ts`
- [x] T038 [US3] Implement strict PATCH and Task service-backed detail resolution in `apps/control-plane/app/api/tasks/[id]/route.ts`
- [x] T039 [P] [US3] Add RED Task detail editor model tests for dirty state, validation, success/error and immutable relation presentation in `apps/control-plane/app/_components/task-detail-model.test.ts`
- [x] T040 [US3] Implement bilingual accessible Task detail/editor UI in `apps/control-plane/app/tasks/[id]/page.tsx`, `apps/control-plane/app/_components/task-detail-model.ts`, `shell-copy.ts`, and `globals.css`

**Checkpoint**: Only Task-owned text changes; Task remains readable when Issue is unavailable; no relation mutation or Session logic exists.

---

## Phase 6: User Story 4 — Discover Project and No-project Tasks (Priority: P2)

**Goal**: Make every active-Team Task discoverable exactly once in list, sidebar and search.

**Independent Test**: Create two no-Project Tasks and Tasks for two Projects; verify three groups and one occurrence per Task.

- [x] T041 [P] [US4] Replace shell model tests with nullable Project grouping, No project ordering, title/Issue search and uniqueness cases in `apps/control-plane/app/_components/shell-model.test.ts` and `apps/control-plane/app/_lib/task-view.test.ts`
- [x] T042 [US4] Replace metadata/dispatch-key Task projections in `apps/control-plane/app/_lib/task-view.ts`, `_lib/format.ts`, and `_components/shell-model.ts`
- [x] T043 [US4] Render grouped Task list, No project empty/create entry and explicit Task fields in `apps/control-plane/app/tasks/page.tsx` and `apps/control-plane/app/_components/task-table.tsx`
- [x] T044 [US4] Update AppShell Task groups and Search preview for nullable Project/exact Issue refs in `apps/control-plane/app/_components/app-shell.tsx` and `shell-search-dialog.tsx`

**Checkpoint**: Every Task appears exactly once; no-Project Tasks remain discoverable after leaving detail; empty state links to `/new`.

---

## Phase 7: Reconciliation and Delivery Evidence

**Purpose**: Prove the complete spec and reconcile durable documentation with implementation.

- [x] T045 Update `PRODUCT.md`, `PLATFORM.md`, `.specify/memory/constitution.md`, nearby docs and `specs/spec-status.md` to replace obsolete Project-owned/dispatch-key Task language without editing 046 artifacts
- [x] T046 Run targeted shared/control-plane tests, dual Prisma validate/generate, full `pnpm test`, `pnpm typecheck`, and `pnpm build`; document PostgreSQL skip honestly if no URL exists
- [x] T047 Deploy the SQLite migration in an isolated runtime DB and verify manual/API concurrency plus Task update through real HTTP responses
- [x] T048 Run real Chrome verification at 320/768/1024/1440 for `/new`, `/tasks`, Task detail and provider Issue rows; capture console/network/a11y and no-horizontal-overflow evidence
- [x] T049 Run five-axis self-review, secret/Session/write-back audit, GitNexus `detect_changes --scope compare --base-ref main`, and fix all required findings
- [x] T050 Mark tasks/checklists complete, render the 047 spec index, run Spec-Kit health/status checks and perform `aaa-spec-close` reconciliation

---

## Dependencies and Execution Order

- Phase 1 → Phase 2 is mandatory.
- US1, provider lookup work in US2 and pure UI model work can begin after shared contracts, but this run is sequential.
- US2 Task service requires both persistence and provider exact lookup.
- US3 depends on Task service/detail contracts.
- US4 depends only on the final Task public record, but is performed after P1 stories to reduce shared UI conflicts.
- Phase 7 depends on all desired user stories.

## Implementation Strategy

1. RED/GREEN the shared and RDB replacement first; no UI may code against an invented shape.
2. Deliver manual create end-to-end and checkpoint.
3. Deliver Issue exact-source create/open and checkpoint.
4. Deliver update/detail, then grouped discovery.
5. Reconcile docs, run full static/runtime/browser evidence, then close the feature.

## Notes

- Do not edit any file under `specs/046-agent-definition/`.
- Do not add Session persistence, launch factors, defaults or auto routing.
- Do not preserve old Task metadata/dispatch-key compatibility.
- Before editing each existing function/class/method, run GitNexus upstream impact; warn on HIGH/CRITICAL.
- Mark every task `[x]` only after its verification succeeds.
