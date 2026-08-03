# Layout And Navigation

## Shell

- Sidebar and main header share one compact height: `44px`.
- Header-left navigation and sidebar menu rows use the same component language.
- Main content header is fixed to one row and usually does not render a subtitle.
- Sidebar header, body, and bottom settings slot use the same sidebar surface
  and do not use internal divider lines; the outer sidebar divider is enough.
  Right inspectors follow the same no-internal-divider and same-surface rule
  unless a page-specific component explicitly owns one.
- The main header uses the same page surface as the main content and does not
  draw a global divider below it. Main content separation belongs to page
  components, not to the shell.
- Main content components may choose whether their own panel headers use
  dividers; that choice belongs to the component, not the global shell.
- In side-by-side route layouts, visible panel headers should use the same
  `44px` row height as the shell header so left and right elements align on the
  same vertical rhythm.
- Settings belongs in the bottom-left shell slot, outside the primary route
  list.
- Settings opens as a modal component over the current route, not as a route
  page. Opening or closing Settings should not change the active route.
- The bottom-left slot should not contain status prose or ambient text.
- Persistent sidebars should support both full and icon-collapsed states. The
  collapsed state keeps recognizable icon affordances visible and hides labels,
  metadata, and ambient prose instead of removing the rail entirely.
- Shell headers may place a product logo placeholder on the left and collapse
  toggles on the far right. When collapsed, menu icons remain centered in a
  stable square hit target and selected state uses the ghost background without
  adding a border line.
- Sidebar header icon and title baselines align to menu row geometry: the logo
  occupies the same 18px icon column, the title uses 14px menu text sizing, and
  the far-right toggle is an evenly padded square icon button whose icon size
  matches menu item icons. The toggle hit target may show hover padding, but its
  right edge aligns to the menu row content edge.
- Sidebar section rhythm uses one compact shell gap. The header-to-first-group
  spacing and group-to-group spacing should match the main header-to-content
  spacing.
- Header route titles and inspector titles are static labels, not navigation
  buttons. Keep the shell toggle controls separate from title text.
- Split-pane resize handles should preserve cursor and hit target behavior
  without showing hover fills or visible heat-zone chrome.
- Framework-level header actions should stay icon-only when the action is a
  shell chrome toggle. Avoid exposing prototype-only actions such as theme
  switchers, run buttons, or layout meta labels in the shared shell header.

## Sidebar

- Default sidebar width is `260px`, with desktop drag resizing when expanded.
- Sidebar menu rows use 14px text and compact 28px row height.
- Group labels may use 12px muted text.
- Selected state uses token-derived selected background plus primary text/icon.
- Framework shell menus should only list primary routes. Secondary routes such
  as project detail and recent jobs remain addressable but do not have to appear
  in the main menu.
- Sidebar menu rows should not use right-side microcopy to explain the route
  layout type. Keep layout taxonomy in the spec/prototype docs, not inside the
  operational navigation rows.
- Project grouping remains visible below the primary route list when the shell
  needs project context. Project entries and their job list use ordinary menu
  rows, without layout metadata badges.

## Route Layouts

- `dashboardLayout`: two-column scanning surface when width allows; stacks on
  narrower screens.
- `chatLayout`: immersive work-intake surface with bottom composer. It may open a
  resizable right inspector; the left and right widths must be adjustable on
  desktop. The right inspector opens beside the whole main area, spans the full
  shell height, and uses the same outer divider treatment as the left sidebar.
  When closed, it is removed completely rather than leaving an icon rail or
  residual vertical strip.
- `readLayout`: fixed reader width for project, inbox, and
  documentation-like inspection surfaces. When no right inspector is open, the
  reader column is centered in the available main content area.
- Framework specs such as `025-webui` show layout placeholders only. Do not put
  page business content, sample metrics, fake messages, configuration data, or
  product-specific rows into framework-level prototypes.
- Framework-level placeholders should be page-level blocks. Use one large
  placeholder per route content region, sized by the route width, instead of
  composing fake component grids, rows, messages, or business sections.

## Motion

- Every visible interaction should animate enough to preserve orientation:
  route changes, hover, selected state, theme switching, right-inspector open and
  close, placeholder entry, and resizable split-pane feedback.
- Motion should stay functional and compact, not decorative. Respect
  `prefers-reduced-motion`.

## Responsive Behavior

- Desktop keeps sidebar persistent.
- Narrow screens may collapse sidebar content before forcing page-level
  horizontal scroll.
- Horizontal drag handles belong to the relevant split pane, not the whole shell.
