---
name: mystra-ux
description: Use when refining Mystra UI patterns, shell navigation, page families, component behavior, theming, tokens, localization, accessibility, prototypes, or reusable UX rules. Applies Castrel's compact operational interaction language with the dark-tech color system.
---

# Mystra UX

Mystra UX is the reusable product design-system entrypoint for the control plane. Its structural and interaction language follows the proven Castrel UX system: calm tool density, shared shell first, fixed page families, ghost/soft/solid action levels, complete states, and keyboard parity. Its default visual palette is dark-tech: mineral graphite surfaces, monospaced typography, restrained semantic signals, crisp rules, and no decorative effects.

## Workflow

1. Collect the design inputs from `references/design-system-overview.md`: user and business goals, affected routes, required states, density, shell impact, responsive behavior, accessibility, localization, and source references.
2. Classify the change. Small page-local polish does not need a new design artifact. A cross-page shell, component-family, or theme change requires a short UX Intent in the active Spec-Kit feature artifact before implementation.
3. Read only the relevant reference files and inspect the current code assets before inventing a new pattern.
4. Reuse Mystra rules for shell density, fully hidden sidebar collapse, header inset, reading/full-bleed page families, action levels, shared components, state completeness, and localization.
5. Map all component colors to semantic roles from the dark-tech token system. Do not copy Castrel's concrete palette.
6. Validate expanded/collapsed shell, loading/empty/full/error/disabled states, keyboard access, and 320/768/1024/1440px widths.
7. Store stable feedback in the smallest relevant reference file. Do not promote one-off polish into a global rule.

## Rule Index

- `DESIGN.md`: compact product-facing design-system overview.
- `tokens.css`: implementation-facing semantic token aliases.
- `references/design-system-overview.md`: scope, principles, inputs, UX Intent, page families, and known gaps.
- `references/layout-and-navigation.md`: shell, header, sidebar, collapse behavior, navigation hierarchy, density, page widths, and responsive rules.
- `references/theme-and-tokens.md`: dark-tech palette, token taxonomy, typography, depth, motion, icons, and assets.
- `references/components-and-interactions.md`: component standards, action levels, composer/table patterns, states, accessibility, and quality gates.
- `references/code-assets.md`: current Mystra source files to inspect before extending the system.
- `references/content-and-localization.md`: Chinese/English copy, terminology, states, and hardcoded-copy migration.
- `references/feedback-iteration.md`: feedback classification, precedence, pressure tests, and conflict decisions.

## Stable Rules

- API, MCP, and CLI remain authoritative; the web UI is a secondary client.
- The shared shell is defined before page-local structure.
- Desktop sidebar width is `300px`; menu rows are `h-7 / text-12`; shell header is `46px`.
- Collapsing the sidebar hides it completely. Brand, New, and reopen controls move into the main header; no icon rail remains.
- Configuration and management pages default to a fixed reading width. Spatial workbenches and immersive intake may be full-bleed.
- Ghost is for navigation and lightweight actions, soft for secondary actions, and solid for the current primary commit.
- The default palette is dark-tech. Every visible color resolves through semantic tokens; signal colors have one defined meaning each.
- Use monospaced typography, 0/2/4/6px radii, flat surfaces, quiet hairlines, and no gradients, glow, glass, texture, or decorative shadows.
- New UI copy must provide Chinese and English values or use a predictable fallback while the current shell scaffolding is migrated.

## Acceptance Checklist

- The rule works across expanded/collapsed sidebar, desktop/mobile, keyboard/touch, and light/dark or selectable themes.
- Loading, empty, full, error, disabled, selected, and permission-limited states are explicit where relevant.
- Colors, surfaces, borders, focus, and semantic states come from dark-tech roles rather than page-local values.
- An existing shared component or pattern is reused before a parallel local system is created.
- Cross-page changes update the active Spec-Kit UX Intent and the smallest durable Mystra UX reference.

## Maintenance

- Keep this file as an entrypoint, not a rule dump.
- Preserve Mystra product boundaries and terminology when adapting Castrel patterns.
- Record conflicts explicitly with scope, winner, reason, and superseded guidance.
- Validate the skill folder after material edits.
