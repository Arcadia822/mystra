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
- Page, section, panel, and row insets have one owner. A modal section with 12px inline padding does not wrap another generic 12px inset unless the visual hierarchy explicitly requires a 24px reading body.
- Empty states use the remaining layout space or a modest 16–32px block inset. They do not manufacture hierarchy with oversized padding.
- Desktop actions use the Castrel role baselines: 24px compact table/action controls, 28px header/navigation controls, and 32px default actions. Standard form fields use 36px. Coarse-pointer media rules expand the hit target to 44px.

## Composer

- New/intake composer uses one bordered card surface and a compact 3-line input.
- Internal body keeps the Castrel source baseline of top 9px, right 7px, bottom 7px, left 9px, then compensates the textarea right edge and footer right/bottom by 2px so the effective visual inset around content and the 32px send action is 9px on every side.
- Footer stays inside the same padded body, uses transparent ghost styling, and has no separator line or separate filled strip.
- Footer control groups use the shared 4px tight gap.
- Attachment and Project are ghost controls at rest; border/fill appears only for hover, focus, open, selected, or disabled explanation. Project uses the shared dropdown trigger/content/item anatomy and never uses Repository as its UI label.
- Issue selection is not a footer dropdown. After Project selection, repository-scoped Issues appear as compact selectable cards below the input; before Project selection the Issue region is absent.
- Send is the single solid action, 32px circular visual target inside a larger touch affordance when needed.
- Unsupported API actions remain disabled with a concise explanation.

## Dropdown

- Shared dropdowns use one trigger/content/item component family, with common density, icon grid, padding, surface, radius, motion and selected mark.
- The trigger is a real button with `aria-haspopup="listbox"` and `aria-expanded`; content is a labelled listbox; options expose selected and disabled state.
- Keyboard support includes Arrow Up/Down, Home/End, Escape and Tab. Opening focuses the selected or first enabled option; Escape returns focus to the trigger; outside pointer input closes the popup.
- Page components provide option value, label and optional description but do not restyle menu internals or reproduce dropdown behavior.

## Sidebar Sections

- Projects and Tasks section headings use text only; they never display counts.
- Projects exposes one ghost plus action aligned right, labelled for accessibility, navigating to the Project creation surface.
- Project and Task rows use the same 28px density and selected-surface feedback as primary navigation.
- Sidebar leading icons, marks, and status indicators use one 16px visual slot. Trailing icons, count badges, and icon buttons use one shared 24px desktop slot with a common right edge; coarse-pointer layouts expand that slot and its interactive control to 44px. Shell icons remain 16px with one stroke and motion template, and badge content is centered inside the slot rather than positioning itself with private margins.
- Collapsed mode removes the sidebar entirely; it does not convert each section into an icon-only rail.

## Settings

- Settings uses the Castrel-derived two-column modal shell, but Mystra owns the tab taxonomy, copy, tokens, and persistence boundaries.
- The default information architecture is `Account`, `Appearance`, `Team`, and `Integrations`. Theme and Language belong to Appearance; tenancy uses Team, never workspace.
- `SettingGroup` is transparent and uses the shared 32px section rhythm. `SettingRow` uses a left title/description and right control/status with no private card border, fill, shadow, or extra inset.
- Narrow screens stack each setting row in reading order: title, description, then control. Unsupported Account or Team mutations remain explicit read-only/unavailable states instead of simulated form controls.

## Tables

- Dense management tables use one shared outer frame, optional header, compact toolbar, low-noise border, table body, search/filter/display/pagination, and card/list switch only when required.
- Page-local duplicate headers, parallel card shells, or second toolbar frames are drift unless the route has a documented non-management model.
- Table overflow stays inside the table viewport.
- Empty and loading states consume remaining content space and do not add a decorative tinted card.
- Toolbar and table rows align to a single 12px horizontal inset. Horizontal overflow belongs to the table viewport, not the page frame.

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
