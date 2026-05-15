---
description: "Generate a GitNexus-backed architecture map for an existing repository"
---

# Repository Architecture Command

Generate a deep architecture map for the current repository or the path in `$ARGUMENTS`.

## User Input

$ARGUMENTS

## Steps

1. Resolve the target repository. If `$ARGUMENTS` is empty, use the current repository.
2. Start with GitNexus evidence:
   - read `gitnexus://repo/mystra/context`
   - review `gitnexus://repo/mystra/clusters`
   - review `gitnexus://repo/mystra/processes`
   - inspect the most relevant `gitnexus://repo/mystra/process/{name}` resources
3. If GitNexus says the index is stale, run `npx gitnexus analyze --force` before proceeding.
4. Ground the architecture narrative in Mystra's durable context:
   - `PLATFORM.md`
   - `PROCESS.md`
   - `docs/ARCHITECTURE.md`
   - `docs/LOCAL-USAGE.md`
   - `specs/spec-status.md` when current implementation status matters
5. Read only the source files needed to confirm the high-signal architectural claims from GitNexus.
6. Focus on:
   - repo topology and module boundaries
   - major execution flows
   - control plane, runner, workflow, provider, and shared-contract seams
   - persistence model and runtime contracts
   - important external dependencies and operational constraints
7. Produce the architecture map in the current response unless the user explicitly asks for a file.
8. If the user explicitly requests persistence, write to `docs/repoindex/architecture.md`.

## Required output

Return a markdown report with:

1. **Architecture summary**
   - overall shape of the system
   - the main bounded areas and why they exist
2. **Top-level topology**
   - apps, packages, plugins, infrastructure directories
   - a small Mermaid diagram when it materially clarifies the structure
3. **Execution flows**
   - the highest-value product or runtime flows
   - cite GitNexus process names when available
4. **Core contracts**
   - important shared schemas, provider seams, runtime contracts, and API/MCP boundaries
5. **Persistence and state**
   - where durable state lives
   - what is orchestration-only versus source-of-truth state
6. **Operational constraints**
   - runner, sandbox, secret, and environment constraints that shape the design
7. **Change hazards**
   - the areas a maintainer should inspect before broad changes

## Output rules

- Prefer GitNexus processes and clusters over manual directory speculation.
- Tie architectural claims back to actual files or durable docs.
- Do not treat stale Spec-Kit task checkboxes as implementation proof without current evidence.
- Do **not** invent an output path under `.github/`; use chat by default.
