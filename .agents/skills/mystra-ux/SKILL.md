---
name: mystra-ux
description: Use when refining Mystra UI patterns, shell layout, theme tokens, prototypes, or reusable UX rules for the control plane and Spec-Kit review surfaces.
---

# Mystra UX

Use this skill for Mystra product UI work that needs reusable design-system
guidance rather than one-off page styling.

Mystra UI is a calm, high-contrast, operational control surface for agent-first
workflow orchestration. It should feel like a precise engineering tool: compact
shell, clear lines, token-derived color, stable routes, and reviewable states.

## Workflow

1. Identify the user goal, affected shell/page, route family, required states,
   and whether the change is local or reusable.
2. Read the smallest relevant reference file under `references/`.
3. Apply existing Mystra rules before adding new product language.
4. For cross-page shell, theme, layout, or component decisions, update the
   matching reference file and keep `SKILL.md` as the entrypoint.
5. Validate against light/dark or selectable themes, desktop/narrow layouts,
   keyboard access, and Spec-Kit artifact review.

## Rule Index

- `DESIGN.md`: compact overview of the Mystra design system.
- `tokens.css`: reference token names for prototype and implementation work.
- `references/theme-and-tokens.md`: theme derivation, semantic roles, typography,
  contrast, and color rules.
- `references/layout-and-navigation.md`: shell, sidebar, header, route layouts,
  density, and responsive behavior.
- `references/components-and-interactions.md`: reusable controls, panels, rows,
  badges, chat surfaces, inspectors, and states.

## Stable Rules

- All page colors must resolve from active theme tokens. Do not hardcode visual
  colors inside page components.
- Default theme is high contrast: clear border hierarchy, readable text, and
  visible selected/focus states.
- Sidebar and main header share one compact row height and component language.
- Sidebar menu font size is 14px by default; auxiliary labels may use 12px.
- Main content header stays one fixed row and usually avoids subtitle treatment.
- Settings belongs in the bottom-left shell slot, not in the primary route list.
- `chatLayout` may open a resizable right inspector; `readLayout` uses fixed
  reading width.

## Acceptance Checklist

- Theme tokens cover page, sidebar, header, panel, text, border, hover,
  selected, focus, and semantic status roles.
- Prototype states include normal, selected, hover/focus, placeholder,
  read-only, and inspector-open when relevant.
- Layouts remain stable across `dashboardLayout`, `chatLayout`, and
  `readLayout`.
- Spec View links open the current prototype, not stale screenshot pages.
