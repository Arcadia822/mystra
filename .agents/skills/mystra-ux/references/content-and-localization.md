# Content and Localization

## Baseline

- Framework-owned copy must support Simplified Chinese and English or use a predictable documented fallback during migration.
- Reuse stable product terms from `PRODUCT.md` and `AGENTS.md`; do not invent page-local synonyms for Task, Session, Runner, Project, Team, Issue, Repository, Agent, or workspace.
- `workspace` means the Session-scoped execution directory/context surface, never tenancy.
- Task owns durable intent; Session owns execution lifecycle; Runner is a stable first-class business object.

## Copy Rules

- Use concise, concrete, action-oriented tool language.
- Labels name the object or action directly; helper text explains only what the label cannot.
- Empty states distinguish genuinely empty data from filtered no-results and expose the next meaningful action only when the header does not already own it.
- Disabled actions explain unavailable contracts through a concise tooltip or helper when the reason is not obvious.
- Errors name what failed and the available recovery without exposing irrelevant internals.
- Status labels stay short enough for badges and table cells; details belong in a tooltip, inspector, or object page.
- Provider, protocol, command, branch, repository, and product names may remain English when that is their canonical form.
- Use `Project` for the user-selected Mystra object. Use `Repository` only for the remote repository bound to that Project; a repository full name may appear as supporting description, never as a replacement label.
- Remove helper copy that merely narrates a disabled dependency already expressed by the interface. Guidance earns space only when it explains a non-obvious constraint or a concrete recovery action.
- The product document title is `Mystra`. SEO titles and descriptions derive from the current 5xP product language; never retain Castrel, template, route-internal, or development placeholder copy in public metadata.

## Quality Gate

Copy is complete when Chinese and English values fit compact surfaces, terminology matches the product model, shared nouns are reused, loading does not imply success, errors expose recovery, and narrow-width layouts do not lose the action meaning.
