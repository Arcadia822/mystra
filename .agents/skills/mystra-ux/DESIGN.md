---
name: Mystra Operational Dark Tech
description: Castrel-derived operational UX structure with a dark-tech mineral graphite visual system for Mystra.
version: 3.0.0
color-scheme: dark
---

# Mystra Operational Dark Tech

Mystra combines Castrel's compact operational UX language with the dark-tech design system. The result is a dense agent control surface that behaves like a disciplined workbench and looks like an engineering report—not a marketing dashboard that discovered a gradient generator.

## Product Language

- Shared shell first: sidebar, header, route path, page actions, and responsive degradation use one system.
- Calm tool density: compact rows, precise alignment, low-noise states, and short copy.
- Page-family discipline: management/configuration uses reading width; immersive intake and spatial workbenches may use full width.
- Complete interaction: every component owns loading, empty, full, error, disabled, selected, keyboard, and touch behavior relevant to it.
- Honest control plane: unavailable API-backed actions remain visibly unavailable rather than simulating success.

## Shell Geometry

- Header and expanded sidebar brand row: `46px`.
- Expanded desktop sidebar: `300px`, with future drag range `240–440px`.
- Sidebar menu row: `28px`, 12px text, 16px icon.
- Collapsed sidebar: `0px`; brand, New, and reopen controls move into the main header.
- Compact header/navigation action: `28px` height, `10px` horizontal padding, 12px text.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 96px.
- Radius scale: 0, 2, 4, 6px. Pills require an intrinsically circular or state-chip reason.
- Page inset: 16px horizontal on desktop, 12px on narrow screens, 12px top, and 32px bottom.
- Panel and row inset: 12px horizontal; compact rows may use 8px. Nested surfaces must not stack both insets.
- Layout gap: 12px; stack gap: 8px; tight relationship: 4px.
- Castrel-derived actions use three role sizes: 24px compact, 28px header/navigation, and 32px default. Standard form fields use 36px. Coarse-pointer targets reach 44px without inflating desktop layout.
- Dense rows and controls use 2px or 4px radii; elevated dialogs, popovers, and the composer may use 6px. The scale has no 3px stop.
- At `1024px` and below the sidebar becomes a closed-by-default overlay opened from the shared header; it never remains beside a compressed content column.

## Dark-Tech Palette

| Role | Value |
| --- | --- |
| Canvas | `#111513` |
| Surface 1 | `#181C1A` |
| Surface 2 | `#202522` |
| Surface 3 | `#2B312D` |
| Hairline | `rgba(118, 129, 122, 0.30)` |
| Hairline soft | `rgba(118, 129, 122, 0.17)` |
| Primary text | `#E7ECE8` |
| Secondary text | `#AAB4AD` |
| Tertiary text | `#76817A` |
| Executor / primary | `#74B98B` |
| Keyword | `#9478C0` |
| Number / pending | `#C7A45C` |
| Removed / error | `#C36F56` |
| Type | `#499E95` |
| Function / info | `#5E86B7` |
| String / success | `#5CAA76` |
| Attention | `#BB6677` |

Signal colors are semantic, never decorative. Executor green owns primary action and focus; jade owns success; amber owns pending/review; rust owns error/destructive; blue owns information; rose owns non-destructive attention.

## Typography and Surfaces

- Use Fira Code, Maple Mono, then platform monospace fallbacks throughout the UI.
- Default UI and sidebar labels use 12px; metadata uses 10–11px; compact headings use 14px.
- Build hierarchy with spacing, surface shifts, alignment, typography, and hairlines.
- Panels and controls are flat. Popovers/modals may use restrained elevation only when their layer requires it.
- No gradients, glow, glass, fog, grain, textures, cyberpunk neon, decorative shadows, or ornamental borders.

## Component Levels

- Ghost: navigation, tabs, composer footer controls, path nodes, icon actions.
- Soft: secondary actions needing persistent visibility.
- Solid: one primary commit action for the current view.
- Composer: compact bordered surface; 3-line input; `9/7/7/9px` internal padding; footer is transparent with no divider.
- Table: one shared outer frame, compact toolbar, strict columns, quiet hover, and horizontal overflow limited to the data region.

## Quality Bar

Accept only UI that preserves shell continuity, dark-tech semantic tokens, compact density, readable focus, state completeness, localization, keyboard access, responsive behavior, and Spec-Kit traceability.
