# Layout, Shell, and Navigation

## Scope

This file owns Mystra shell structure, header, sidebar, navigation hierarchy, density, page widths, collapse behavior, and responsive degradation. Visual roles belong in `theme-and-tokens.md`; component anatomy belongs in `components-and-interactions.md`.

## Shell

- Sidebar brand row and main header share a `46px` baseline.
- The main header is transparent on the page plane and does not add a default bottom divider.
- Header titles are static labels, not navigation buttons. Route paths, peer tabs, and chrome actions remain separate targets.
- Settings stays in the bottom-left utility slot and opens over the current route.
- Primary navigation is New, Search, Inbox, Issues, and Automations. Object pages remain directly addressable without becoming primary entries.
- Search opens as a modal without changing the current route.
- Automations remains presentation-only until a separate feature owns workflow behavior.
- Projects appear directly after Automations. The Projects heading has a compact ghost add action and no count.
- Project-grouped Tasks follow as a separate flexible section. The Tasks heading has no count; Task status icons express latest Session state.
- Main content header displays only the current surface/path; it does not expose a local-environment label.

## Density

- Expanded desktop sidebar width: `300px`; intended drag range: `240–440px`.
- Menu rows: `28px` height, 12px text, 16px icon, 8px horizontal inset, 2px inter-row rhythm.
- Section title rows: `28px`, 12px secondary text, no count metadata, no reserved leading icon slot.
- Header ghost actions and path nodes: `28px` height, 10px horizontal padding, 12px text.
- Logo icon, navigation icons, and shell toggle icons share one compact visual grid.
- Selected rows use the selected-surface role without bolding, border pills, or status dots.
- Hover uses background feedback only and must remain visually weaker than selected/active state.
- Page frames use 16px horizontal inset on desktop and 12px on narrow screens, with 12px top and 32px bottom breathing room.
- Primary layout gaps are 12px, vertical stacks are 8px, and tightly related icon/label groups are 4px. Arbitrary 5/7/9/10/13/14/18/20/22/28px spacing is not a substitute for a role token; the documented composer inset is the exception.

## Sidebar Collapse

- Collapse fully hides the sidebar at `0px`; never leave a narrow icon rail.
- The hidden sidebar uses opacity/translation and pointer/ARIA suppression during the orientation-preserving transition.
- In collapsed mode, the main header becomes the stable entry point for the shared brand row, New icon action, and reopen action.
- The collapsed header inset preserves the expanded brand alignment and keeps a clear gap before the current page title.
- Expanding restores the complete sidebar and removes the header inset rather than duplicating controls.
- Collapse state may persist locally as a UI preference; it does not affect route or business state.
- Even full-bleed intake/workbench pages remain mounted under the shared header so reopen is always available.

## Page Widths

- **Reading width:** default for Projects, object detail, settings, forms, Issues, tables, and management/configuration routes.
- **Full bleed:** reserved for spatial workbenches, canvases, dense data surfaces, and immersive intake/chat layouts.
- **Modal utility:** search, settings, confirmations, and short secondary flows that do not own route identity.
- Sibling routes in one page family keep a stable primary width. Optional inspectors sit outside that column rather than resizing it unpredictably.
- Horizontal overflow is allowed inside the specific data region that needs it, never across the whole shell or header.
- Inbox uses a full-width master-detail specialization: a bounded review-card list on the left and the selected Task detail on the right. Desktop keeps both panes visible with independent scrolling; narrow screens stack list before detail.

## Navigation Hierarchy

- Prefer a stable business area plus peer tabs over multiplying primary sidebar entries.
- Secondary pages reuse the shared shell and switch the header left area to a drill-down path.
- Header-right actions are the preferred entry for create or secondary tools within one business area.
- If several peer views share one create action, expose it once in the shared header.
- Object detail tabs that represent meaningful locations require durable URL state when implemented.

## Responsive Rules

- Above `1024px`, desktop keeps the expanded sidebar unless the operator collapses it.
- At `1024px` and below, the sidebar is a closed-by-default overlay with a shared-header opener, explicit close action, backdrop, focusable navigation, and route-change dismissal.
- Overlay navigation never reserves its desktop width in the content grid and never covers the page on initial load.
- At `700px` and below, multi-column content stacks and page inline inset reduces to 12px; reading/detail body inset reduces from 24px to 16px.
- Keep the current primary action visible when possible; move secondary actions into overflow first.
- Dense tables degrade within their data region or into stacked/list presentation rather than forcing page-wide horizontal scroll.
- Compact desktop controls may look smaller, but touch-facing hit areas must reach `44px × 44px`.

## Motion

- Collapse/expand, header-inset swap, hover, selected state, modal open/close, and responsive reflow use compact orientation-preserving motion.
- Use immediate or short confirmation motion for management surfaces; reserve immersive motion for intake/workbench experiences.
- Respect `prefers-reduced-motion` and never delay command execution for animation.
