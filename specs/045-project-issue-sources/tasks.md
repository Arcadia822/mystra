# Tasks: Project Issue 来源与分集成浏览

**Input**: Design documents from `/specs/045-project-issue-sources/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, approved prototype
**Tests**: Required. Write each listed test first and observe the relevant failure before implementation.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means the task touches independent files and has no dependency on unfinished tasks.
- Story labels map to the four approved user stories.
- Preserve unrelated dirty edits in Project request schemas/routes and `apps/control-plane/package.json`.

## Phase 1: Setup and safeguards

**Purpose**: Establish the exact baseline and prevent accidental scope expansion.

- [x] T001 Record the current dirty-worktree baseline and feature verification commands in `specs/045-project-issue-sources/quickstart.md`
- [x] T002 Run GitNexus impact for every existing symbol before editing and append the final symbol/risk list to `specs/045-project-issue-sources/checklists/engineering-review.md`
- [x] T003 [P] Add provider-specific public contract tests for GitHub and Linear list items, filters, responses, HTTPS links, and rejected fused payloads in `packages/shared/src/project-issues.test.ts`
- [x] T004 [P] Add Linear API-key input and Linear Team/source public contract tests, including secret-field rejection, in `packages/shared/src/integrations.test.ts` and `packages/shared/src/persistence-contracts.test.ts`

**Checkpoint**: New contract tests fail for missing 045 schemas; no production code changed.

---

## Phase 2: Foundational contracts and persistence

**Purpose**: Build the shared types and durable exact-scope relation that every story requires.

- [x] T005 Implement provider-specific GitHub/Linear issue list, filter, cursor, and response schemas in `packages/shared/src/project-issues.ts` and export them from `packages/shared/src/index.ts`
- [x] T006 Implement Linear API-key input, Linear Team view, ProjectIssueSource input/view, and stable error-code schemas in `packages/shared/src/integrations.ts` and `packages/shared/src/schemas.ts`
- [x] T007 Add `ProjectIssueSource` relations and constraints to both `apps/control-plane/prisma/sqlite/schema.prisma` and `apps/control-plane/prisma/postgresql/schema.prisma`, then regenerate Prisma clients
- [x] T008 Add ProjectIssueSource CRUD/upsert/unique/reference-protection cases to `apps/control-plane/src/lib/db/rdb-provider.contract.ts` and both Prisma provider test entrypoints
- [x] T009 Add ProjectIssueSource records and additive methods to `apps/control-plane/src/lib/db/rdb-provider.ts`, `apps/control-plane/src/lib/db/prisma-mappers.ts`, and `apps/control-plane/src/lib/db/prisma-provider.ts`
- [x] T010 Verify both SQLite and PostgreSQL logical schemas and provider contracts; update DB module documentation in `apps/control-plane/src/lib/db/README.md`

**Checkpoint**: Shared and DB tests pass; each Project has 0..1 persisted Linear source and no Issue data is stored.

---

## Phase 3: User Story 1 - Team-owned Linear API-key connections (Priority: P1)

**Goal**: Owner/Admin can create, replace and delete secret-safe Linear connections; Project references block deletion.

**Independent Test**: Create two validated connections, replace one without changing its ID, reject an invalid replacement without changing old secret, and block deletion when a source references it.

### Tests first

- [x] T011 [P] [US1] Add Linear GraphQL validation tests for viewer/workspace/Teams, partial HTTP-200 errors, invalid payload, 401/403/429 and timeout in `apps/control-plane/src/lib/integrations/linear-api-key.test.ts`
- [x] T012 [P] [US1] Add connection lifecycle/secret atomicity/reference deletion tests in `apps/control-plane/src/lib/integrations/linear-api-key-service.test.ts`
- [x] T013 [P] [US1] Add Owner/Admin/Member and secret-free route tests in `apps/control-plane/app/api/linear-integration-connections.test.ts`

### Implementation

- [x] T014 [US1] Implement Linear API-key identity and accessible-Team validation in `apps/control-plane/src/lib/integrations/linear-api-key.ts`
- [x] T015 [US1] Implement create/replace/delete and exact credential resolution with existing SecretProvider transactions in `apps/control-plane/src/lib/integrations/linear-api-key-service.ts`
- [x] T016 [US1] Implement Linear API-key create route and replace/delete route in `apps/control-plane/app/api/integration-connections/linear/api-key/route.ts` and `apps/control-plane/app/api/integration-connections/linear/api-key/[id]/route.ts`
- [x] T017 [US1] Implement cursor-paginated accessible Linear Team discovery in `apps/control-plane/app/api/integration-connections/linear/api-key/[id]/teams/route.ts`
- [x] T018 [US1] Remove product use of process-level `LINEAR_API_KEY` from `apps/control-plane/src/lib/integrations/registry.ts` while preserving the provider registry contract for non-Project callers
- [x] T019 [US1] Update Linear integration configuration and secret-boundary documentation in `apps/control-plane/src/lib/integrations/README.md`

**Checkpoint**: US1 API and service suites pass; plaintext key is absent from RDB/public response/log assertions.

---

## Phase 4: User Story 2 - Exact Project Issue source configuration (Priority: P1)

**Goal**: GitHub source is derived from Project repository; Owner/Admin can configure exactly zero or one Linear Team source.

**Independent Test**: Configure, replace and remove one exact Linear connection+Team association without modifying repository binding; reject cross-Team/member/stale scope writes.

### Tests first

- [x] T020 [P] [US2] Add source resolution and live Team revalidation service tests in `apps/control-plane/src/lib/integrations/project-issue-sources.test.ts`
- [x] T021 [P] [US2] Add source GET/PUT/DELETE authorization and no-fallback API tests in `apps/control-plane/app/api/project-issue-sources.test.ts`

### Implementation

- [x] T022 [US2] Implement derived GitHub source plus persisted Linear source resolution in `apps/control-plane/src/lib/integrations/project-issue-sources.ts`
- [x] T023 [US2] Implement source summary GET route in `apps/control-plane/app/api/projects/[slug]/issue-sources/route.ts`
- [x] T024 [US2] Implement Owner/Admin Linear source PUT/DELETE route in `apps/control-plane/app/api/projects/[slug]/issue-sources/linear/route.ts`
- [x] T025 [US2] Extend connection deletion reference checks for `ProjectIssueSource` in `apps/control-plane/src/lib/integrations/linear-api-key-service.ts` and DB contract tests

**Checkpoint**: US2 passes independently; changing Linear source never changes GitHub repository fields.

---

## Phase 5: User Story 3 - Provider-specific Project Issues tab (Priority: P1)

**Goal**: Project detail exposes separate GitHub and Linear issue lists with native fields, state and failure isolation.

**Independent Test**: Browse both views for one Project; verify exact scope, native columns, independent filters/cursors, PR exclusion, and provider-original navigation only.

### Tests first

- [x] T026 [P] [US3] Expand GitHub provider tests for multiple assignees, milestone, labels, PR exclusion, filtering and cursor mapping in `apps/control-plane/src/lib/integrations/github.test.ts`
- [x] T027 [P] [US3] Expand Linear provider tests for exact Team filter, status, priority, assignee, cycle, filtering and pagination in `apps/control-plane/src/lib/integrations/linear.test.ts`
- [x] T028 [P] [US3] Add Project list service/API tests for exact credential/source, scoped cursor rejection and provider failure isolation in `apps/control-plane/src/lib/integrations/project-issues.test.ts` and `apps/control-plane/app/api/project-issues.test.ts`
- [x] T029 [P] [US3] Add provider-state reducer and native table projection tests in `apps/control-plane/app/_components/project-issues-model.test.ts`

### Implementation

- [x] T030 [US3] Extend GitHub and Linear provider-native list mapping in `apps/control-plane/src/lib/integrations/github.ts` and `apps/control-plane/src/lib/integrations/linear.ts`
- [x] T031 [US3] Implement scope-bound cursor codec and Project issue orchestration in `apps/control-plane/src/lib/integrations/project-issue-cursor.ts` and `apps/control-plane/src/lib/integrations/project-issues.ts`
- [x] T032 [US3] Implement canonical provider-discriminated GET route in `apps/control-plane/app/api/projects/[slug]/issues/[provider]/route.ts`
- [x] T033 [US3] Implement independent provider state model and shared Issues browser shell in `apps/control-plane/app/_components/project-issues-model.ts` and `apps/control-plane/app/_components/project-issues-browser.tsx`
- [x] T034 [US3] Implement GitHub and Linear native tables with external-only links in `apps/control-plane/app/_components/project-issue-tables.tsx`
- [x] T035 [US3] Replace the Project detail placeholder with object tabs, source configuration and the shared Issues browser in `apps/control-plane/app/projects/[slug]/page.tsx` and `apps/control-plane/app/_components/project-issue-source-settings.tsx`
- [x] T036 [US3] Add bilingual Issue/source/status copy and responsive/focus styles in `apps/control-plane/app/_components/shell-copy.ts`, `apps/control-plane/app/globals.css`, and provider components

**Checkpoint**: Project Issues tab works end-to-end; no All/Combined/detail/dispatch UI exists.

---

## Phase 6: User Story 4 - Project-first top-level Issues (Priority: P1)

**Goal**: `/issues` selects one active Project before loading remote Issues and reuses Project-scoped browsing.

**Independent Test**: Open `/issues` with no Project and observe zero remote requests; select/switch Project and confirm stale rows/cursors/filters disappear.

### Tests first

- [x] T037 [P] [US4] Add Project-selection reset and zero-fetch-before-selection tests in `apps/control-plane/app/_components/project-issues-model.test.ts`
- [x] T038 [P] [US4] Add shell navigation regression test proving Issues targets `/issues` while Task object routes remain reachable in `apps/control-plane/app/_components/app-shell-navigation.test.ts`

### Implementation

- [x] T039 [US4] Implement Project-first Issues page and picker in `apps/control-plane/app/issues/page.tsx` and `apps/control-plane/app/_components/issues-project-picker.tsx`
- [x] T040 [US4] Update primary Issues navigation/title from `/tasks` to `/issues` without removing direct Task routes in `apps/control-plane/app/_components/app-shell.tsx`

**Checkpoint**: US4 passes; no remote Issue request occurs until an accessible active Project is selected.

---

## Phase 7: Settings UI and cross-story completion

**Purpose**: Expose the US1 lifecycle in the approved Settings anatomy and complete security/accessibility evidence.

- [x] T041 [P] Add Linear Settings detail model tests for connection count, create/replace/delete, loading/error and secret clearing in `apps/control-plane/app/_components/linear-integration-model.test.ts`
- [x] T042 Implement Linear Integration Detail and wire it into Settings in `apps/control-plane/app/_components/linear-integration-detail.tsx`, `apps/control-plane/app/_components/shell-settings.tsx`, and `apps/control-plane/app/_components/shell-settings-panels.tsx`
- [x] T043 Run targeted shared/DB/provider/service/API/component tests for `packages/shared/src/`, `apps/control-plane/src/lib/`, and `apps/control-plane/app/` and fix all 045 failures without weakening assertions
- [x] T044 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and production build; record exact evidence in `specs/045-project-issue-sources/quickstart.md`
- [x] T045 Run secret leakage searches, verify no `LINEAR_API_KEY` runtime fallback and no Issue Task/detail/write-back controls, and record results in `specs/045-project-issue-sources/checklists/engineering-review.md`
- [x] T046 Run real browser journeys at 320/768/1024/1440px plus keyboard-only navigation and provider failure isolation; record URLs, HTTP status and visual evidence in `specs/045-project-issue-sources/quickstart.md`
- [x] T047 Re-run Spec-Kit doctor/analyze, GitNexus `detect_changes(scope=compare, base_ref=main)`, and code review; reconcile `spec.md`, `plan.md`, `tasks.md`, `specs/spec-status.md`, and implementation docs

**Final checkpoint**: All FR-001..FR-030 and SC-001..SC-010 have executable evidence; feature is ready for closeout.

---

## Dependencies and execution order

```text
T001-T004
    -> T005-T010 (contracts + persistence)
        -> T011-T019 (Linear connections)
            -> T020-T025 (Project source)
                -> T026-T036 (Project Issues)
                    -> T037-T040 (/issues)
                        -> T041-T047 (Settings + full verification)
```

- T003 and T004 may run in parallel.
- Within US1, T011-T013 may run in parallel after foundation.
- Within US2, T020-T021 may run in parallel after US1.
- Within US3, T026-T029 may run in parallel after source contracts.
- Within US4, T037-T038 may run in parallel after shared browser contracts.
- Production implementation remains sequential because shared/DB changes gate later slices and the worktree already contains overlapping user edits.

## Traceability summary

- **US1 / FR-001..009**: T011-T019, T041-T045.
- **US2 / FR-010..014**: T007-T010, T020-T025.
- **US3 / FR-015..021, FR-024..030**: T026-T036, T043-T046.
- **US4 / FR-022..024, FR-029..030**: T037-T040, T043-T046.
- **Cross-cutting security/no persistence/no dispatch**: T005-T010, T028-T036, T044-T047.

## Implementation strategy

Implement and verify one vertical slice at a time, but do not claim MVP completion after US1: all four P1 stories form the approved 045 feature. Each checkpoint must leave tests green. Do not commit automatically; the owner did not request Git operations.
