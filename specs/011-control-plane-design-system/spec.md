# Feature Specification: Control-Plane Design System

**Feature Branch**: `[011-control-plane-design-system]`  
**Created**: 2026-05-15  
**Status**: Implemented; closure verified
**Input**: User description: "参考现有设计参考来做；学习 Codex 的主题、布局和风格，构建本项目的设计系统。颜色不必照抄，但要准备一套主题系统。"

## Scope

This design system is **global to Mystra frontend surfaces**, even though the
current repository only exposes one production UI surface: `apps/control-plane`.
Control plane is the first consumer, not the boundary of the system.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operators scan the control plane in a calmer workspace (Priority: P1)

As an internal operator, I want the control-plane UI to follow a clearer, calmer desktop workbench language so that I can scan queue, runner, and MCP state without the interface competing for attention.

**Why this priority**: This is the primary user-visible value: improved hierarchy, density, and readability without changing product behavior.

**Independent Test**: Open the control-plane page and confirm the main shell presents a persistent sidebar, centered primary canvas, softened panel hierarchy, and clearer section grouping while all existing actions still work.

**Acceptance Scenarios**:

1. **Given** the control-plane page loads, **When** an operator views the dashboard, **Then** the page uses a Codex-inspired shell with a persistent left rail and restrained bordered surfaces.
2. **Given** projects, jobs, runners, and MCP data are present, **When** the operator scans the page, **Then** summaries, lists, forms, and detail panes remain readable and clearly prioritized.

---

### User Story 2 - The UI can change mood without component rewrites (Priority: P1)

As a maintainer, I want semantic theme tokens and runtime theme selection so that the UI can shift between light, warm, and dark moods without rewriting individual components.

**Why this priority**: The user explicitly requested a theme system rather than a single copied palette.

**Independent Test**: Switch between the provided themes in the control plane and confirm surfaces, borders, text, emphasis, and state colors update consistently.

**Acceptance Scenarios**:

1. **Given** the control-plane page is open, **When** the operator selects a different theme, **Then** the page updates through semantic tokens rather than isolated component overrides.
2. **Given** the operator returns later, **When** the page reloads, **Then** the previously selected theme remains active.

---

### User Story 3 - Future UI work inherits repeatable design rules (Priority: P2)

As a future agent or engineer, I want the design decisions documented as a reusable system so that new control-plane surfaces can extend the same language instead of inventing new styling rules.

**Why this priority**: This keeps the work durable instead of becoming a one-off restyle.

**Independent Test**: Read the feature artifacts and confirm they describe tokens, layout principles, and component treatment decisions clearly enough to guide future UI work.

**Acceptance Scenarios**:

1. **Given** a future contributor opens the feature artifacts, **When** they review the design-system spec, **Then** they can identify the layout philosophy, token model, and expected component treatments.

---

### Edge Cases

- What happens when a dark theme is selected? Semantic status and interactive colors must remain legible and intentional.
- What happens when lists or forms become dense? The design system must preserve scannability without relying on heavy shadows or saturated color blocks.
- What happens when content overflows? Long identifiers, repo names, prompts, and JSON output must still wrap or truncate safely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mystra frontend surfaces MUST expose semantic design tokens for background, surfaces, borders, text, accents, and status states.
- **FR-002**: The design system MUST provide exactly one built-in light theme and one built-in dark theme for the current phase.
- **FR-003**: Themes MUST be defined through a configuration shape that includes `codeThemeId`, `variant`, and a `theme` object with `accent`, `contrast`, `fonts`, `ink`, `opaqueWindows`, `semanticColors`, and `surface`.
- **FR-004**: Theme choice MUST persist across reloads for the same browser.
- **FR-005**: `theme.fonts.ui` MAY be null and fall back to the global UI font stack, but `theme.fonts.code` MUST be treated as an explicit mono-font override point for code-oriented surfaces.
- **FR-006**: The current page shell MUST reflect the Codex-inspired structure from the provided screenshots: muted sidebar navigation, centered primary canvas, restrained surfaces, and pill-like controls.
- **FR-007**: Existing control-plane behaviors for refresh, job creation, queue selection, cancellation, and MCP inspection MUST remain intact.
- **FR-008**: The styling system MUST rely on semantic tokens and reusable component classes rather than raw ad hoc colors spread through the UI.
- **FR-009**: The theme contract MUST remain import-friendly so future themes can be added by supplying the same config object without redesigning components.
- **FR-010**: The documented design system MUST define the component catalog for shell/navigation, surfaces, form controls, badges, list/data rows, code blocks, overlays, and theme selection.

### Key Entities *(include if feature involves data)*

- **Theme Definition**: A persisted theme configuration object that maps `codeThemeId`, `variant`, and the nested `theme` fields into the derived semantic UI tokens used by the control-plane.
- **Design Tokens**: The semantic variables consumed by all Mystra frontend surfaces, covering color, typography, spacing, radii, borders, elevation, and state semantics.
- **Component Catalog**: The approved reusable UI patterns that consume the token model.
- **Control-Plane Surface**: Existing app sections such as the rail, module panels, queue rows, forms, detail panes, and modal-like treatments that consume the shared tokens.

## Design System Reference

### 1. Design Philosophy

- **Calm operator desktop**: The UI should feel quiet, capable, and low-noise.
- **Wide, breathable canvas**: Prefer whitespace and clear grouping over dense dashboards.
- **Structure over decoration**: Hierarchy comes from placement, spacing, borders, and typography more than from color blocks.
- **Themeable by contract**: Components should not care whether the theme is light or dark; they consume semantic tokens only.
- **Global first, local now**: Mystra owns one design system even if `control-plane` is the only current frontend.

### 2. Theme Contract

All themes must follow this shape:

```json
{
  "codeThemeId": "notion",
  "theme": {
    "accent": "#3183d8",
    "contrast": 29,
    "fonts": {
      "code": "SF Mono",
      "ui": null
    },
    "ink": "#37352f",
    "opaqueWindows": true,
    "semanticColors": {
      "diffAdded": "#008000",
      "diffRemoved": "#a31515",
      "skill": "#0000ff"
    },
    "surface": "#ffffff"
  },
  "variant": "light"
}
```

#### Theme Rules

- `variant` is currently `light` or `dark`.
- `codeThemeId` identifies the source mood or imported theme identity.
- `theme.accent` is the primary interactive emphasis color.
- `theme.contrast` tunes separation strength between surfaces, borders, and text.
- `theme.fonts.ui` may be null; the system falls back to the default UI stack.
- `theme.fonts.code` is the designated mono-font override point and should be set intentionally for code-facing surfaces.
- `theme.opaqueWindows` controls whether large surfaces read as solid sheets or translucent panels.
- `theme.semanticColors` provides domain-aware accents that feed success/error/skill-oriented states.
- `theme.surface` is the root surface from which derivative surfaces are mixed.

### 3. Token Model

#### Typography Tokens

- `font-sans`: global UI/body stack
- `font-mono`: global code/identifier stack
- Heading hierarchy: `h1` page title, `h2` section title, `h3` module title, `h4` local subsection title

#### Color Tokens

- `background`
- `surface1`, `surface2`, `surface3`, `surface-inset`
- `border`, `border-visible`
- `text1`, `text2`, `text3`
- `accent`, `accent-soft`, `accent-contrast`
- `success`, `success-bg`, `success-border`
- `warning`, `warning-bg`, `warning-border`
- `danger`, `danger-bg`, `danger-border`
- `skill-accent`
- `code-bg`, `code-border`, `code-text`

#### Layout Tokens

- Spacing scale: `space-2xs` through `space-3xl`
- Shape scale: `radius-element`, `radius-control`, `radius-component`, `radius-container`, `radius-pill`
- Elevation scale: `shadow-1`, `shadow-2`

### 4. Layout Rules

- Keep a **persistent left rail** for top-level product navigation when desktop width allows.
- Keep the **main work area centered** rather than stretching edge-to-edge.
- Prefer **single-column reading order** inside operational content modules unless a multi-column layout is clearly earned later.
- Use **soft 1px borders** and restrained shadows instead of thick separators or heavy depth.
- Keep information density **宽松**: padding and whitespace should imply calmness, not consumer fluff.

### 5. Component Catalog

The global Mystra design system currently includes these reusable component families:

- **App shell**: page shell, sidebar rail, navigation group, work canvas
- **Section framing**: workspace header, module header, pane header, section header
- **Surfaces**: module card, pane card, project card, runner card, summary block
- **Status units**: status tile, counter, pill/badge, semantic state treatments
- **Forms**: label, text input, select, textarea, grouped form actions
- **Data presentation**: queue row, event row, workflow row, key-value grid, stat row
- **Code surfaces**: JSON/code block with dedicated mono typography
- **Theme controls**: theme picker, theme option tile, theme swatch
- **Overlay patterns**: modal/sheet treatment should reuse the same surface, border, radius, and typography rules when introduced

### 6. Craft Rules

- Use semantic tokens only; do not inline per-component colors.
- Default to rounded pills for action controls and compact metadata.
- Prefer muted secondary text over placeholder-like low-contrast body text.
- Use mono typography for code, branch names, IDs, timestamps, and machine-like values when appropriate.
- Keep background treatments subtle; gradients are atmospheric, not decorative heroes.

### 7. Anti-Patterns

- No AI-generic purple gradient branding.
- No heavy card shadows used as the primary hierarchy tool.
- No dense admin-table aesthetic unless the surface is explicitly re-scoped for density.
- No component-local palette inventions that bypass the theme object.
- No mixed font logic where code surfaces accidentally inherit proportional UI fonts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can identify the left rail, primary work canvas, and section hierarchy within a few seconds of opening the page.
- **SC-002**: Switching theme variants updates all major surface, text, border, and state treatments consistently without broken contrast.
- **SC-003**: Existing control-plane actions remain usable with keyboard and mouse after the visual refresh.
- **SC-004**: Future contributors can derive layout, theme, and component rules from the feature artifacts without relying on chat history.
- **SC-005**: A future frontend can adopt the same theme contract without changing the documented token categories or component philosophy.
