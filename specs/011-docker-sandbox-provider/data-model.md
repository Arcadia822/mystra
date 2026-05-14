# Data Model: Docker Sandbox Provider

## Entities

### SandboxLaunchRequest

The provider-owned input for one task execution environment.

| Field | Type | Notes |
|---|---|---|
| `runId` | UUID | Durable execution owner |
| `runtime` | `ResolvedRuntimeContract` | Provider-neutral launch input |
| `workspacePath` | string | Runner-prepared workspace root |
| `gitMirrorPath` | string? | Optional read-only mirror mount |
| `retentionPolicy` | `destroy_on_finish \| retain_for_preview` | Whether the session stays alive for review |
| `authBindings` | opaque list | Non-secret bindings consumed by downstream provider-specific logic |

### SandboxMountSpec

Provider-owned view of a launch-time mount.

| Field | Type | Notes |
|---|---|---|
| `kind` | `workspace \| gitMirror \| cache \| contextBundle \| secret` | Derived from runtime plus system mounts |
| `owner` | `system \| project \| runtime` | Ownership source |
| `target` | string | Container path |
| `sourceRef` | string? | Provider-local mount source reference |
| `readOnly` | boolean | Explicit mount mode |

### SandboxPortBinding

Structured preview-port exposure.

| Field | Type | Notes |
|---|---|---|
| `name` | string? | Optional service name such as `frontend` or `backend` |
| `containerPort` | integer | Port inside the container |
| `hostBinding` | string? | Host `ip:port` binding if exposed |
| `url` | string? | Reachable preview URL if known |
| `reachable` | boolean | Provider-observed reachability |

### SandboxSession

Provider-owned execution session.

| Field | Type | Notes |
|---|---|---|
| `provider` | `docker` | First implementation value |
| `sessionId` | string | Container name or provider-local handle |
| `status` | `starting \| running \| stopped \| retained \| cleanup_failed` | Provider-local lifecycle state |
| `startedAt` | timestamp | Start time |
| `finishedAt` | timestamp? | Terminal time when known |
| `retained` | boolean | Whether the execution environment stays alive for review |

### CleanupOutcome

Structured record of stop/cleanup behavior.

| Field | Type | Notes |
|---|---|---|
| `status` | `succeeded \| failed \| skipped` | Cleanup attempt result |
| `attemptedAt` | timestamp | When cleanup ran |
| `errorCode` | string? | Failure class such as `cleanup_failed` |
| `errorMessage` | string? | Human-readable explanation |

### SandboxOutcome

The final provider-owned execution outcome consumed by Mystra.

| Field | Type | Notes |
|---|---|---|
| `status` | `succeeded \| failed \| canceled \| timed_out` | Execution result |
| `session` | `SandboxSession` | Execution session metadata |
| `ports` | `SandboxPortBinding[]` | Structured preview exposure |
| `cleanup` | `CleanupOutcome` | Cleanup visibility |
| `metadata` | object | Provider-specific diagnostics |

## State Notes

- `retentionPolicy = retain_for_preview` allows `SandboxSession.status = retained`
  after successful execution.
- Cleanup failure is orthogonal to execution status and must be preserved in
  `SandboxOutcome.cleanup`.
- Preview-port absence should be reported as an explicit empty `ports` list, not
  inferred from missing fields.
