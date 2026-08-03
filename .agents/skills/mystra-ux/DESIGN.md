# Mystra UX Design System

> Category: Agent orchestration control plane
> Surface: web control plane, Spec-Kit review prototypes

Mystra UX is an operational design system for coordinating coding agents,
runner execution, repository artifacts, and Spec-Kit review flows. It favors
clarity, density, and exact state communication over decorative presentation.

## Principles

- Agent-first management: UI explains and operates, but API/MCP/CLI remain the
  management facts.
- High-contrast tool surface: default theme uses clear separators, readable
  text, and obvious selected/focus states.
- Token-derived color: pages consume semantic tokens, never page-local palette
  decisions.
- Shared shell before page invention: sidebar, header, layout archetypes,
  settings slot, and route framing are framework concerns.
- Reviewable states: placeholder and read-only states are first-class while
  page-specific specs are pending.

## Layout Families

- `dashboardLayout`: scan-heavy operational summaries.
- `chatLayout`: work intake and conversational execution surfaces; may open a
  resizable right inspector.
- `readLayout`: configuration, settings, project, and inbox-like reading
  surfaces with fixed reading width.

## Token Roles

- Surface: page, sidebar, header, panel, panel-muted, input.
- Text: primary, secondary, muted, inverse.
- Border: default, strong, focus.
- Interaction: hover, selected, pressed.
- Semantic: primary, success, warning, error.

## Quality Bar

A Mystra UI artifact is acceptable only if it preserves theme derivation,
compact shell density, clear route ownership, keyboard-reachable controls,
responsive layout behavior, and Spec-Kit artifact traceability.
