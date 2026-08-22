# Components, Patterns, and Interactions

## Component Standard

Every reusable component rule names its purpose, product boundary, required/optional slots, forbidden nesting, variants, density, responsive behavior, loading/empty/disabled/selected/error states, keyboard/ARIA/touch behavior, semantic tokens, and reuse/migration notes.

## Interaction Levels

- **Ghost:** navigation, tabs, path nodes, composer footer controls, section actions, icon buttons.
- **Soft:** secondary actions needing persistent visibility.
- **Solid:** one primary commit action for the current view.

Adjacent controls share density without flattening their semantic levels. Destructive menu actions keep icon and text in the same error role.

## Shared Patterns

- Reuse shared shell items, header actions, modal/dialog, table, status, state, and object-detail components before introducing page-local equivalents.
- Business navigation belongs in primary/secondary shell regions; the footer is reserved for account/settings/help utilities.
- Reading sections own horizontal padding. Inner rows and muted panels do not add a second competing inset.
- Header-right add/create actions use the compact ghost baseline when they only open a secondary flow.
- Whole-row or whole-card navigation uses a real link/button with pointer and keyboard behavior; do not nest competing primary links.
- Page, section, panel, and row insets have one owner. The page-level layout container and ordinary modal/composer surface use the 8px baseline; children do not wrap another generic inset unless an explicit reading-body role requires it.
- Empty states use the remaining layout space or a modest 16–32px block inset. They do not manufacture hierarchy with oversized padding.
- Default inline forms use 28px controls. Header/navigation controls remain 28px; 24px compact, 32px action, and 36px stacked-field heights require an explicit component role. Coarse-pointer media rules expand the hit target to 44px.
- Icon-only actions use one shared icon-button primitive and one icon grid. Modal close actions never supply a private glyph, font-size, padding, or stroke; Search, Add Project, Settings, and future dialogs use the same close icon anatomy and accessible label.

## Layout Spacing Semantics

- Page-level layout containers use 8px padding; adjacent sections use an 8px gap.
- Shared UI text uses `UiText` with the bounded `body`, `heading`, or `annotation` variant; consumers choose semantics through `as` but do not supply arbitrary typography values. Shared Section Header and Footer rows are exactly 44px high with 8px horizontal padding, no vertical padding, and 12px text. Static Header headings use `UiSurfaceTitle`, which owns the additional 8px horizontal padding and composes `UiText variant="heading"`; nested sections may select `h3`/`h4` through `as` without changing typography, and consumers do not attach a typography class themselves. Footer action text remains owned by the shared action component. Shared Section Body uses 8px horizontal padding and zero default vertical padding; the feature consumer owns any vertical padding so dividers, scrolling regions, and split panes can reach the Body edges. Consumers may change layout or overflow behavior, but do not override the shared horizontal inset, row heights, or typography.
- Inline elements belonging to one semantic group use a 4px gap. Separate actions, fields, or data groups that merely share a row use an 8px gap.
- Default rows are 28px high, body copy is 12px, and default icons occupy a 16px slot.
- Small headings, annotations, and medium headings remain 12px; weight and semantic color carry hierarchy. Large titles alone use 24px.
- Consumers use shared tokens for these roles. Private margins, transforms, and font sizes are not acceptable substitutes.

## Composer

- New/intake composer uses one bordered card surface and a compact 3-line input.
- The intake logo is a standalone enlarged mark. Do not place redundant product-name copy beside it when the page already establishes Mystra identity.
- The composer owns one 8px inset. Header, body, and footer slots do not add another generic inset or divider.
- Footer stays inside the same padded body, uses transparent ghost styling, and has no separator line or separate filled strip.
- Footer control groups use the shared 4px tight gap.
- Attachment and Project are ghost controls at rest; border/fill appears only for hover, focus, open, selected, or disabled explanation. Project uses the shared dropdown trigger/content/item anatomy and never uses Repository as its UI label.
- Issue selection is not a footer dropdown. After Project selection, repository-scoped Issues appear as compact selectable cards below the input; before Project selection the Issue region is absent.
- Do not reserve a disabled Issue selector or add instructional filler such as “configure a Project before creating a Task.” Disabled dependency order is sufficient when the unavailable control is absent and the next available action is obvious.
- Footer Project and commit controls use the shared 28px inline height. Send is the single solid action; a larger circular variant must be explicitly owned by the immersive intake component rather than treated as the inline default.
- Unsupported API actions remain disabled with a concise explanation.

## Dropdown

- Shared dropdowns use one trigger/content/item component family, with common density, icon grid, padding, surface, radius, motion and selected mark.
- The trigger is a real button with `aria-haspopup="listbox"` and `aria-expanded`; content is a labelled listbox; options expose selected and disabled state.
- Keyboard support includes Arrow Up/Down, Home/End, Escape and Tab. Opening focuses the selected or first enabled option; Escape returns focus to the trigger; outside pointer input closes the popup.
- Page components provide option value, label and optional description but do not restyle menu internals or reproduce dropdown behavior.
- Trigger width and menu alignment follow the owning row. Settings right-side dropdowns use the shared end-aligned menu instead of compensating with private margins or overflow hacks.

## Popup and Popover

- Standard popup/popover content uses exactly 8px padding on all four sides through the shared `--popup-inset` token. Consumers do not override the inset, wrap another padded body around it, or substitute panel/modal padding.
- Popup placement, portal layer, surface, radius, outside click, Escape and focus return belong to the shared primitive. Page code supplies content and alignment only.

## Checkbox

- The shared checkbox visual is exactly 16×16px, matching Mystra's standard icon grid, with a 12×12px theme-stroked check glyph. Keep the native checkbox as the visually hidden semantic/form control behind that shared visual; do not rely on browser-native checkbox anatomy. Its default owning row is 28px high, and the checkbox does not expand to the row hit target.
- Consumers use the shared checkbox primitive without private width, height, transform, browser-native appearance, glyph or padding. Checked, unchecked, disabled and focus states remain owned by the primitive.

## Label

- Shared Labels use standard 12px content text and a 16×16px icon slot. Keys, values and overflow-count controls inherit the same text size; consumers do not shrink individual Label fragments.

## Task Status

- Every Task status icon uses the same circular base and 16×16px visual slot. Pending keeps the empty ring; in progress fills one exact semicircle; handoff, completed and canceled use distinct visible arrow, check and cross marks. Resolve inner marks through a defined theme contrast token, never an undeclared CSS variable.
- Compact workbench cards use an 8px content inset unless a feature explicitly documents another density. Card content does not inherit the 12px generic content inset by accident.

## Sidebar Sections

- Projects and Tasks section headings use text only; they never display counts.
- Projects exposes one ghost plus action aligned right, labelled for accessibility, navigating to the Project creation surface.
- Project and Task rows use the same 28px density and selected-surface feedback as primary navigation.
- Sidebar leading icons, marks, and status indicators use one 16px visual slot. Trailing icons, count badges, and icon buttons use one shared 24px desktop slot with a common right edge; coarse-pointer layouts expand that slot and its interactive control to 44px. Shell icons remain 16px with one stroke and motion template, and badge content is centered inside the slot rather than positioning itself with private margins.
- Collapsed mode removes the sidebar entirely; it does not convert each section into an icon-only rail.

## Settings

- Settings uses the Castrel-derived two-column modal shell, but Mystra owns the tab taxonomy, copy, tokens, and persistence boundaries.
- The default information architecture is `Account`, `Appearance`, `Team`, `Team members`, and `Integrations`. Account, Team, and Team members render their management surfaces inside the Settings modal; Theme and Language belong to Appearance; tenancy uses Team, never workspace.
- `SettingGroup` is transparent, fills the available width, and uses the shared 8px section gap. `SettingRow` also fills the available width, adds 8px horizontal padding, and uses a left 12px/500 title plus description and a right control/status with no private card border, fill, shadow, or extra inset.
- Narrow screens stack each setting row in reading order: title, description, then control. Unsupported Account or Team mutations remain explicit read-only/unavailable states instead of simulated form controls.
- Appearance uses shared dropdown, segmented, range, input, preview, and reset controls. It supports System/Light/Dark, separate light and dark schemes, default/high/color-high border contrast, independent light/dark code surface, contrast, UI/Chat/Code fonts, and UI/Chat sizes.
- Resetting theme details resets contrast, fonts, and sizes for the active scheme; it does not silently reset mode, light/dark scheme selection, border mode, code surface, or language.
- Appearance remains browser-local until a separate persistence feature exists. Never add an API call, database write, success toast, or account-sync implication merely because the controls are editable.

## Tables

- Dense management tables use one shared outer frame, optional header, compact toolbar, low-noise border, table body, search/filter/display/pagination, and card/list switch only when required.
- Page-local duplicate headers, parallel card shells, or second toolbar frames are drift unless the route has a documented non-management model.
- Every standard field definition declares a semantic render type from the shared whitelist: `text`, `datetime`, `icon`, or `labels`. `text` and `datetime` differ only in value rendering/semantics and use the same typography as the row Name; standard fields do not accept consumer typography classes. A genuinely exceptional presentation uses the explicit custom field definition and custom field component instead of extending a standard render type with page-local font, size, weight, or color.
- Stacked table fields may opt into `equalWidth`: resolve one shared track from that field's widest natural content among currently displayed rows, then use the normal column-gap token before the next field. Recompute after filtering, visibility, refresh, or append changes; do not substitute preset pixel widths. Separate equal-width fields may resolve different widths. Icon fields default to equal width. Equal-width fields must form a continuous prefix from the left edge or a continuous suffix to the right edge in canonical field order; field visibility does not change validity, and invalid middle islands are rejected rather than silently rearranged.
- Fields with the same semantic render type reuse one renderer contract. In particular, Updated At and Created At use the same time formatter, locale and options; a consumer does not mix hand-authored relative and absolute date strings in one list.
- Table overflow stays inside the table viewport.
- Empty and loading states consume remaining content space and do not add a decorative tinted card.
- Toolbar and table rows align to a single 8px horizontal inset. Horizontal overflow belongs to the table viewport, not the page frame.

## Master-detail Review Queue

- Inbox uses compact selectable Task cards in the left pane and a read-only selected Task detail in the right pane.
- Selection uses a real button, visible selected surface, and `aria-pressed`; color is not the only state signal.
- Both panes align to the shared header baseline. Desktop panes scroll independently; narrow screens stack list before detail without page-wide horizontal overflow.
- The detail pane may link to the complete Task object page and source Issue, but it does not invent approval or execution write actions.

## States and Feedback

- Distinguish empty data from filtered no-results.
- Loading language does not imply success; async status uses polite live announcements when useful.
- Status components pair signal color with text/icon/accessible name.
- Disabled or permission-limited actions expose the reason when it is not self-evident.
- Primary creation remains in its owning header if already present; do not duplicate it inside the empty state.

## Motion Levels

- L0 static; L1 hover/focus/pressed/disclosure; L2 route/sidebar/modal/loading orientation; L3 immersive intake/workbench only.
- Reduce L1–L3 to essential feedback under `prefers-reduced-motion`.
- Motion never delays command execution, table interaction, or menu opening.

## Accessibility

- Every visible click target is a real interactive element with pointer affordance and visible focus.
- Text inputs, textareas, selects, and their field containers are the exception to the generic focus-ring rule: focus keeps the resting border/surface and adds no accent border, outline, or halo. Caret, selection, native editing behavior, labels, and error state remain available.
- Focus order follows global navigation, page navigation, page actions, then content.
- Icon-only controls have explicit accessible names.
- Dialogs, menus, and popovers have stable labels and keyboard exit behavior.
- Hover-only affordances provide a focus/keyboard fallback.
- Touch-facing hit areas reach 44px even when the desktop visual is compact.
- Color never carries status meaning alone.

## Quality Gate

A component is incomplete if it breaks dark-tech token roles, shared density, responsive layout, keyboard/ARIA behavior, state completeness, component reuse, or introduces private headers/cards where the shared system already solves the problem.
