# Contract: `SandboxProvider`

## Purpose

`SandboxProvider` is the Mystra-owned boundary for task execution environments:
launching from a resolved runtime contract, observing execution/session
metadata, exposing preview ports, stopping for timeout/cancel, and reporting
cleanup outcomes.

## Responsibilities

- Launch an execution environment from `ResolvedRuntimeContract`.
- Translate provider-neutral runtime mounts, caches, secrets, and ports into
  provider-specific execution details.
- Observe exposed preview ports and provider session metadata.
- Stop execution for cancellation, timeout, or shutdown.
- Return a structured sandbox outcome, including cleanup visibility.

## Non-Responsibilities

- Resolving the runtime contract from project/job configuration.
- Choosing workflow order or repository-review behavior.
- Generating agent commands or prompt content.

## Proposed Type Surface

```ts
interface SandboxLaunchRequest {
  runId: string;
  runtime: ResolvedRuntimeContract;
  workspacePath: string;
  gitMirrorPath?: string;
  retentionPolicy: "destroy_on_finish" | "retain_for_preview";
}

interface SandboxSession {
  provider: "docker";
  sessionId: string;
  status: "starting" | "running" | "stopped" | "retained" | "cleanup_failed";
  startedAt: string;
  finishedAt?: string;
  retained: boolean;
}

interface SandboxObservation {
  session: SandboxSession;
  ports: SandboxPortBinding[];
  metadata?: Record<string, unknown>;
}

interface SandboxProvider {
  readonly providerName: string;
  launch(input: SandboxLaunchRequest): Promise<SandboxSession>;
  inspect(session: SandboxSession): Promise<SandboxObservation>;
  stop(session: SandboxSession, reason: "cancel" | "timeout" | "shutdown"): Promise<CleanupOutcome>;
  collectOutcome(session: SandboxSession): Promise<SandboxOutcome>;
}
```

## Leakage Guards

Shared Mystra contracts must **not** leak:

- Raw Docker CLI flags or container lifecycle commands.
- Host-specific filesystem layout assumptions outside declared mounts and cache
  paths.
- Docker-only port-binding syntax as the stable preview contract.
- Baked-in secret or Docker-socket requirements.

## First Implementation Mapping

| Concern | Current implementation fact | Planned contract owner |
|---|---|---|
| Launch | Docker args in `apps/runner-daemon/src/index.ts` | `SandboxProvider.launch()` |
| Preview ports | Port probing and preview URL assembly in runner/script | `SandboxObservation` / `SandboxOutcome.ports` |
| Cancel / timeout | stop/kill logic in `apps/runner-daemon/src/index.ts` | `SandboxProvider.stop()` |
| Cleanup failure | `run.cleanup_failed` event plus result fallback | `CleanupOutcome` / `SandboxOutcome.cleanup` |

## Verification

- Docker implementation can satisfy the provider-neutral launch/session/outcome
  contract without changing the resolved runtime contract shape.
- A future non-Docker provider can fit the same launch/session/outcome boundary.
