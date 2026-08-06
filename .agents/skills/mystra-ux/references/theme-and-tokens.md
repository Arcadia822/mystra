# Foundations, Theme, and Tokens

## Foundation

Mystra uses Castrel-derived operational structure with the dark-tech visual system. The interface is calm, dense, exact, monospaced, and report-like. Hierarchy comes from semantic surfaces, alignment, typography, spacing, and hairlines—not decoration.

## Theme Model

- `dark-tech` is the default explicit scheme and must not be re-derived through seed mixing.
- Selectable alternate themes may remain, but every component consumes semantic roles rather than assuming a concrete palette.
- Theme changes cannot alter the meaning of navigation, status, focus, or emphasis.
- Raw colors belong only in theme definitions, token aliases, approved assets, or external brand content.

## Dark-Tech Palette

- canvas `#111513`
- surface 1 `#181C1A`
- surface 2 `#202522`
- surface 3 `#2B312D`
- primary text `#E7ECE8`
- secondary text `#AAB4AD`
- tertiary text `#76817A`
- hairline strong `rgba(118, 129, 122, 0.30)`
- hairline soft `rgba(118, 129, 122, 0.17)`
- executor/primary/focus `#74B98B`
- keyword `#9478C0`
- number/pending/review `#C7A45C`
- removed/error/destructive `#C36F56`
- type/structure `#499E95`
- function/link/info `#5E86B7`
- string/success/completed `#5CAA76`
- non-destructive attention `#BB6677`

Signal colors are semantic and sparse. Never scatter them as rainbow decoration.

## Token Families

- surfaces: page, sidebar, header, panel, popup, input, selected, emphasis
- text: primary, secondary, muted, disabled, inverse, numeric, status
- borders: soft separator, strong separator, focus, error
- interactions: hover, active, selected, pressed, disabled, focus ring
- semantic: primary, success, warning/review, error/destructive, info, attention
- geometry: compact/action/panel/modal radii, shell gutters, row rhythm, reading insets
- motion: instant, confirmation, orientation, immersive-only
- layer: sticky header, sidebar overlay, popup, drawer, modal, toast

A token family is complete only when it defines relevant default, hover, active/selected, disabled, focus, and error behavior plus contrast expectations.

## Typography

- Use `Fira Code`, `Maple Mono`, then platform programming-monospace fallbacks throughout.
- Every selectable preset keeps the same monospaced UI and code stacks. Theme selection changes semantic color roles, never typography genre.
- Default UI, sidebar labels, table cells, and compact controls: 12px.
- Metadata, badges, section annotations: 10–11px.
- Compact page/section headings: 14px unless the page family requires a stronger title.
- Use tabular figures for counts, ids, timestamps, capacity, and comparisons.
- Selected navigation relies on surface and color, not heavy weight.
- Avoid marketing-scale display typography in the operational control plane.

## Geometry and Depth

- Base grid: 4px; preferred scale: 4, 8, 12, 16, 24, 32, 48, 96px.
- Role spacing: page inline 16px desktop/12px narrow, page top 12px, page bottom 32px, panel/row inline 12px, compact row inline 8px, layout gap 12px, stack gap 8px, tight gap 4px, reading body 24px desktop/16px narrow.
- Do not accumulate outer and inner horizontal insets. The owning section supplies the inset; children align to it.
- Radius scale: 0, 2, 4, 6px. Chips and hairline affordances use 2px; dense rows, panels, and controls use 4px or less; composers, popovers, and modals may use 6px. There is no 3px token.
- Castrel-derived actions use 24px compact, 28px header/navigation, and 32px default role heights; standard fields use 36px; coarse-pointer hit areas reach 44px through responsive target sizing rather than desktop whitespace.
- Page and reader content are E0 on one base plane.
- Sticky separation is E1: a quiet hairline only when needed.
- Popups and floating tools are E2: an elevated surface plus restrained separation.
- Modal/drawer is E3: strongest functional separation, never glossy.
- No gradients, glow, glass, fog, grain, vignettes, cyberpunk neon, or decorative shadows.

## Interaction Color

- Ghost controls change background on hover while label/icon color stays stable.
- Selected navigation may change both label and icon together.
- Hover must never look committed.
- Primary/focus uses executor green; success uses jade; review/pending uses amber; error/destructive uses rust; info/link uses blue; attention uses rose.
- Provider logos, screenshots, and user-authored content may keep real colors; their frames and states still use semantic tokens.

## Icons and Assets

- Reuse one shared brand row and one 16px shell icon grid.
- Product-object icons identify stable object types; status indicators remain separate.
- Shell/navigation/action icons are monochrome by default.
- Keep stroke weight consistent within one surface.
- Empty-state artwork, if used, stays small, quiet, and token-aware.

## Scrollbars and Motion

- Scrollbar styling is global, token-derived, trackless, and low-noise; components do not invent private scrollbar systems.
- Use motion only for orientation, hierarchy, or feedback. Respect reduced motion.

## Theme First Paint

- Persisted theme selection is applied by an inline bootstrap before React hydration and before the first visible paint.
- Server defaults remain a deterministic fallback only. Hydration must not overwrite a saved preset with the default while preferences are still loading.
- The bootstrap and runtime theme application consume the same preset definitions and CSS variable builder; divergent hand-authored token maps are forbidden.
