# Components And Interactions

## Shared Components

- `MenuItem`: sidebar rows, header path nodes, and lightweight navigation actions
  share icon, label, density, hover, selected, and focus rules.
- `Panel`: bounded content group with token-derived background, border, and
  compact header.
- `Row`: dense two-column information row for management and inspection data.
- `Badge`: compact semantic state marker derived from theme roles.
- `Composer`: chatLayout input surface with clear actions and theme-derived
  border/focus.
- `Inspector`: optional right-side panel for context, files, artifacts, or
  review details.

## Interaction Rules

- Icon-only buttons require accessible labels.
- Focus state must be visible in high-contrast and dark themes.
- Hover-only controls need keyboard access.
- Chat inspector can be toggled and resized on desktop.
- Placeholder and read-only states must be honest; do not fake completed
  backend behavior.

## Quality Gates

- No screenshot-only prototype for framework specs.
- No card-in-card nesting for basic shell surfaces.
- No decorative gradients or large hero treatments in operational UI.
- No raw color values in page component rules; use semantic tokens.
