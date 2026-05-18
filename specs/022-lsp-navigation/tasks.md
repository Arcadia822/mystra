# Tasks: Repository-Local LSP Collaboration

**Input**: Design documents from `/specs/022-lsp-navigation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No new feature tests are required for this tooling/documentation
slice. Verification is command- and document-based: dependency installation,
LSP command discovery, and repo typecheck.

**Organization**: Tasks are grouped by technical scenario so the repo-local LSP
surface and its workflow guidance can be delivered independently.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Planning Surface)

**Purpose**: Freeze the exact tooling and documentation touchpoints before edits.

- [x] T001 Audit the current repo tooling and routing surfaces in `package.json`, `README.md`, `PLATFORM.md`, `AGENTS.md`, and `.agents/skills/spec-kit-workflow/SKILL.md`
- [x] T002 [P] Create the 022 Spec-Kit artifacts in `specs/022-lsp-navigation/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the repo-local TypeScript LSP surface before updating workflow routing.

**⚠️ CRITICAL**: Documentation work should reflect the real command surface, not a planned one.

- [x] T003 Add the repo-local LSP dependency and startup command in `/Users/arcadia/data/mystra/package.json`
- [x] T004 Update `/Users/arcadia/data/mystra/pnpm-lock.yaml` by installing the new dependency from the repo root

**Checkpoint**: The repository exposes a real `pnpm lsp:typescript` command.

---

## Phase 3: Technical Scenario 1 - Agents Can Start Repo-Local TypeScript Symbol Navigation (Priority: P1) 🎯 MVP

**Goal**: Make the TypeScript language server available from the repository root.

**Independent Test**: Run the documented repo-local LSP command and confirm that
it starts from workspace-managed dependencies.

### Implementation for Technical Scenario 1

- [x] T005 [TS1] Document the repo-local LSP command and prerequisites in `/Users/arcadia/data/mystra/README.md`
- [x] T006 [TS1] Document the repo-local LSP command and platform expectation in `/Users/arcadia/data/mystra/PLATFORM.md`

**Checkpoint**: A maintainer can discover and start the repo-local LSP from the
root docs alone.

---

## Phase 4: Technical Scenario 2 - Agents Know When LSP And GitNexus Cooperate (Priority: P1)

**Goal**: Clarify non-overlapping roles for symbol-local and graph-aware tooling.

**Independent Test**: Read the workflow guidance and confirm that symbol-local,
impact, and flow questions route to the right tool without ambiguity.

### Implementation for Technical Scenario 2

- [x] T007 [TS2] Update `/Users/arcadia/data/mystra/AGENTS.md` so LSP and GitNexus are documented as complementary code-intelligence layers
- [x] T008 [TS2] Update `/Users/arcadia/data/mystra/.agents/skills/spec-kit-workflow/SKILL.md` with routing guidance for LSP-first, GitNexus-first, and combined investigations

**Checkpoint**: Durable workflow docs explain LSP + GitNexus collaboration
without weakening GitNexus impact-analysis rules.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Reconcile docs and validate the new tooling surface.

- [x] T009 [P] Reconcile `/Users/arcadia/data/mystra/specs/022-lsp-navigation/quickstart.md` and `/Users/arcadia/data/mystra/specs/022-lsp-navigation/contracts/lsp-collaboration.md` with the landed command and docs
- [x] T010 Run `pnpm install` from `/Users/arcadia/data/mystra` to apply the dependency change
- [x] T011 Run `pnpm lsp:typescript --help` from `/Users/arcadia/data/mystra` to validate the command surface
- [x] T012 Run `pnpm typecheck` from `/Users/arcadia/data/mystra` to verify the workspace still typechecks

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 -> Phase 2 -> Technical Scenarios -> Polish
- Phase 2 blocks all documentation because the docs must point to a real command
  surface.

### Parallel Opportunities

- T001 and T002 can run in parallel during planning
- T005 and T006 can run in parallel once the command exists
- T009 can be done after the durable docs land and before final verification

### Implementation Strategy

1. Add the repo-local LSP dependency and command.
2. Document the command in general platform docs.
3. Update the durable routing docs for LSP and GitNexus collaboration.
4. Reconcile feature-local docs and run focused verification.
