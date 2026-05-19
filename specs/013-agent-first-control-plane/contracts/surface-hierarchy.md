# Contract: Management Surface Hierarchy

## Purpose

Define the required priority order for Mystra management capabilities so future
work is reviewed against the same agent-first rule.

## Priority Order

```text
canonical API
  -> coordinating skills
  -> operator CLI
  -> MCP adapter / other transport adapters
  -> UI consumers
```

This is a product and review rule, not just an implementation preference.

## Surface Responsibilities

| Surface | Role | Must do | Must not do |
|---|---|---|---|
| Canonical API | Product truth | Own stable actions, shared envelopes, durable management semantics | Depend on UI behavior or MCP formatting |
| Coordinating skills | Agent runtime surface | Package structured submission and status flows for coordinating agents | Redefine payload semantics or invent hidden endpoints |
| Operator CLI | Shell-first operator surface | Reuse canonical actions for inspection and retrieval from Debian shell | Become a special operator-only truth |
| MCP adapter | Tool transport | Translate canonical actions into MCP tool calls | Carry management semantics only in tool descriptions |
| UI | Human-facing consumer | Display and consume existing management facts | Be the only place where a capability exists |

## Review Questions

Every management capability introduced under `013` or its child specs should
answer "yes" to all of these:

1. Does the capability exist in the canonical management API?
2. Can the coordinating skill surface consume it without parsing ad hoc text?
3. Can the CLI expose the same fact without inventing a separate semantic layer?
4. If MCP exposes it, is MCP adapting the canonical contract rather than
   replacing it?
5. If the UI displays it, would the capability still exist without the UI?

## Failure Conditions

The feature should be considered incomplete if any of these are true:

- a required management action exists only in the UI
- the coordinating skills need a prompt manual to explain transport details
  instead of using one local structured surface
- the CLI reports outcomes that the canonical API cannot express
- MCP defines semantics that are not present in the canonical API/shared schema
- coordination summaries diverge from durable run/result truth
