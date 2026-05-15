---
description: "Generate a GitNexus-backed overview for an existing repository"
---

# Repository Overview Command

Generate a repository overview for the current repo or the path in `$ARGUMENTS`.

## User Input

$ARGUMENTS

## Steps

1. Resolve the target repository. If `$ARGUMENTS` is empty, use the current repository.
2. Refresh structure evidence before analysis:
   - Read `gitnexus://repo/mystra/context` when available.
   - If GitNexus reports the index as stale, run `npx gitnexus analyze --force`.
3. Build the overview from durable project context first:
   - `AGENTS.md`
   - `PRODUCT.md`
   - `PLATFORM.md`
   - `PROCESS.md`
   - root `package.json`
4. Then add current-state evidence from:
   - `docs/ARCHITECTURE.md`
   - `docs/LOCAL-USAGE.md`
   - `specs/spec-status.md`
   - top-level package/app manifests that define runnable surfaces
5. Use GitNexus structure data to confirm:
   - major modules and package boundaries
   - execution-flow-heavy surfaces
   - high-signal clusters that a new contributor should know first
6. Produce the overview in the current response unless the user explicitly asks for a file.
7. If the user explicitly requests persistence, write to `docs/repoindex/overview.md`.

## Required output

Return a concise markdown report with:

1. **Purpose**
   - what the repository is for
   - who it serves
   - what is explicitly out of scope for the current MVP
2. **Runtime shape**
   - monorepo layout
   - apps/packages/plugins at a glance
   - primary runtime and storage choices
3. **Main workflows**
   - the 3-5 most important execution paths or product flows
4. **Operator commands**
   - install, build, test, typecheck, doctor, dev
   - any important focused commands
5. **Current status snapshot**
   - highlight the most relevant repo-wide status signals
   - call out if status came from `specs/spec-status.md`
6. **Where to read next**
   - point to the highest-value files for onboarding

## Output rules

- Prefer GitNexus-backed structural claims over guesses from folder names alone.
- Prefer 5xP and durable docs over chat memory.
- If GitNexus is unavailable, say so plainly and fall back to file-based analysis.
- Do **not** invent a repo-local output path under `.github/`; use chat by default.