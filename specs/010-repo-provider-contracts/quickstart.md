# Quickstart: Repository Provider Contracts

## Goal

Validate that Mystra now has an explicit repository-provider boundary with
feature-local contracts, plan artifacts, and implementation tasks before
changing code.

## Review The Contract Artifacts

1. Read [spec.md](./spec.md), [plan.md](./plan.md), and
   [contracts/repo-provider.md](./contracts/repo-provider.md).
2. Confirm the contract keeps GitLab and GitHub inside the MVP boundary.
3. Confirm auth is modeled as an opaque provider binding/reference rather than a
   per-repository secret-management feature.

## Review Current Code Evidence

Inspect the current implementation facts that the contract must eventually
replace:

```text
apps/runner-daemon/assets/container-task.sh
apps/runner-daemon/src/index.ts
packages/shared/src/result.ts
packages/shared/src/events.ts
```

## Future Implementation Verification Commands

Run these once shared or runner code starts consuming the formal contract:

```sh
pnpm --filter @mystra/shared test
pnpm --filter @mystra/control-plane test
pnpm --filter @mystra/runner-daemon test
pnpm typecheck
```

## Expected Outcomes

- Repository delivery semantics are documented without relying on raw GitLab API
  behavior as the stable contract.
- Branch-push success and review-creation success are treated as separate
  outcomes.
- GitHub remains a required implementation target inside the contract.
