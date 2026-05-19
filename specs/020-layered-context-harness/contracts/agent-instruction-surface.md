# Contract: Agent Instruction Surface

## Purpose

Define the canonical and compatibility roles of root and subtree instruction
files for the first slice of feature `020`.

## Canonical Surfaces

### Root canonical surface

- Path: `AGENTS.md`
- Role: repository-wide durable agent-facing policy
- Owns:
  - routing to 5xP and Spec-Kit
  - durable project rules
  - agent workflow and local skill routing
- Must not depend on `CLAUDE.md` as a semantic owner

### Subtree canonical surface

- Path: `<subtree>/AGENTS.md`
- Role: local durable context for one covered subtree
- Owns:
  - subtree purpose
  - narrow commands
  - local invariants
  - pointers to deeper nearby docs
- Must not re-state all repository-wide policy from root `AGENTS.md`

## Compatibility Surfaces

### Root compatibility surface

- Path: `CLAUDE.md`
- Role: compatibility shim for tools that auto-load Claude-specific context
- Must:
  - point to canonical root `AGENTS.md`
  - avoid owning divergent durable policy

### Subtree compatibility surface

- Path: `<subtree>/CLAUDE.md`
- Role: compatibility shim for subtree autoload behavior
- Must:
  - point to canonical local `<subtree>/AGENTS.md`
  - stay thin and non-authoritative

## Invariants

1. `AGENTS.md` is canonical; `CLAUDE.md` is compatibility.
2. Compatibility files must never become the only place a durable rule exists.
3. If the two surfaces diverge, `AGENTS.md` wins and the divergence is treated
   as a harness defect.
4. New agent ecosystems may add compatibility files later, but the canonical
   neutral surface remains stable.
