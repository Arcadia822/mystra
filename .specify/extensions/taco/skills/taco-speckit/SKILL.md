---
name: taco-speckit
description: Taco workflow inside an initialized Spec Kit project — assemble the feature review file by writing the bundle JSON into the shell, open it in the user's browser when the host permits local files, and consume human review via Handoff or browser inspection. Use in place of the generic taco skill whenever the target project has a .specify/ directory and the Taco extension is installed.
---

# Taco for Spec Kit projects

This is the Spec Kit-bound Taco flow, used when the Taco extension is installed in the target project (`.specify/extensions/taco/` via `specify extension add`) with commands, hooks, and persistent policy. For any directory outside such a project — RFCs, ADRs, architecture docs in a plain repo or sandbox, or a Spec Kit feature directory with only the generic skill installed — use the generic `taco` skill instead; the bundle format and workflow are identical.

## Commands

```text
speckit.taco.update [feature-directory] [--ignore path-or-glob]...
speckit.taco.review [path-to-file.taco.html]
```

- `update` creates or refreshes `<FEATURE_DIR>/<feature-name>.taco.html` by assembling the bundle JSON into the shell (no CLI). It reads the existing Taco before overwriting it, excludes every `*.taco.html`, and preserves `docId`, `comments`, `navigation`, and every other stored bundle field. Mandatory hooks invoke it after `specify`, `clarify`, `plan`, `checklist`, `tasks`, `analyze`, `implement`, and `converge`; the Agent invariant also requires it after any canonical feature-artifact change made outside those commands.
- `review` consumes the review — Handoff text, the review tab's `window.taco.getReviewHandoff()` object, or the saved file's bundle — applies edits and comments to canonical files, and re-runs `update`. Handoff and the review-tab API need no save; only the saved-file channel does.

## Authoring feature artifacts

Choose the smallest carrier appropriate to the information; keep full machine-readable definitions authoritative rather than duplicating them in prose:

- `spec.md`: goals, scenarios, scope, constraints, acceptance criteria. `plan.md`: module boundaries, implementation order, risks, verification.
- Cross-component interactions, flows, sequences, state machines: write `diagrams/*.mmd` (Mermaid source) in the feature directory and link it from the prose; small in-place illustrations may stay embedded.
- HTTP APIs: maintain `contracts/openapi.yaml` (or `.json`) as the single authoritative definition. Markdown explains semantics and trade-offs; never keep a parallel full endpoint table.
- Data structures: `data-model.md` for entity relationships, invariants, lifecycle; JSON Schema (or the target protocol's native format) when machine validation is needed. Do not invent a new format to satisfy "data model".
- WebSocket/event protocols: message schemas plus sequence/state diagrams and short semantics — not OpenAPI.

Two shapes:

```text
complex feature "001-search"
  spec.md                 goals, scenarios, constraints, acceptance criteria
  diagrams/flow.mmd       Mermaid flow/sequence/state source, linked from spec.md
  contracts/openapi.yaml  the single authoritative HTTP definition
  data-model.md           entities, invariants, lifecycle

small task "fix-pagination-copy"
  spec.md                 the only file; no diagrams/, contracts/, or data-model.md
```

Rules: relative links connect spec/plan to the authoritative files; one definition per contract, updated at the source; every standalone file must be real, parseable content that matches the prose (diagram edges/states, OpenAPI fields/responses, schema constraints). Small tasks (copy edits, local rule changes) stay single-file Markdown — no placeholder diagrams or schemas. These files are canonical feature artifacts: changing them requires `speckit.taco.update` per the Agent invariant.

## Presentation and verification

After creating or refreshing a Taco, always present its exact absolute path as a native clickable file. When the host explicitly supports and permits autonomous local HTML navigation, proactively open that file in the user's browser and verify the expected title and document content are visible; do not ask again just to open it — the file path is often hard to find. A headless or automation boot check is internal evidence only: it is not a user-visible open and must never be reported as one. Preserve any existing unsaved review by using a separate tab instead of reloading it. If opening is unavailable, prohibited, or fails, keep the clickable-file handoff and report why it was not opened or verified. In Codex, retain the user-click handoff: do not autonomously navigate to `file://`. Never bypass restrictions with `data:`/Blob URLs, a development server, external uploads, or weakened browser security. Report exactly one of `presented as a clickable file`, `opened` (user-visible), or `opened and verified` (user-visible), plus a separate note when only internal headless evidence exists.

Full procedures — bundle assembly rules (shell location, `taco/files` v1 shape, escaping, `docId`/`comments`/`navigation` preservation, conflict handling, done-criteria) — live in the installed command definitions:

- `.specify/extensions/taco/commands/update.md`
- `.specify/extensions/taco/commands/review.md`

The persistent workflow policy installed by `prepare-policy` (a marked process document plus one `AGENTS.md` routing reference) governs when these commands run. Read it before any Spec Kit or Taco work in the project.

## Optional Spec Kit extension integration

The generic `taco` skill already covers Spec Kit feature directories — no project installation is required. An optional deeper integration exists for projects that want the commands registered as Spec Kit extension commands with mandatory lifecycle hooks and a persistent project policy. Install it from a Taco source checkout:

```bash
specify extension add taco --dev /absolute/path/to/taco/extensions/taco
```

A published release archive follows `taco-extension-v<version>.zip` on the release tag, but only a release that already contains this CLI-free workflow should be used. Check the [releases page](https://github.com/Arcadia822/taco/releases) (or `gh release list -R Arcadia822/taco`) and use that tag and asset; do not pin a version that predates this guidance, and do not assume an unreleased tag exists. See `extensions/taco/README.md` (Release installation, and the prepare-policy/routing contract) for the complete extension contract.
