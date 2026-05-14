# Contract: Structured Sandbox Outcome

## Purpose

Mystra needs one provider-owned outcome shape that explains execution result,
preview exposure, retained-session state, and cleanup visibility without making
callers scrape runner logs or Docker-specific details.

## Proposed Shape

```ts
interface SandboxPortBinding {
  name?: string;
  containerPort: number;
  hostBinding?: string;
  url?: string;
  reachable: boolean;
}

interface CleanupOutcome {
  status: "succeeded" | "failed" | "skipped";
  attemptedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

interface SandboxOutcome {
  status: "succeeded" | "failed" | "canceled" | "timed_out";
  session: SandboxSession;
  ports: SandboxPortBinding[];
  cleanup: CleanupOutcome;
  metadata?: Record<string, unknown>;
}
```

## Notes

- `ports` must be present even when empty so consumers do not infer exposure from
  missing fields.
- `cleanup` is independent from the execution `status`; a task can succeed while
  cleanup fails.
- A retained preview container should be represented through the session data and
  exposed ports, not as a hidden side effect.
