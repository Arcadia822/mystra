# Theme And Tokens

## Scope

This file owns Mystra theme derivation, semantic token meaning, contrast,
typography, and color-use rules.

## Theme Model

Mystra themes start from a small seed palette and derive semantic tokens for:

- page, sidebar, header, panel, panel-muted, input
- text, text-secondary, text-muted, text-inverse
- border, border-strong, focus
- primary, primary-hover, primary-soft, primary-text
- success, warning, error
- hover, selected, pressed

Pages and components must consume only derived semantic tokens. Raw palette
values belong in theme definitions or token derivation helpers, not component
CSS.

## Default Theme

The default theme is high contrast. It should use:

- clear border hierarchy between sidebar, header, panels, and content
- readable primary and secondary text
- visible selected navigation state
- obvious focus and active states
- restrained shadows, with lines doing most separation work

## Typography

- Base UI text is 14px.
- Sidebar menu labels use 14px.
- Auxiliary metadata, badges, group labels, and quiet notes may use 12px.
- Main headers stay one compact row and generally avoid subtitle treatment.
- Monospace is reserved for ids, branches, paths, commands, and code-like values.

## Rules

- Do not hardcode page colors in route content, panels, rows, badges, or
  controls.
- Do not express product meaning with palette names such as blue or green.
- Semantic status colors come from theme roles.
- Hover must not look like commitment; selected and pressed states need stronger
  treatment than hover.
- Provider logos, screenshots, and user-authored content may keep their real
  colors, but surrounding shell surfaces still use theme tokens.
