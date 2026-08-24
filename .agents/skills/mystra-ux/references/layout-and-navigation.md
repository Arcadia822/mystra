# Layout, Shell, and Navigation

## Scope

This file owns Mystra shell structure, header, sidebar, navigation hierarchy, density, page widths, collapse behavior, and responsive degradation. Visual roles belong in `theme-and-tokens.md`; component anatomy belongs in `components-and-interactions.md`.

## Shell

- The global shell is `Sidebar | Main | Right Panel?`; every rendered column owns a `46px` Header and a separate Content region.
- Right Panel is an optional page-owned inspector/action surface. Pages register its header/content through the shared shell seam; pages that do not register it leave no empty track and Main reclaims the width.
- Right Panel collapse is a shell-layout interaction. Its header owns the collapse button; while collapsed, the matching reopen button is the last control in Main Header. The shell removes the panel track so Main reclaims the width. Pages register content only and never copy panel DOM or own collapse state.
- Sidebar brand row, main header, and right-panel header share a `46px` baseline.
- The main header is transparent on the page plane and does not add a default bottom divider.
- Header titles are static labels, not navigation buttons. Route paths, peer tabs, and chrome actions remain separate targets.
- Settings stays in the bottom-left utility slot and opens over the current route.
- Primary navigation is New, Search, Inbox, and Issues. Object pages remain directly addressable without becoming primary entries.
- Search opens as a modal without changing the current route.
- `/automations` remains directly addressable as a Coming soon placeholder until a separate feature owns workflow behavior; it is not a primary navigation entry.
- Projects appear directly after primary navigation. The Projects heading has a compact ghost add action and no count.
- Project-grouped Tasks follow as a separate flexible section. The Tasks heading has no count; Task status icons express latest Session state.
- Main content header displays the current surface/path and current-surface or shell-recovery actions only. Its right side must not expose username, avatar, Team switcher, Account navigation, or a local-environment label; identity and account management belong to their dedicated navigation/settings surfaces.

## Density

- Expanded desktop sidebar width: `300px`; intended drag range: `240–440px`.
- Menu rows: `28px` height, 12px text, 16px icon, 8px horizontal inset, 2px inter-row rhythm.
- Section title rows: `28px`, 12px secondary text, no count metadata, no reserved leading icon slot.
- Header ghost actions and path nodes: `28px` height, 10px horizontal padding, 12px text.
- Default inline form controls are `28px` high. Shared Section Header and Footer rows are `44px`; taller controls require an explicit component role.
- Logo icon, navigation icons, and shell toggle icons share one compact visual grid.
- Selected rows use the selected-surface role without bolding, border pills, or status dots.
- Hover uses background feedback only and must remain visually weaker than selected/active state.
- The shared Shell Main layout is the single owner of the page-level 8px inset at desktop and narrow widths. Feature page roots inside Main default to `padding: 0`; they must not repeat that 8px and accidentally produce a 16px outer gutter. A separately owned reading body may add its documented inner reading inset only when its role is named, and it never compounds the shell inset accidentally.
- Gaps between sections are 8px. Inline elements that form one semantic group use 4px; unrelated inline elements use 8px. Arbitrary spacing is not a substitute for these roles.

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
- Every page family receives its outer 8px inset from Shell Main and owns only its internal 8px section gap. Reading-body and spatial-canvas exceptions must name their inner owner instead of repeating or changing the shell baseline.
- Sibling routes in one page family keep a stable primary width. Optional inspectors sit outside that column rather than resizing it unpredictably.
- Horizontal overflow is allowed inside the specific data region that needs it, never across the whole shell or header.
- Inbox uses a full-width master-detail specialization: a bounded review-card list on the left and the selected Task detail on the right. Desktop keeps both panes visible with independent scrolling; narrow screens stack list before detail.

## Navigation Hierarchy

- Prefer a stable business area plus peer tabs over multiplying primary sidebar entries.
- Primary navigation targets are real route links whose active state derives from the current pathname. Modal-open, selected-item, and utility-view state may decorate navigation but must never suppress a valid route transition; every primary destination must work directly from every other route.
- Do not multiplex route destinations through a shell-local “current view” state. The former Automations → Issues failure is the canonical warning: a navigation item that only works after visiting a third page is structurally broken, not merely missing an onClick.
- Secondary pages reuse the shared shell and switch the header left area to a drill-down path.
- Header-right actions are the preferred entry for create or secondary tools within one business area.
- If several peer views share one create action, expose it once in the shared header.
- Object detail tabs that represent meaningful locations require durable URL state when implemented.

## Responsive Rules

- Above `1024px`, desktop keeps the expanded sidebar unless the operator collapses it.
- At `1024px` and below, the sidebar is a closed-by-default overlay with a shared-header opener, explicit close action, backdrop, focusable navigation, and route-change dismissal.
- Overlay navigation never reserves its desktop width in the content grid and never covers the page on initial load.
- At `700px` and below, an enabled Right Panel stacks after Main and multi-column content stacks. The page container remains 8px; an explicitly owned reading/detail body inset may reduce from 24px to 16px.
- Leaving a route that registered Right Panel removes the panel state immediately; stale panel titles, content, and reserved width must not survive navigation.
- Keep the current primary action visible when possible; move secondary actions into overflow first.
- Dense tables degrade within their data region or into stacked/list presentation rather than forcing page-wide horizontal scroll.
- Compact desktop controls may look smaller, but touch-facing hit areas must reach `44px × 44px`.

## Motion

- Collapse/expand, header-inset swap, hover, selected state, modal open/close, and responsive reflow use compact orientation-preserving motion.
- Use immediate or short confirmation motion for management surfaces; reserve immersive motion for intake/workbench experiences.
- Respect `prefers-reduced-motion` and never delay command execution for animation.
