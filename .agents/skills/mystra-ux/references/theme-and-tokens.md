# Foundations, Theme, and Tokens

## Foundation

Mystra uses Castrel-derived operational structure with the dark-tech visual system. The interface is calm, dense, exact, monospaced, and report-like. Hierarchy comes from semantic surfaces, alignment, typography, spacing, and hairlines—not decoration.

## Theme Model

- Mystra is the deterministic server fallback and default theme family. It provides explicit light and dark variants under the shared `codeThemeId: "mystra"`; the dark variant preserves the former Graphite token values.
- Selectable alternate themes may remain, but every component consumes semantic roles rather than assuming a concrete palette.
- Theme changes cannot alter the meaning of navigation, status, focus, or emphasis.
- Raw colors belong only in theme definitions, token aliases, approved assets, or external brand content.
- Codex theme import/export uses `codex-theme-v1:{JSON}`. The prefix is the schema version; `codeThemeId` inside JSON is the canonical theme id. Never add a parallel `id` field or use `codex-theme-v1` as an id.
- Resolve a selected theme by `(variant, codeThemeId)`: the same `codeThemeId` may provide light and dark variants. Mystra-only label, description, and explicit token extensions stay outside the Codex v1 payload.
- The bundled Codex catalog must come from a named local Codex app build, preserve Codex family ids and supported variants, and record the source version beside the data. Do not substitute a community-maintained or remembered theme list.
- Store Appearance as one versioned browser preference object, not scattered keys. Normalize damaged JSON, unknown enum values, non-finite or out-of-range numbers, and light/dark scheme mismatches field by field.
- Resolve active appearance in this order: mode plus `prefers-color-scheme`, matching light/dark scheme, base theme definition, then detail overrides. Keep one media listener and remove it on cleanup.
- Border mode, code surface, contrast, fonts, and sizes emit semantic CSS variables. Settings controls do not calculate palettes or manipulate document styles directly.
- Until a persistence feature explicitly owns it, Appearance uses local browser storage only. No API, RDB, Team, or account contract is implied.

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

- Mystra light and dark use three internal font roles: UI=`Arial`, content=`Georgia`, code=`Courier New`.
- Store only one primary family per role. CSS appends browser/system fallbacks by role: UI → `system-ui, sans-serif`; content → `ui-serif, serif`; code → `ui-monospace, monospace`. Do not persist or hand-author platform-specific family chains.
- `codex-theme-v1` remains strict and exposes only `theme.fonts.ui` and `theme.fonts.code`. The adapter maps the imported UI primary family to both Mystra UI and content roles, and maps the imported code primary family to code. Never add `content` to the v1 JSON.
- When a Codex font contains a family list, normalize only its first primary family for Mystra runtime use; exact parser/serializer round-trip retains the original external payload.
- Legacy saved Graphite stacks migrate to the new Mystra role defaults. A deliberately saved single family such as `Fira Code` remains valid.
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
- A legacy single-theme key may be migrated once, but current writes use only the versioned Appearance object. Storage failure falls back to deterministic CSS and keeps the current tab usable.
- Legacy synthetic preset ids may be accepted only at the parse/bootstrap migration boundary. `graphite-signal` migrates to `dark:mystra`; retired custom presets must map to a valid canonical replacement. Normalized preferences, Settings option values, and DOM datasets emit `codeThemeId`.
