# Code Assets

## Theme and Tokens

- `apps/control-plane/app/theme-system.ts` owns selectable theme definitions, explicit dark-tech/Graphite tokens, derived CSS variables, and document application.
- `apps/control-plane/app/globals.css` owns runtime shell, component, responsive, focus, and reduced-motion CSS.
- `.agents/skills/mystra-ux/tokens.css` maps implementation variables to stable Mystra semantic aliases.
- `.agents/skills/mystra-ux/DESIGN.md` is the compact design-system overview, not a substitute for runtime source inspection.

## Shared Components

- `apps/control-plane/app/_components/app-shell.tsx` owns primary navigation, Projects/Tasks sections, collapse state, header inset, settings, and search modal integration.
- `apps/control-plane/app/_components/shell-icons.tsx` owns the shared compact icon grid.
- `apps/control-plane/app/_components/shell-search-dialog.tsx` owns modal Task search.
- `apps/control-plane/app/_components/new-task-composer.tsx` owns the New intake surface and canonical Task submission.
- `apps/control-plane/app/_components/inbox-master-detail.tsx` owns the Inbox review queue and selected Task detail surface.
- `apps/control-plane/app/_components/task-table.tsx` owns the Issues table surface.
- `apps/control-plane/app/_components/shell-settings.tsx` owns theme and locale preferences.
- `apps/control-plane/app/_components/states.tsx`, `status-badge.tsx`, and project object-page components are the first reuse candidates for loading, empty, status, and form behavior.

## Product and Spec Sources

- `PRODUCT.md`, `PLATFORM.md`, and `AGENTS.md` own durable product boundaries and vocabulary.
- `specs/025-webui/` owns the active shell/navigation/theme implementation contract and browser verification scenarios.
- Castrel source may be used as a structural interaction reference only when the user names it or the active Mystra UX rule calls for it; adapt paths, terminology, API truth, and dark-tech colors rather than importing Castrel business behavior.

## Missing Links

Do not claim formal Storybook, Figma mapping, token package, component changelog, accessibility automation, or complete i18n infrastructure until those assets exist in this repository.
