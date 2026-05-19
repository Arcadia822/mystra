# Feature Specification: MVP Operations Web UI

**Feature Branch**: `025-webui`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: "简单补充 025 的 spec，作为 mvp 版本的操作 ui"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Submits Work From The New Job Surface (Priority: P1)

As an internal operator, I want to open `New Job`, choose a project, and
describe the work in natural language, so that I can submit a Mystra job
without manually reasoning about runtime, runner, or workflow configuration.

**Why this priority**: This is the smallest operator-facing slice that proves
the UI can help a human initiate work while still respecting the existing
agent-first control-plane model.

**Independent Test**: Open the UI, choose a project, submit a natural-language
request, and verify that Mystra creates the corresponding work item and takes
the operator to the resulting run detail view.

**Acceptance Scenarios**:

1. **Given** the operator opens the `New Job` page and has not selected a
   project,
   **When** they type a request, **Then** the UI preserves the draft text but
   keeps submission disabled until a project is chosen.
2. **Given** the operator selects a project and enters a non-empty request,
   **When** they submit, **Then** the UI creates work using project-owned
   defaults rather than asking the operator to fill runtime, branch, or runner
   details manually.
3. **Given** Mystra rejects the submission, **When** the UI shows the failure,
   **Then** the operator can see a structured error and retry without losing the
   request text.

---

### User Story 2 - Operator Uses Jobs To Track Progress And Outcomes (Priority: P1)

As an operator or reviewer, I want a `Jobs` surface that lists work and opens a
compact job detail view, so that I can understand execution state and final
artifacts without reading the full event stream or raw logs.

**Why this priority**: The MVP UI should primarily help humans interpret the
existing execution truth that already lives in the API and persistence layer.

**Independent Test**: Open the `Jobs` menu, inspect queued, running, and
terminal jobs, and confirm that the UI shows status, current phase, key
milestones, relevant runtime context, and final delivery artifacts in a
human-readable form.

**Acceptance Scenarios**:

1. **Given** jobs exist in Mystra, **When** the operator opens `Jobs`, **Then**
   the page shows a list of jobs with project, status, and enough summary
   information to choose one for inspection.
2. **Given** a selected job is still in progress, **When** the operator opens
   job detail under `Jobs`, **Then** the UI summarizes milestone progression
   such as queued, assigned, workflow running, and artifact delivery instead of
   requiring raw event inspection.
3. **Given** the selected job reaches a terminal state, **When** the operator
   reviews the result, **Then** the UI surfaces final summary facts and
   reviewable artifacts such as branch, PR, MR, or equivalent result references
   when they exist.

---

### User Story 3 - Operator Uses Only The Approved Navigation Shell (Priority: P2)

As a platform operator, I want the MVP UI to stay constrained to the approved
navigation shell, so that the product remains easy to understand and does not
grow ad hoc menus or UI-first management surfaces.

**Why this priority**: MVP Mystra is API-truth and agent-first. The UI should
help inspection and limited operations, but it must not become the only place
where the platform is understandable.

**Independent Test**: Navigate the full shell on desktop and mobile layouts and
verify that the product exposes only `Overview`, `New Job`, `Jobs`, `Project`,
and `Settings`, with no extra top-level menus.

**Acceptance Scenarios**:

1. **Given** the operator opens the application shell, **When** navigation is
   rendered, **Then** the top-level menu contains only `Overview`, `New Job`,
   `Jobs`, `Project`, and `Settings`.
2. **Given** the operator opens `Overview`, **When** the page loads, **Then**
   it shows high-level job, success-rate, time-to-artifact, cost, and
   runner-health signals suitable for an MVP operational summary rather than a
   deep analytics suite.
3. **Given** the operator opens `Project` or `Settings`, **When** the page
   loads, **Then** the UI shows only the corresponding project facts or
   application/platform settings without inventing extra functional areas or
   configuration concepts that are not already part of Mystra's management
   model.

---

### User Story 4 - Operator Uses The UI Across Device, Theme, And Language Contexts (Priority: P2)

As an internal operator, I want the MVP UI to adapt across screen sizes, visual
themes, and supported languages, so that the same product remains usable in
daily operations rather than only in one desktop/demo presentation mode.

**Why this priority**: These are cross-cutting product requirements that affect
every approved menu and should be treated as first-slice capabilities rather
than polish.

**Independent Test**: Open all approved menus on mobile-width and desktop-width
viewports, switch between light and dark appearance, switch theme, and change
language; verify that navigation and primary content remain usable without
breaking the operator flow.

**Acceptance Scenarios**:

1. **Given** the operator opens the UI on a narrow viewport, **When** they move
   between `Overview`, `New Job`, `Jobs`, `Project`, and `Settings`, **Then**
   the shell remains usable without horizontal-overflow-dependent navigation.
2. **Given** the operator switches between light and dark appearance,
   **When** the pages re-render, **Then** the approved menus and primary content
   remain readable and visually coherent in both modes.
3. **Given** the operator changes theme or language in `Settings`, **When** they
   revisit the main menus, **Then** the selected theme and locale remain applied
   consistently across the UI.

---

### Edge Cases

- What happens when there are no projects yet? The UI should explain why new
  work cannot be submitted and direct the operator toward project setup instead
  of presenting an empty-but-clickable intake flow.
- What happens when summary data is incomplete or a run is stale? The UI should
  show the best available structured state and mark missing details explicitly
  rather than inventing lifecycle progress.
- What happens when navigation space is limited on small screens? The UI should
  preserve access to all approved menus without introducing a different product
  taxonomy for mobile.
- What happens when a selected theme or locale is unavailable for part of the
  UI? The product should fall back predictably while keeping core navigation and
  job operations understandable.
- What happens when a page depends on backend capabilities that are not mature
  enough for editing? The MVP UI may stay inspection-first and keep unsupported
  controls read-only or absent.
- What happens when a capability is already better served through API, skill,
  MCP, or CLI? The UI should defer to those surfaces rather than duplicating
  configuration or transport semantics.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an internal MVP web UI that acts as a
  secondary operations and inspection surface over Mystra's existing management
  capabilities.
- **FR-002**: The top-level navigation of the MVP UI MUST contain only
  `Overview`, `New Job`, `Jobs`, `Project`, and `Settings`.
- **FR-003**: The UI MUST allow an operator to select a project and submit a
  natural-language work request from `New Job` without manually specifying
  runner, runtime, workflow, repo, or branch details on the intake screen.
- **FR-004**: The UI MUST derive execution defaults for new jobs from project
  and workflow configuration already owned by the control plane rather than
  creating a UI-only source of truth.
- **FR-005**: The `Jobs` menu MUST provide a job list and a job-detail surface
  that summarize status, current phase, key lifecycle milestones, relevant
  runtime context, and final artifact references when available.
- **FR-006**: The UI MUST preserve structured submission and job errors in a
  human-readable form without forcing operators to inspect raw protocol payloads.
- **FR-007**: The UI MUST provide an `Overview` surface with compact operational
  signals appropriate for MVP management, including job volume, delivery
  success, time-to-artifact, and available cost or runner-health signals.
- **FR-008**: The `Project` menu MUST provide project inspection for repository,
  base branch, runtime, context, and workflow defaults without expanding into
  unrelated management domains.
- **FR-009**: The `Settings` menu MUST contain application- and
  platform-oriented settings needed by the MVP UI, including appearance mode,
  theme selection, locale selection, and any existing platform settings that
  belong in the approved shell.
- **FR-010**: The UI MUST be responsive across supported narrow and wide
  viewports, with navigation and primary workflows remaining usable without
  desktop-only assumptions.
- **FR-011**: The UI MUST support light mode and dark mode.
- **FR-012**: The UI MUST support theme switching beyond light/dark appearance
  mode where the product defines distinct visual themes.
- **FR-013**: The UI MUST support internationalization so that approved menus,
  primary page copy, and core operator flows can be presented in supported
  locales.
- **FR-014**: The UI MUST preserve the project management-surface hierarchy in
  which API is truth and skill/MCP and CLI remain preferred programmable
  interfaces; the UI MUST not become the sole owner of management semantics.
- **FR-015**: The UI MUST treat workspace as a run-scoped execution-context
  concept and MUST NOT use workspace as the tenancy term for hosted product
  structure.
- **FR-016**: The MVP UI MUST remain private-operations focused and MUST NOT
  require caller-auth, logs API, retry API, public SaaS tenancy management, or
  other currently out-of-scope platform features before it is usable.

### Key Entities *(include if feature involves data)*

- **Operations Web UI**: The internal operator-facing shell that organizes
  Overview, New Job, Jobs, Project, and Settings.
- **New Job Intake**: The UI flow where an operator chooses a project and
  submits a natural-language job request.
- **Jobs View**: The combined list/detail surface that explains one job
  lifecycle using summary facts, milestones, runtime context, and result
  references.
- **Overview Snapshot**: The compact operational summary of throughput, success,
  time-to-artifact, cost, and runner signals for a selected scope.
- **Project View**: The inspection surface for project defaults such as repo,
  base branch, runtime, workflow, and context-bundle boundaries.
- **Settings View**: The shell area that owns appearance mode, theme, locale,
  and approved application/platform settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can create a new Mystra job from `New Job` by
  selecting a project and entering a natural-language request without filling
  low-level execution fields manually.
- **SC-002**: A reviewer can determine the status, current phase, and final
  delivery artifact of a job from the `Jobs` surface without reading raw event
  logs for the normal happy path.
- **SC-003**: The MVP UI exposes only `Overview`, `New Job`, `Jobs`, `Project`,
  and `Settings` as top-level menus, with no extra primary navigation areas.
- **SC-004**: Operators can use the approved menus on both narrow and wide
  viewports, and can switch light/dark mode, theme, and supported language
  without breaking the primary operator flow.
- **SC-005**: The UI does not require MVP-excluded capabilities such as caller
  authentication, retry loops, or logs API before it can support the primary
  operator flow.
