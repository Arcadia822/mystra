# Taco Spec Kit extension

Installing this extension installs Taco into one initialized Spec Kit project. The installed directory contains the Agent commands, lifecycle hooks, offline CLI, and self-contained browser shell; the target project does not need another Taco package, service, account, or build.

```text
canonical feature directory -> in-directory Taco -> human edits/comments
                            <- Agent review and canonical updates <-
```

## Local installation

Run from the exact initialized Spec Kit project that should receive Taco:

```bash
specify extension add --dev /absolute/path/to/taco/extensions/taco
specify extension list
```

The supported Taco source checkout already contains the production shell at `extensions/taco/assets/taco-shell.html`. Spec Kit copies that shell and the CLI into `.specify/extensions/taco/`, and registers both commands with the project's active Agent integration. No target-project npm installation is involved.

The installing Agent must then merge the installed [`policies/taco-agent-policy.md`](policies/taco-agent-policy.md) into the target project's existing `AGENTS.md` without replacing unrelated instructions. Plugin installation is not complete until that durable prompt is present. It governs later `speckit.specify` work: new specs use YAML `title`, omit a duplicate H1, and begin the body at H2; routed custom Markdown uses YAML `taco_scope`. The policy also requires Taco update after every canonical feature-artifact change and the review-comment round trip; it does not restate packer's built-in Taco-output exclusion.

## Agent commands

```text
speckit.taco.update [feature-directory] [--ignore path-or-glob]...
speckit.taco.review [path-to-file.taco.html]
```

`update` creates or refreshes `<feature-directory>/<feature-name>.taco.html`. Mandatory hooks invoke it after `specify`, `clarify`, `plan`, `checklist`, `tasks`, `analyze`, `implement`, and `converge`. Its Agent contract also requires an update after a feature artifact is changed outside those lifecycle commands. It always presents the result through the Agent GUI's native clickable local-file surface. In Codex, the user click opens that file in Browser; the Agent does not attempt autonomous `file://` navigation. Another GUI may additionally open and verify the Taco only when it explicitly supports local HTML navigation.

`review` previews a saved Taco import, imports conflict-free direct edits, gives every open comment and its complete history to the Agent, and requires the Agent to edit canonical files before invoking `update` on the same Taco. The refreshed Taco is then exposed through the same native clickable-file presentation step.

## Installed CLI

The same deterministic operations are available without an Agent:

```bash
node .specify/extensions/taco/bin/taco.mjs pack specs/001-example \
  --project-root "$PWD" \
  --ignore "private/**" \
  --json

node .specify/extensions/taco/bin/taco.mjs sync \
  specs/001-example/001-example.taco.html \
  --project-root "$PWD" \
  --dry-run \
  --json

node .specify/extensions/taco/bin/taco.mjs comments \
  specs/001-example/001-example.taco.html \
  --status open \
  --json

node .specify/extensions/taco/bin/taco.mjs validate \
  specs/001-example/001-example.taco.html \
  --json
```

`pack` embeds every visible UTF-8 regular file below the feature root. Its only default exclusions are all `*.taco.html` files and paths containing a hidden segment beginning `.`. Repeatable `--ignore` values accept safe feature-relative paths or `*`, `?`, and `**` globs. The explicit ignore set is stored in the Taco and reused on refresh unless new `--ignore` values replace it. An unignored symlink, unsupported entry, or non-UTF-8 file is an error rather than a silent omission.

For every `.html` or `.htm` file, `pack` records the canonical absolute `file:` URL and validates that it ends in the same project-relative path. Missing or mismatched local URLs are rejected; the runtime never replaces them with a `data:` or Blob preview URL.

When refreshing a legacy Taco, `pack --from` accepts its missing old HTML URL only as migration input, preserves the existing Taco state, and immediately rewrites the entry with the canonical local URL. `validate` remains fail-closed until that refresh succeeds.

`sync` records a SHA-256 baseline for every packed file. If both the canonical file and Taco copy changed since packaging, the import refuses every write. `--force` exists only for deliberate recovery and may be used by an Agent only after explicit authorization for the exact conflict paths.

`validate` reads the inert Taco JSON block without executing the self-contained runtime. It reports `collab-secrets-present` before complete-file inspection when the Taco carries collaboration capabilities, and `runtime-security-outdated` when the shell predates the hardened runtime. It never prints credential values.

## Distribution contents

```text
extension.yml
commands/update.md
commands/review.md
bin/taco.mjs
assets/taco-shell.html
policies/taco-agent-policy.md
```

The shell and CLI are local. Creating, updating, opening, and reviewing a Taco requires no network connection. A collaboration-enabled Taco can contain access credentials; follow [`../../docs/agent-installation.md`](../../docs/agent-installation.md) before sending its content to any external model, service, log, or ticket.
