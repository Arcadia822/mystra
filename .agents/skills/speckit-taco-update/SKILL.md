---
name: speckit-taco-update
description: Create or refresh the Taco for the active Spec Kit feature.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: taco:commands/update.md
---

# Update Taco review artifact

## User input

```text
$ARGUMENTS
```

The user input may contain one feature-directory path followed by repeatable `--ignore <feature-relative-path-or-glob>` options. This command is also invoked by mandatory lifecycle hooks, where input is normally empty.

## Procedure

1. Work from the repository root. Confirm `.specify/` and `.specify/extensions/taco/assets/taco-shell.html` exist. If either is missing, stop with the exact missing path.
2. Resolve the feature directory:
   - If the user supplied a path, resolve that exact path and require `<path>/spec.md`.
   - When invoked as a lifecycle hook, use the exact feature directory produced or changed by the immediately preceding Spec Kit command.
   - Otherwise use the active core Spec Kit integration's project-level feature resolver and read its `FEATURE_DIR` result.
   - If these sources do not identify exactly one feature directory, stop and ask for the path. Never select by modification time.
3. Assemble the bundle without any CLI:
   - **Read the existing `<FEATURE_DIR>/<feature-name>.taco.html` first, before copying anything.** Copying the shell over it first would destroy the reviewed bundle and make you read your own fresh copy. Parse its `#taco-document` block and keep the whole previous bundle — `docId`, `comments`, `navigation`, `access`, `collab`, `packOptions`, and any unknown fields — plus every file's `id`, `title`, `sourceUrl`, `sourceHash`, and `blocks`.
   - Read the shell into memory, without overwriting the destination. Its starter bundle is not the prior review and must not supply a new document's identity.
   - Read regular files under the feature directory. Exclude dotfiles and every `*.taco.html`. Reuse the previous `packOptions.ignore` set unless new `--ignore` patterns were requested. Report exclusions; stop on unhandled symlinks, non-UTF-8 files, invalid PNGs or unsupported entries rather than following or silently skipping them.
   - Build `files[]` as `{ id?, title?, path, mediaType, content, sourceUrl?, sourceHash?, blocks? }` with raw on-disk contents. `path` must be `<root>/<feature-relative POSIX path>`, safe (no `..`, no backslashes, no empty/`.` segments), unique, and under `root`.
   - `mediaType`: `.md` → `text/markdown`; `.json` → `application/json`; `.yaml`/`.yml` → `application/yaml`; `diagrams/*.mmd` → `text/plain`; `.png` → `image/png` with a `data:image/png;base64,…` content; `.html`/`.htm` → `text/html` with a canonical `file:` `sourceUrl` whose decoded pathname ends with that file's `path`; any other text → `text/plain`.
   - Match previous file entries by path and preserve unknown fields and stable `id`. Keep `title` only if non-empty; recompute `sourceHash` (64 hex chars) from canonical source bytes when changed. For HTML, derive `sourceUrl` from the actual source file's canonical absolute path with a file-URL API; require no host, credentials, query or fragment. No other file may have `sourceUrl`. Keep `blocks` only when `content` is byte-identical; drop stale blocks otherwise.
   - Every comment's `anchor.path` must still be present in `files`. If a commented source file disappeared, retain its prior bundle entry and report it; never silently remove its comments.
   - For a new Taco, use `format: "taco/files"`, `version: 1`, a unique `docId` (`crypto.randomUUID()`), `title`, repository-relative safe `root` and `files`.
   - On refresh, merge intended changes onto the whole previous bundle; retain identity, root, format/version and all other state. Stop for unsupported format/version instead of downgrading. Confirm any pending review edits were handled before replacing their file contents.
   - Serialize with `JSON.stringify(bundle, null, 2)`, then escape `<`, `>`, `&`, `\u2028`, `\u2029` as `\uXXXX`. Insert it into the single `#taco-document` block with a **callback** replacement — `html.replace(dataBlock, () => replacement)` — or an index splice; a plain replacement string expands `$&`, `` $` ``, `$'`, `$1` from the JSON. Set `<title>` to the HTML-escaped `<bundle title> — Taco` using the same safe insertion technique. Touch nothing else in the shell.
   - Validate before writing: `JSON.parse` the exact escaped string (it must round-trip) and check the shape rules above. Write the complete file to a temporary sibling and rename it over the destination, so a failed write never truncates the existing Taco.
4. Present the generated Taco to the user:
   - Always use the active Agent GUI's native clickable local-file or artifact presentation for the exact absolute output path.
   - When local HTML navigation is explicitly supported and permitted, proactively open the exact generated file in the user's browser and verify its expected title and document content are visible; do not ask again merely to open it. Use a separate tab rather than reloading an existing review with unsaved edits or comments. If browser tools are unavailable, navigation is prohibited (in Codex, do not autonomously navigate to `file://`), or opening fails, keep the clickable-file handoff and report the reason without bypassing the restriction.
   - A headless or automation boot check is internal evidence only. It is not a user-visible presentation and must not be reported as `opened` or `opened and verified`.
   - Never substitute a `data:` or Blob URL, development application, different Taco, external upload, or weakened browser security setting for the local file. Keep credential-bearing files within the authorized local environment.
5. Report the absolute Taco path, embedded file count, exclusions, preserved comment count, and presentation status. Distinguish `presented as a clickable file`, `opened` (user-visible), and `opened and verified` (user-visible); claim verification only after observing the expected title and content in the user's browser. Do not require the reviewer to save before Handoff — Handoff and `window.taco.getReviewHandoff()` carry unsaved edits; say that saving (⌘S) is needed only if review will be consumed from the saved file by `$speckit-taco-review`.

## Agent invariant

Whenever you modify any canonical artifact inside a Spec Kit feature directory outside a lifecycle hook—including specification, clarification, plan, tasks, research, data model, contracts, checklists, or recorded implementation progress—run this command before reporting that operation complete.

## Constraints

- The feature directory remains canonical; Taco is a review transport.
- Never delete feature files during update.
- Only the `#taco-document` block and `<title>` are agent-writable; never touch the shell around them.
- Preserve `docId`, `comments`, `navigation`, and every other stored bundle field; never fabricate comments or hashes.
- Never fill in a document block from a destination you have not read; never blind-overwrite the previous Taco or a canonical file.

## Done when

- The in-directory Taco exists at the reported path with a valid `taco/files` v1 bundle that the runtime parses (not Recovery mode).
- Its bundle `root` matches the feature directory and its embedded file count is nonzero with all exclusions reported.
- The Taco is exposed through the Agent GUI's native clickable local-file presentation. Where supported and permitted, it was proactively opened and its title and document content checked in the user's browser; otherwise the unavailable, prohibited, or failed browser step is reported separately. A headless check alone does not satisfy this.
- The reviewer has the explicit next command: `$speckit-taco-review <path-to-file.taco.html>`.