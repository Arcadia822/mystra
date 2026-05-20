# Feature Specification: MVP Operations Web UI Framework

**Feature Branch**: `025-webui`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: "简单补充 025 的 spec，作为 mvp 版本的操作 ui" plus follow-up scope decisions: keep `025-webui` focused on the frontend framework only, move concrete page capabilities into later page-specific specs, and include the framework foundations for theme/design-system, internationalization, main sidebar, shared layout modes, base components, responsiveness, and future Electron compatibility.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Uses The Approved Shell Framework (Priority: P1)

As an internal operator, I want the MVP UI to provide a stable shell with the
approved top-level navigation and shared page framing, so that I can recognize
Mystra's human-facing surface without that shell owning page-specific business
behavior.

**Why this priority**: The first useful UI slice is the framework itself:
navigation, layout, route framing, and shared chrome. Mystra remains API-truth
and agent-first; the shell should exist before any one page tries to become the
product.

**Independent Test**: Open the application on desktop and narrow viewports and
verify that the shell exposes only the approved top-level menus, provides a
consistent page frame for each route, and does not require page-specific
features to be implemented before the shell is usable.

**Acceptance Scenarios**:

1. **Given** the operator opens the application shell, **When** navigation is
   rendered, **Then** the top-level menu contains only `Overview`, `Inbox`,
   `New Job`, `Project`, `Settings`, and `Recent Jobs`.
2. **Given** the operator navigates between approved routes, **When** each route
   loads, **Then** the shell provides consistent navigation, page framing, and
   shared visual structure even when the page's dedicated feature spec has not
   been implemented yet.
3. **Given** one approved page has only framework-level support so far,
   **When** the operator opens it, **Then** the UI may show placeholder or
   read-only framing content instead of inventing page behavior that belongs to
   a later spec.

---

### User Story 2 - Future Page Specs Plug Into The Shell Without Redefining It (Priority: P1)

As a future Mystra agent or frontend maintainer, I want page-specific work to
land behind a stable shell contract, so that `Overview`, `Inbox`, `New Job`,
`Project`, `Settings`, and `Recent Jobs` can evolve through separate specs
without repeatedly changing the product taxonomy or shared UI ownership
boundaries.

**Why this priority**: The owner wants page functionality decomposed into later
specs. This spec must therefore define what belongs to the framework and what
must be deferred, or the next agent will improvise... again.

**Independent Test**: Review the shell contract and verify that a later
page-specific spec can add concrete content to one approved route without
changing top-level navigation, management-surface hierarchy, or shell-wide
preferences.

**Acceptance Scenarios**:

1. **Given** a later spec defines concrete `Recent Jobs` behavior, **When** that work
   is implemented, **Then** it attaches to the existing approved shell rather
   than adding a new top-level menu or replacing shell ownership.
2. **Given** a page capability requires new data, actions, or visual
   interpretation, **When** that capability is specified, **Then** it is owned
   by a dedicated follow-on spec rather than silently expanding this framework
   spec.
3. **Given** the shell framework is already present, **When** later page specs
   arrive incrementally, **Then** they can ship independently without forcing a
   redesign of global navigation, layout primitives, or shared preference
   plumbing.

---

### User Story 3 - Operator Uses The Shell Across Device, Theme, And Locale Contexts (Priority: P2)

As an internal operator, I want the shell framework to handle responsive
navigation, appearance, theme, and locale scaffolding, so that later page specs
inherit a usable cross-cutting foundation instead of each reinventing it.

**Why this priority**: Responsiveness, visual preference, and localization are
framework concerns. They should be solved once at the shell level, not
re-litigated page by page.

**Independent Test**: Open the shell on narrow and wide viewports, switch light
and dark appearance, change theme and locale, and verify that the shell remains
usable even if page-specific functionality is still placeholder-level.

**Acceptance Scenarios**:

1. **Given** the operator uses a narrow viewport, **When** they navigate between
   approved routes, **Then** the shell remains usable without horizontal
   overflow being the primary navigation strategy.
2. **Given** the operator switches light/dark appearance or theme, **When** the
   shell re-renders, **Then** shared navigation and page framing remain visually
   coherent across approved routes.
3. **Given** the operator changes locale, **When** they revisit the shell,
   **Then** shared navigation and framework-owned copy reflect the selected
   locale or a predictable fallback.

---

### User Story 4 - Frontend Maintainer Reuses Shared Layouts And Components (Priority: P2)

As a frontend maintainer, I want the shell framework to provide a main sidebar,
shared layout archetypes, and a base component layer aligned with Mystra's
design-system direction, so that later page specs can compose consistent UI
surfaces instead of rebuilding structure and primitives ad hoc.

**Why this priority**: If the framework does not own sidebar, layout modes, and
base components now, every later page spec will smuggle framework decisions
back in through the side door. That pattern is not elegant. It is merely
predictable.

**Independent Test**: Review the shell contract and verify that later page specs
can choose among the approved layout archetypes and shared base components
without redefining the sidebar, token model, or primitive interaction patterns.

**Acceptance Scenarios**:

1. **Given** the operator is using the shell, **When** navigation is displayed,
   **Then** the main sidebar remains the shared primary navigation container for
   approved top-level routes.
2. **Given** a later page spec needs a conversational, dashboard, or
   reading-focused surface, **When** it is implemented, **Then** it can attach to
   `chatLayout`, `dashboardLayout`, or `readLayout` rather than inventing a new
   top-level framing model by default.
3. **Given** a later page spec needs buttons, inputs, badges, panels, lists, or
   similar primitives, **When** it is implemented, **Then** it can rely on the
   framework's shared component layer and design-system alignment instead of
   introducing an unrelated visual grammar.

---

### User Story 5 - Future Desktop Packaging Preserves The Same Framework Contract (Priority: P3)

As a future Mystra maintainer, I want the shell framework to remain compatible
with a later Electron wrapper, so that Mystra can gain a desktop shell without
rewriting navigation, layout, theming, localization, or base component
contracts.

**Why this priority**: The owner explicitly wants later Electron compatibility.
That should be treated as an architectural guardrail for the framework slice,
not as an apology added during packaging week.

**Independent Test**: Review the framework requirements and verify that shell
concerns are expressed in a way that can run in the current web delivery shape
while remaining compatible with a future Electron-hosted shell.

**Acceptance Scenarios**:

1. **Given** Mystra is currently delivered as a web control-plane UI, **When**
   the shell framework is implemented, **Then** it does not assume a browser-only
   product model that would force route taxonomy, theme handling, or layout
   ownership to be redesigned for Electron.
2. **Given** a future Electron shell wraps the same frontend, **When** that
   migration happens, **Then** main sidebar, shared layouts, i18n, and theme
   systems remain reusable rather than being web-only special cases.
3. **Given** a framework capability truly depends on the host environment,
   **When** it is specified or implemented, **Then** the environment-specific
   seam is explicit instead of being hidden inside otherwise shared shell
   behavior.

---

### Edge Cases

- What happens when an approved page does not yet have a dedicated feature spec?
  The shell should still render a valid route with placeholder or read-only
  framing rather than omitting the route or inventing page semantics.
- What happens when page-specific backend capabilities are not mature enough for
  editing or live data? The framework may remain inspection-first and should not
  fake completed product behavior.
- What happens when navigation space is limited on small screens? The shell
  should preserve access to all approved menus without creating a different
  product taxonomy for mobile.
- What happens when a selected theme or locale is not fully available? The shell
  should fall back predictably while keeping navigation understandable.
- What happens when a page needs a shape that does not obviously fit
  `chatLayout`, `dashboardLayout`, or `readLayout`? The default expectation is
  to map it onto one of the approved layout archetypes unless a later spec
  justifies a new framework-level layout.
- What happens when a page-specific design diverges from the shared design
  system? The page should justify an extension to the framework rather than
  bypassing shared tokens and primitives silently.
- What happens when a future Electron host introduces desktop-only affordances?
  The framework should keep shared UI contracts portable and isolate host-only
  behavior at explicit seams.
- What happens when a later page spec tries to introduce a new primary menu or
  UI-owned management semantics? That change is out of scope for this feature
  and must be justified separately against the project management-surface
  hierarchy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an internal MVP web UI framework that acts
  as a secondary operations and inspection shell over Mystra's existing
  management capabilities.
- **FR-002**: The top-level navigation of the MVP UI framework MUST contain only
  `Overview`, `Inbox`, `New Job`, `Project`, `Settings`, and `Recent Jobs`.
- **FR-003**: This spec MUST own shell-level concerns only, including approved
  navigation, route framing, shared layout structure, shared visual language,
  shell-wide preference plumbing, and future-compatible host-shell boundaries.
- **FR-004**: This spec MUST NOT define concrete page-specific product behavior
  for `Overview`, `Inbox`, `New Job`, `Project`, `Settings`, or `Recent Jobs`;
  those behaviors MUST be specified in dedicated follow-on specs.
- **FR-005**: Each approved top-level menu MUST have a route or route-equivalent
  shell entry so the navigation model is concrete even before page-specific
  functionality is implemented.
- **FR-006**: The shell MUST allow an approved route to render placeholder,
  unavailable, or read-only framing content when that route's dedicated feature
  spec has not yet landed.
- **FR-007**: The shell MUST provide a main sidebar as the shared primary
  navigation container for approved top-level routes.
- **FR-008**: The shell MUST define and own the three core layout archetypes:
  `chatLayout`, `dashboardLayout`, and `readLayout`.
- **FR-009**: Later page-specific specs MUST compose onto `chatLayout`,
  `dashboardLayout`, or `readLayout` by default unless a separately justified
  framework change expands the approved layout set.
- **FR-010**: The shell MUST provide a shared base component layer for common UI
  primitives used across approved routes.
- **FR-011**: The base component layer and shell visual language MUST align with
  Mystra's Claude design-system direction so that themes, tokens, and component
  behavior remain coherent across the framework.
- **FR-012**: The shell MUST provide consistent cross-route structure for
  navigation, page framing, and shared interaction patterns instead of letting
  each page define its own incompatible shell.
- **FR-013**: The shell MUST provide shared responsive behavior across supported
  narrow and wide viewports.
- **FR-014**: The shell MUST support light mode and dark mode.
- **FR-015**: The shell MUST support theme switching beyond light/dark
  appearance mode where the product defines distinct visual themes.
- **FR-016**: The shell MUST support internationalization so that approved
  navigation and framework-owned copy can be presented in supported locales.
- **FR-017**: The shell MUST preserve the project management-surface hierarchy in
  which API is truth and skill/MCP and CLI remain preferred programmable
  interfaces; the UI framework MUST not become the sole owner of management
  semantics.
- **FR-018**: The shell MUST treat workspace as a run-scoped execution-context
  concept and MUST NOT use workspace as the tenancy term for hosted product
  structure.
- **FR-019**: The MVP shell framework MUST remain private-operations focused and
  MUST NOT require caller auth, logs API, retry API, public SaaS tenancy
  management, or other currently out-of-scope platform features before it is
  usable.
- **FR-020**: A later page-specific spec MUST be able to add route content,
  actions, and data presentation for one approved menu without changing the
  approved top-level taxonomy or shell-level ownership model.
- **FR-021**: The shell framework MUST preserve compatibility with a future
  Electron host so that navigation, layout archetypes, theme system,
  internationalization, and base components can be reused without redefining the
  framework contract.
- **FR-022**: Any environment-specific behavior required for a future Electron
  shell MUST be isolated behind explicit seams rather than being baked into the
  shared framework contract as a web-only assumption.

### Key Entities *(include if feature involves data)*

- **Operations Shell**: The framework-level UI container that organizes
  top-level navigation and shared page framing.
- **Main Sidebar**: The shared primary navigation rail for approved top-level
  routes.
- **Navigation Model**: The approved set of top-level menus and their routing
  identity.
- **Page Frame Contract**: The shared shell structure that later page-specific
  specs inherit when they add content to an approved route.
- **Layout Archetypes**: The approved framework layouts `chatLayout`,
  `dashboardLayout`, and `readLayout`.
- **Base Component Layer**: The shared set of UI primitives and interaction
  patterns used across routes.
- **Theme System**: The framework-owned theme, token, and appearance model,
  aligned with Mystra's Claude design-system direction.
- **Shell Preferences**: Framework-owned appearance, theme, locale, and other
  shared UI settings that apply across routes.
- **Placeholder Route State**: The valid shell-level state for an approved page
  whose dedicated feature spec has not yet been implemented.
- **Host Shell Compatibility Boundary**: The framework constraint that keeps the
  shared UI portable between the current web host and a future Electron host.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The MVP UI exposes only `Overview`, `Inbox`, `New Job`,
  `Project`, `Settings`, and `Recent Jobs` as top-level menus, with no extra
  primary navigation areas.
- **SC-002**: The shell provides a main sidebar plus the approved
  `chatLayout`, `dashboardLayout`, and `readLayout` archetypes as reusable
  framework primitives for later page specs.
- **SC-003**: The shell provides shared theme/design-system alignment,
  internationalization scaffolding, base components, and responsive behavior
  that later page specs can inherit without redefining them.
- **SC-004**: Operators can navigate to every approved top-level route and see a
  consistent shell-valid page frame even when page-specific behavior is deferred
  to later specs.
- **SC-005**: Later page-specific specs can add concrete route behavior without
  changing the approved shell taxonomy or redefining shared layouts,
  components, and preferences.
- **SC-006**: Operators can use the shell on both narrow and wide viewports, and
  can switch light/dark mode, theme, and supported language without breaking
  shell navigation.
- **SC-007**: The same framework contract remains usable in the current web host
  and is not specified in a way that blocks a later Electron wrapper.
- **SC-008**: The UI framework remains secondary to API, skill/MCP, and CLI
  management surfaces and does not require MVP-excluded platform capabilities to
  be useful.
