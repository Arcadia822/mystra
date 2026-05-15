# Implementation Plan: Control-Plane Design System

**Branch**: `[011-control-plane-design-system]` | **Date**: 2026-05-15 | **Spec**: `specs/011-control-plane-design-system/spec.md`
**Input**: Feature specification from `/specs/011-control-plane-design-system/spec.md`

## Summary

Define a global Mystra design system, documented from the Codex-inspired references, with a config-driven theme contract, token hierarchy, component catalog, and adoption rules. `apps/control-plane/app/` is the first implementation surface, but not the scope boundary of the system.

## Technical Context

**Language/Version**: TypeScript 5.9  
**Primary Dependencies**: Next.js 16, React 19  
**Storage**: Browser `localStorage` for theme persistence where implemented; config-driven theme objects in source  
**Testing**: existing `tsc --noEmit`, `vitest`, `next build --webpack`  
**Target Platform**: Desktop-first web UI in the control-plane app  
**Project Type**: Next.js web application  
**Performance Goals**: No functional regressions; lightweight client-side theme switching  
**Constraints**: Document globally, but keep current concrete examples grounded in `apps/control-plane/app/`; preserve current API behavior and operational content  
**Scale/Scope**: One current frontend consumer, but a global design-system contract

## Constitution Check

- **Specification owns product boundaries**: Pass. This is a UI/system refresh only; no MVP boundary expansion.
- **Typed contracts at service boundaries**: Pass. No API or persistence contract changes.
- **Providers are replaceable boundaries**: Pass. Not applicable to this UI-only slice.
- **Runner isolation and secret hygiene**: Pass. No runtime secret handling changes.
- **Verification and documentation before delivery**: Required. Add Spec-Kit artifacts and run focused control-plane verification.

## Project Structure

### Documentation (this feature)

```text
specs/011-control-plane-design-system/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/control-plane/
└── app/
    ├── globals.css
    ├── layout.tsx
    ├── page.tsx
    └── theme-system.ts
```

**Structure Decision**: Keep the design-system artifacts in this feature directory and use control-plane as the first concrete reference implementation.

## Design Direction

- Use the provided Codex screenshots as structural references, not as a palette to copy literally.
- Emphasize quiet navigation, wide whitespace, centered work surfaces, 1px borders, soft container radii, and restrained emphasis.
- Model the theme system after Hue-style semantic tokens: theme config object → derived semantic tokens → component treatments.
- Keep the current documented theme set to one light and one dark baseline; future imports reuse the same contract.

## Design System Specification

### Scope

- **Applies to**: all current and future Mystra web frontends
- **First consumer**: `apps/control-plane`
- **Out of scope for now**: native desktop/mobile-specific component behavior, marketing-site hero design, motion system beyond basic interaction guidance

### Theme Strategy

1. Ship one baseline **light** theme and one baseline **dark** theme.
2. Both themes use the same semantic token surface.
3. Future theme packs are added by importing the same configuration object shape, not by redefining components.

### Typography Strategy

- **UI font**: default Inter/system stack is acceptable unless a future theme overrides it.
- **Code font**: always keep a separate mono-font slot in theme configuration.
- **Mono usage**: code blocks, IDs, branches, timestamps, file paths, structured values, and other machine-oriented text.

### Token Families

- **Typography**: font stacks, heading sizes, body/caption hierarchy
- **Color**: background, surface layers, borders, text hierarchy, accent, semantic states, code surface colors
- **Layout**: spacing scale, canvas widths, section gaps
- **Shape**: control/component/container/pill radii
- **Elevation**: restrained shadow levels only

### Component Boundary

The documented global component set includes:

1. App shell and sidebar rail
2. Section headers and workspace framing
3. Cards, panes, and grouped surfaces
4. Buttons and text/link/destructive variants
5. Inputs, selects, textareas, labels, and form groupings
6. Pills, badges, counters, and semantic state chips
7. Data rows, queue rows, event rows, workflow rows, key-value blocks
8. Code/JSON blocks
9. Theme picker surfaces
10. Future modal/sheet/popover surfaces using the same surface language

### Density Guidance

- Default Mystra desktop density is **wide and breathable**.
- Favor single-column reading order for operational workspaces until a later task explicitly reintroduces multi-column density.
- Use spacing and grouping to create calmness; never fake calmness with oversized decoration.

### Example Adoption Rule

Any future Mystra frontend must:

- accept the shared theme contract
- derive semantic tokens before rendering components
- consume semantic tokens only
- inherit the same typography and density rules unless explicitly re-scoped

## Verification

1. `pnpm --filter @mystra/control-plane typecheck`
2. `pnpm --filter @mystra/control-plane test`
3. `pnpm --filter @mystra/control-plane build`
