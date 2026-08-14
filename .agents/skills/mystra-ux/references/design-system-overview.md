# Design System Overview

## Purpose

Mystra UX is the product UI contract for durable decisions across the control-plane shell, route families, tokens, components, states, and interaction behavior. It carries Castrel's operational UX structure into Mystra while the dark-tech system owns concrete color and visual material.

## Principles

- **Calm tool density:** prefer compact, scannable, low-noise surfaces over marketing presentation.
- **Shared shell first:** navigation, headers, paths, page actions, and secondary flows reuse one shell model.
- **Product boundaries first:** Task, Session, Runner, Project, Team, Issue, Repository, Agent, and runtime concepts keep their Mystra meanings.
- **Semantic tokens before color:** map UI meaning to dark-tech roles before choosing a concrete value.
- **Reuse over sameness:** shared components preserve behavior, density, states, and accessibility without making every route visually identical.
- **State completeness:** rules must survive loading, empty, no-results, dense content, error, disabled, and permission-limited states.
- **Input parity:** pointer, keyboard, screen-reader, and touch users receive equivalent access to primary flows.
- **Programmable truth:** API, MCP, and CLI remain authoritative; UI behavior must not create new platform semantics.
- **Baseline before composition:** every layout begins by mapping page padding, section gaps, rows, typography, icons, inline controls, and inline grouping to the Mandatory Layout Baseline in `SKILL.md`. Existing screens do not silently override it.

## Reference Map

| Layer | Source | Use for |
| --- | --- | --- |
| Scope and inputs | `design-system-overview.md` | deciding what system layer applies |
| Shell and page families | `layout-and-navigation.md` | sidebar/header behavior, density, width, responsive layout |
| Visual foundations | `theme-and-tokens.md` | dark-tech palette, semantic roles, typography, depth, motion |
| Components and states | `components-and-interactions.md` | reusable anatomy, variants, interactions, accessibility |
| Code mapping | `code-assets.md` | locating current implementation before adding patterns |
| Content | `content-and-localization.md` | Chinese/English labels, terms, states, errors |
| Governance | `feedback-iteration.md` | deciding whether feedback becomes a durable rule |

## Design Inputs

Collect the user goal, business goal, affected routes and objects, required states, content density, navigation depth, API availability, responsive impact, keyboard/touch requirements, localization impact, current Mystra rules, explicit user feedback, and named source implementations. Before sketching, record which baseline roles apply: `300px` sidebar, `8px` page padding, `8px` section gap, `28px` rows, `12px` body/headings/annotations, `16px` icons, `20px` inline controls, `24px` large titles, and `4px` grouped versus `8px` ungrouped inline gaps.

## Page Families

- **Intake / chat:** full-width or immersive, centered task composer, optional inspector.
- **Management / configuration:** fixed reader-width container with shared toolbar, forms, tables, and pagination.
- **Object detail:** shared shell path/header plus stable reading column and optional inspector.
- **Workbench / spatial:** full-bleed canvas or dense data region with explicit internal rails.
- **Modal utility:** search, settings, confirmations, and short secondary flows that do not change route identity.

Do not mix centered reader blocks with full-bleed regions on the same route unless the mode change is intentional and obvious.

## UX Intent

Small page-local polish does not need a new artifact. Cross-page shell, theme, component-family, navigation, or page-family changes must add a short UX Intent to the active Spec-Kit feature artifact covering the experience problem, affected surfaces/states, reused and revised rules, responsive/accessibility impact, risks, and validation signals.

## Known Gaps

- The control plane has no formal Storybook or automated accessibility suite.
- Localization is currently shell scaffolding rather than a complete paired locale system.
- Sidebar drag resizing is a durable target but is not yet implemented in the current shell.
- Shared component ownership is emerging under `apps/control-plane/app/_components`; verify source before assuming a component contract.
