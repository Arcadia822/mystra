# Contract: Directory Context

## Purpose

Define what a subtree-level local context file must contain in the first slice
of feature `020`.

## First-Slice Coverage Set

- `apps/control-plane`
- `apps/runner-daemon`
- `packages/shared`

## Required Local Context Fields

Each covered subtree `AGENTS.md` must contain:

1. **Purpose**
   - one short explanation of what the subtree owns
2. **Read-first references**
   - the most relevant nearby docs or files for deeper understanding
3. **Narrow commands**
   - the package-specific commands most useful for work in that subtree
4. **Local invariants**
   - local rules that future agents should know before editing
5. **Scope note**
   - what belongs in the subtree file versus what stays in root 5xP

## Content Budget

Local context files should be concise:

- enough for orientation
- not a replacement for nearby README or deeper module docs
- not a copy of root 5xP content

## Compatibility Rule

If a covered subtree adds `CLAUDE.md`, that file must:

- be thinner than the local `AGENTS.md`
- point readers back to the canonical local `AGENTS.md`
- avoid adding local rules that exist nowhere else
