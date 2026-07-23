# Direct Execution Test Evidence

Date: 2026-07-23

The runner no longer resolves a provider-owned execution graph. The fixed service
owns this sequence:

```text
launch sandbox -> clone -> Copilot Agent -> test -> build
```

Preview probing, commit/push and review creation follow only after both quality
phases pass.

Focused verification:

```text
@mystra/agent-adapters: 6 tests passed
@mystra/runner-daemon: 81 tests passed
@mystra/runner-daemon typecheck: passed
bash -n apps/runner-daemon/assets/container-task.sh: passed
```

The tests cover bounded Copilot autopilot, phase/event order, Agent failure and
no-change handling, independent test/build results, generic preview, clone mirror
fallback, GitHub askpass delivery, PR reuse, cancellation/timeout cleanup
projections, strict two-2xx preview probing, GitHub 403/500 redaction and retained
sandbox handoff. Issue dispatch and Docker runner claim capability are intentionally
Copilot-only until another direct Agent result contract is implemented.

Exact active-source search across runner, shared, control-plane source and package
metadata returned no workflow provider, graph, blueprint, registry or node-execution
abstraction.
