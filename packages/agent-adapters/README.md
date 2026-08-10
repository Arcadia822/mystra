# Agent Adapters

This package owns provider-specific command construction and output parsing.
Feature 049 adds `ProviderSessionAdapter`, which reuses the existing Codex and
Copilot command policy while exposing explicit start and continuation commands.

- Codex starts with JSONL output and recovers the native thread ID from
  `thread.started`; continuation uses `codex exec resume` with that ID.
- Copilot uses the Mystra Session UUID as its stable `--session-id` for both the
  initial request and later messages.
- The first user message remains a user message. It is delivered with the
  frozen system prompt in the initial provider invocation, but is not stored as
  part of the system prompt event.
- Adapters never invent Turn IDs, Session capacity, Workspace paths, or database
  records. The runner resolves the Workspace attachment and owns process I/O.

## Commands

```sh
pnpm --filter @mystra/agent-adapters test
pnpm --filter @mystra/agent-adapters typecheck
```
