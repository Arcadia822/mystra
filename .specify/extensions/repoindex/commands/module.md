---
description: "Generate a focused GitNexus-backed module index for an existing repository"
---

# Repository Module Command

Generate a focused module index for the module or path in `$ARGUMENTS`.

## User Input

$ARGUMENTS

## Steps

1. Require a module name or path in `$ARGUMENTS`. If it is missing, stop and ask for the target module instead of guessing.
2. Refresh GitNexus evidence first:
   - read `gitnexus://repo/mystra/context`
   - if stale, run `npx gitnexus analyze --force`
3. Use GitNexus to narrow the scope:
   - query the module concept or path
   - inspect relevant processes
   - inspect context for the highest-signal symbols in the module
4. Read the smallest useful local context:
   - nearest package manifest
   - nearby README or local docs if present
   - relevant 5xP or feature spec docs only when they explain the module boundary
5. Read source files only after GitNexus identifies the key symbols, flows, and neighbors.
6. Produce the module index in the current response unless the user explicitly asks for a file.
7. If the user explicitly requests persistence, write to `docs/repoindex/modules/<module-name>.md`.

## Required output

Return a markdown report with:

1. **Module purpose**
   - what the module owns
   - what it explicitly does not own
2. **Boundaries**
   - entry points
   - main public contracts
   - important inbound and outbound dependencies
3. **Key symbols and files**
   - the highest-value files to read first
   - the most important exported symbols, handlers, services, or routes
4. **Execution flows**
   - the most important flows touching this module
   - cite GitNexus process names when available
5. **Data and contracts**
   - schemas, state, persistence touchpoints, environment/config requirements
6. **Verification commands**
   - the narrowest useful test, build, or typecheck commands for the module
7. **Change risks**
   - what else a maintainer should inspect before editing here

## Output rules

- Prefer GitNexus symbol and process evidence over ad-hoc file walks.
- If the module participates in a broader workflow, say which neighboring module owns the adjacent step.
- If GitNexus is unavailable, say so and fall back to direct file analysis.
- Do **not** invent an output path under `.github/`; use chat by default.
