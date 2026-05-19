# Mystra Control Plane Brand Spec

Source observed from `apps/control-plane/app/globals.css`, `apps/control-plane/app/theme-system.ts`, and `specs/025-webui/screenshots/01-overview.png`.

## Core tokens

```css
:root {
  --bg:      oklch(97.5% 0.005 106.5);
  --surface: oklch(100% 0 89.9);
  --fg:      oklch(25.4% 0.011 254.0);
  --muted:   oklch(49.9% 0.013 149.7);
  --border:  oklch(91.8% 0.011 95.2);
  --accent:  oklch(57.3% 0.199 261.8);
}
```

Derived support tones already present in the product system:

- `--accent-soft`: `oklch(96.2% 0.018 261.3)`
- `--border-visible`: `oklch(87.0% 0.014 93.0)`

## Typography

- Display/UI: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Body: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Mono: `"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

## Layout posture rules

1. Use a cool light-gray desktop canvas with a slightly deeper left rail and brighter central sheets.
2. Favor border-and-spacing hierarchy over shadows; shadows should be soft and rare.
3. Reserve blue accent for primary action, selected state, and sparse data emphasis only.
4. Keep radii restrained: shell panels around `20px`, controls around `14px`, pills fully rounded.
5. Treat the UI as an operations shell for agent workflows, not a marketing surface: no hero graphics, no decorative gradients, no explanatory sidebars competing with the main task.
