---
name: mystra-ux
description: Use when refining Mystra shell navigation, page layout, spacing, typography, icon sizing, inline forms, New Task intake, Search, Settings, Appearance preferences, sidebar visuals, modal/dropdown behavior, page families, themes, tokens, localization, accessibility, prototypes, or reusable UX rules. Applies Mystra's compact operational layout baseline and Castrel-derived interaction language through Mystra-owned components and product boundaries.
---

# Mystra UX

Mystra UX is the reusable product design-system entrypoint for the control plane. Its structural and interaction language follows the proven Castrel UX system: calm tool density, shared shell first, fixed page families, ghost/soft/solid action levels, complete states, and keyboard parity. Its default visual identity is the Mystra theme family: paired light/dark mineral graphite surfaces, explicit UI/content/code typography roles, restrained semantic signals, crisp rules, and no decorative effects.

## Workflow

1. Collect the design inputs from `references/design-system-overview.md`: user and business goals, affected routes, required states, density, shell impact, responsive behavior, accessibility, localization, and source references.
2. Classify the change. Small page-local polish does not need a new design artifact. A cross-page shell, component-family, or theme change requires a short UX Intent in the active Spec-Kit feature artifact before implementation.
3. Before drawing or implementing any layout, map the surface to the Mandatory Layout Baseline below and read `references/layout-and-navigation.md`. Read `references/theme-and-tokens.md` for type/icon decisions and `references/components-and-interactions.md` for control anatomy.
4. Inspect current Mystra code and verify any named Castrel source before inventing a new pattern. Existing UI is evidence, not authority, when it conflicts with this skill.
5. Reuse Mystra rules for shell density, fully hidden sidebar collapse, header inset, reading/full-bleed page families, action levels, shared components, state completeness, and localization.
6. Map all component colors to semantic roles from the dark-tech token system. Do not copy Castrel's concrete palette.
7. Validate expanded/collapsed shell, loading/empty/full/error/disabled states, keyboard access, and 320/768/1024/1440px widths.
8. Store stable feedback in the smallest relevant reference file. Do not promote one-off polish into a global rule.

## Rule Index

- `tokens.css`: implementation-facing semantic token aliases.
- `references/design-system-overview.md`: scope, principles, inputs, UX Intent, page families, and known gaps.
- `references/layout-and-navigation.md`: shell, header, sidebar, collapse behavior, navigation hierarchy, density, page widths, and responsive rules.
- `references/theme-and-tokens.md`: dark-tech palette, token taxonomy, typography, depth, motion, icons, and assets.
- `references/components-and-interactions.md`: component standards, action levels, composer/table patterns, states, accessibility, and quality gates.
- `references/code-assets.md`: current Mystra source files to inspect before extending the system.
- `references/content-and-localization.md`: Chinese/English copy, terminology, states, and hardcoded-copy migration.
- `references/feedback-iteration.md`: feedback classification, precedence, pressure tests, and conflict decisions.

## Mandatory Layout Baseline

Use this table before designing, reviewing, or implementing any Mystra layout. Start from these values; do not infer geometry from a screenshot or inherit an older page's drift.

| Role | Baseline |
| --- | ---: |
| Sidebar default width | `300px` |
| Shell Main page inset | `8px`; owned once by the shell layout |
| Gap between sections | `8px` |
| Default row height | `28px` |
| Body text | `12px` |
| Default icon | `16px` |
| Default inline form/control height | `20px` |
| Small heading, annotation, and medium heading | `12px`; distinguish with weight and semantic color |
| Large heading | `24px` |
| Gap inside one inline group | `4px` |
| Gap between unrelated inline elements | `8px` |

Any exception must name its role and reason in the active UX Intent or owning component contract. A local override without that explanation is drift.

## Stable Rules

- API, MCP, and CLI remain authoritative; the web UI is a secondary client.
- The shared shell is defined before page-local structure.
- Desktop sidebar width is `300px`; Shell Main supplies the single page-level `8px` inset and feature page roots default to `padding: 0`; section gaps are `8px`; menu rows are `28px / text-12 / icon-16`; shell header is `46px`.
- Collapsing the sidebar hides it completely. Brand, New, and reopen controls move into the main header; no icon rail remains.
- Main Header does not display user identity, avatar, Team switcher, or Account navigation. Its right side is reserved for current-surface actions and shell-owned recovery controls such as reopening Right Panel.
- Route links are authoritative. Local modal, selection, or utility state must not intercept a real navigation target or require an intermediate route before the destination works.
- Configuration and management pages default to a fixed reading width. Spatial workbenches and immersive intake may be full-bleed.
- Ghost is for navigation and lightweight actions, soft for secondary actions, and solid for the current primary commit.
- Reuse shared icon buttons, close glyphs, dropdowns, sidebar visual slots, segmented controls, and range controls. Page-local lookalikes are drift even when their screenshots happen to align.
- Default inline form controls are `20px` high inside a `28px` row. Use `4px` for one inline group and `8px` between unrelated inline elements.
- Appearance is a versioned browser preference until server persistence is explicitly owned. It includes System/Light/Dark mode, separate light/dark schemes, border contrast, code surface, theme details, and first-paint hydration without inventing API or database state.
- The default palette is the paired Mystra light/dark family. Every visible color resolves through semantic tokens; signal colors have one defined meaning each.
- Typography has exactly three internal roles: UI, content, and code. Each role stores one primary family; the runtime appends role-specific browser/system generic fallbacks. A Codex v1 import maps `theme.fonts.ui` to both UI and content, and `theme.fonts.code` to code without extending the external schema.
- All themes keep 0/2/4/6px radii, flat surfaces, quiet hairlines, and no gradients, glow, glass, texture, or decorative shadows.
- New UI copy must provide Chinese and English values or use a predictable fallback while the current shell scaffolding is migrated.

## Acceptance Checklist

- The rule works across expanded/collapsed sidebar, desktop/mobile, keyboard/touch, and light/dark or selectable themes.
- Loading, empty, full, error, disabled, selected, and permission-limited states are explicit where relevant.
- Colors, surfaces, borders, focus, and semantic states come from dark-tech roles rather than page-local values.
- An existing shared component or pattern is reused before a parallel local system is created.
- The layout has been checked against every applicable Mandatory Layout Baseline role; deviations have an explicit owner, role, and reason.
- Direct navigation works from every current route, modal close controls share one icon-button contract, and browser-local preferences survive refresh without pretending to be account settings.
- Cross-page changes update the active Spec-Kit UX Intent and the smallest durable Mystra UX reference.

## Maintenance

- Keep this file as an entrypoint, not a rule dump.
- Preserve Mystra product boundaries and terminology when adapting Castrel patterns.
- Record conflicts explicitly with scope, winner, reason, and superseded guidance.
- Validate the skill folder after material edits.
