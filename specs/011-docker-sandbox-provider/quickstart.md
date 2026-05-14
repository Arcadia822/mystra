# Quickstart: Docker Sandbox Provider

## Goal

Validate that Mystra now has an explicit sandbox-provider boundary with
feature-local contracts, plan artifacts, and implementation tasks before
changing runner code.

## Review The Contract Artifacts

1. Read [spec.md](./spec.md), [plan.md](./plan.md), and
   [contracts/sandbox-provider.md](./contracts/sandbox-provider.md).
2. Confirm the contract treats the resolved runtime contract as the only launch
   input.
3. Confirm retained previews, port exposure, cancellation, timeout, and cleanup
   are modeled as provider-owned behavior.

## Review Current Code Evidence

Inspect the current implementation facts that the provider boundary must
eventually wrap:

```text
apps/runner-daemon/src/index.ts
apps/runner-daemon/assets/container-task.sh
packages/shared/src/schemas.ts
packages/shared/src/events.ts
```

## Future Implementation Verification Commands

Run these once shared or runner code starts consuming the formal contract:

```sh
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/shared test
pnpm typecheck
```

## Expected Outcomes

- Docker-specific launch behavior is documented as an implementation slice, not
  the stable cross-provider contract.
- Preview-port and cleanup semantics are explicit.
- Follow-on features can depend on the provider contract instead of reading
  ad hoc runner metadata conventions.
