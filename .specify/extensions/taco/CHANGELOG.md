# Changelog

## 0.8.0 - 2026-09-20

- Classify documents only through Taco's built-in Category — the sidebar group control, first-level directory declarations, and the navigation manifest — and stop reading the deprecated `taco_scope` key and the legacy `**Taco scope**:` form entirely; templates, policy, and Agent guidance no longer emit either, and the document property table carries no classification-specific UI (#32).
- Render GitHub repository and issue links in the property table with the GitHub mark, owner/repo label, and public metadata titles; fall back gracefully to the original link offline or when rate-limited, without altering canonical source (#32).
- Order comment threads in the right-hand panel by their anchored position in the active document rather than creation recency; place unresolvable stale threads into an explicit separated group (#34).
- Align comment cards and new-comment composers with their live document anchors, follow document scrolling, and push colliding cards downward with a 12px gap; recalculate after document reflow or card resizing.
- Dismiss the floating selection-comment action when opening its composer, changing selection, clicking or focusing elsewhere, pressing Escape, scrolling, resizing, or leaving the window. Keep selection actions separate from pending comment drafts.
- Keep unsubmitted text in an open comment composer, reply form, or in-place message editor when a document edit rebuilds the panel, restoring focus and caret to the form the reviewer was typing in while closing forms whose content was just committed.
- Resolve Handoff line references through Markdown's rendered text: a comment captured from a reading surface that hides emphasis markers or joins blocks now reports its canonical source line instead of position lost.
- Restate the bundled example specification in terms of Taco's built-in Category and navigation manifest, matching the shipped runtime that no longer routes files by `taco_scope`.
- Replace large-area green background comment highlights with a precise underline over the anchored text, preserving readability across multiline and overlapping ranges (#34).
- Include live 1-based line number ranges (`spec.md:42–46`) computed from current document body text in copied review handoffs; mark unresolvable quotes explicitly as position-lost rather than printing guessed lines (#35).

## 0.7.0 - 2026-09-18
- Back the standalone `taco-cli` client with npm publication as `@tacobin/cli`, alongside the existing GitHub Release standalone binaries.
- Publish the review workflow only when a Taco host is actually needed: the `taco` skill stays fully offline, and `taco-cli` is the cloud publication, subscription, and remote review client.
- Make installing the `taco` skill the default installation: the skill ships its own production shell, whose `#taco-document` block is empty until a document is written into it, plus the `spec`, `architecture`, `api-reference`, and `adr` template packs. Assembly and review then need no CLI, npm package, build, or project modification, and the Spec Kit extension becomes optional project-level wiring taken only on explicit request.
- Assemble and refresh a Taco by writing the `taco/files` bundle into the `#taco-document` block, preserving `docId`, comments, navigation, and per-file identity, and consume the review through the browser Handoff (which does not require saving) or the saved file. The existing `pack`/`sync`/`comments`/`validate` utilities remain available as optional CLI utilities off the required path.
- Proactively open generated or refreshed Taco files in the browser when the host supports and permits local HTML navigation; preserve unsaved reviews, report observed verification separately, and retain clickable-file fallback and Codex's user-click boundary (#31).
- Add runtime-editable sidebar navigation and declarative grouping: create, rename, delete groups, drag files between groups, and declare entry documents.
- Persist navigation declarations to the top-level `navigation` bundle field on save without modifying `files[]` or source hashes.
- Preserve backward compatibility with standard Spec Kit three-stage derivers and default README entry precedence when `navigation` is omitted.
- Sync navigation structure across same-machine collaborative windows via document-level CRDT propagation without protocol migration.

## 0.6.0 - 2026-09-15

- Allow independent desktop outline/comment-panel collapse, restoring each document's desktop preference within the browser session without letting narrow-screen drawers overwrite it. Preserve tabs and comment drafts across toggles, restore focus on close, and leave Escape to active dialogs, menus, and editor handlers.
- Animate desktop right-panel pointer toggles while respecting reduced motion and immediate keyboard interaction. Use one arrowless header icon with a persistent selected state, and remove the redundant in-panel close button.
- Use the same fixed, arrowless left-sidebar icon in its header and collapsed-header controls, without a selected background.
- Open the comments panel and focus the matching thread when an existing inline highlight is clicked, including in read-only copies.
- Preserve reference definitions when adjacent Markdown blocks are deleted, and retain paragraph boundaries when changing block types.
- Include only open requests in copied handoffs, retaining deleted-message placeholders as history. Report unavailable or denied clipboard writes as failures.
- Preserve untouched Markdown blocks, original line endings, and source spacing during review edits and undo; persist edits inside centered HTML rather than restoring stale source.
- Generate applicable unified diffs for empty files, missing final newlines, and large documents without a quadratic-memory matrix. Saving resets the handoff diff baseline.
- Keep enlarged Mermaid source-panel visibility and theme controls synchronized; opening or closing the panel does not edit source. Restore language badge styles outside animation-only rules.
- Scope handoff comment quotes to the selected Mermaid node, source line, or diagram label without altering stored anchors. Direction-only edits preserve raw source and do not persist renderer-default configuration.
- Upgrade Mermaid to 12.0.0 with ELK layout and native theme paint preserved by a scoped SVG/CSS sanitizer.
- Unify standalone Mermaid into a full-width diagram view with an editable, syntax-highlighted floating source card in normal and enlarged views.
- Focus diagram nodes and matching source without opening a composer; an anchored node toolbar and the existing source-selection action create comments explicitly.
- Render unconfigured Mermaid diagrams with `redux` in Taco light mode and `redux-dark` in dark mode without rewriting source merely by opening them. Explicit theme and direction changes preserve custom settings, nested directions, and layout choices.
- Highlight diagram edges with both endpoints, preserve native theme colors, and add subtle node shadows. Ordinary wheel input scrolls; Command-wheel zooms diagrams; left-drag pans without clearing selection.
- Restore Redux Color and Redux Dark Color node fills from Mermaid's palettes, strengthen hover/selection paint, and replace rectangular focus outlines with shape-following feedback.
- Add a live-update switch and manual refresh to the source header. Pausing retains source edits, and fullscreen reuses the same editor and paused preview.
- Offer System, Light, and Dark appearance modes beside the language control, defaulting to System with live OS updates. Global appearance changes synchronize visible Mermaid diagrams: preserve Redux, Redux Color, and Neo families, otherwise use the matching Redux variant. Preserve pending source edits when previews are paused; reader copies change only their rendered appearance.
- Keep standalone Mermaid controls outside the canvas scroll area: long-source paste no longer scrolls the toolbar behind the workspace header.
- Remove the raw codeblock toggle from embedded Markdown Mermaid diagrams; retain their floating source editor and render-failure recovery.
- Fix empty standalone Mermaid enlargement, linked inline-code README migration, and recursively embedded generated Taco files in the production showcase.

## 0.5.0 - 2026-09-09

- Route Taco workflow policy through project process documentation while preserving one durable `AGENTS.md` reference.
- Prevent linked badges and inline Markdown images from crashing editor startup.
- Package validated local PNG assets into self-contained reviews, resolve nested relative Markdown image paths offline, and preserve exact binary bytes during save and sync.

## 0.4.0 - 2026-08-26

- Make every packaged UTF-8 file discoverable exactly once through the canonical stage groups or the `Other files` group.
- Render OpenAPI 3.0 and 3.1 YAML or JSON as an operation-focused overview with consistent metadata tables, API paths, tags, parameters, responses, schemas, security schemes, and servers.
- Render ordinary YAML as highlighted source and standalone Mermaid files with preview, zoom, highlighted source, diagnostics, and safe fallback behavior while preserving canonical text and editor history across view switches.
- Add principal-scoped in-place comment message editing, writable message-level tombstone deletion, deterministic ordering, edited/deleted CLI projections, and sync protocol v3 convergence.
- Prepare the core Spec Kit specification template during installation, using YAML frontmatter that distinguishes logical `feature_id` from an optional verified `git_branch` while preserving customized bodies.
- Preserve replacement-token source text literally when embedding bundle JSON.

## 0.3.1 - 2026-08-25

- Package complete Spec Kit feature directories as portable Taco review files.
- Sync conflict-free human edits and anchored comment threads back to canonical files.
- Refresh Taco files through two Agent commands and eight Spec Kit lifecycle hooks.
- Support Spec Kit 0.16.x and 1.x through the declared `>=0.16.0,<2.0.0` range.
