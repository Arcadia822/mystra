# Data Model: MCP Server Development

## MCPHealthResponse

Route-local response for `mystra_health`.

| Field | Type | Notes |
|---|---|---|
| `controlPlane.status` | `"healthy"` | The control plane is answering the MCP request. |
| `runnerSummary.total` | `number` | Count of known runner sessions. |
| `runnerSummary.healthy` | `number` | Runners whose heartbeat age is within `staleAfterSeconds`. |
| `runnerSummary.degraded` | `number` | Runners whose heartbeat age exceeds `staleAfterSeconds`. |
| `runnerSummary.activeRuns` | `number` | Sum of runner `activeRunCount`. |
| `runners[]` | array | Per-runner health projection for operator/agent inspection. |

## MCPRunnerHealth

Projection derived from `PublicRunnerSession`.

| Field | Type | Source |
|---|---|---|
| `id` | `string` | `RunnerSession.id` |
| `runnerName` | `string` | `RunnerSession.runnerName` |
| `status` | `"healthy" | "degraded"` | Derived from heartbeat age vs `staleAfterSeconds` |
| `lastHeartbeatAt` | `string` | `RunnerSession.lastHeartbeatAt` |
| `staleAfterSeconds` | `number` | `RunnerSession.staleAfterSeconds` |
| `activeRunCount` | `number` | `RunnerSession.activeRunCount` |
| `maxConcurrency` | `number` | `RunnerSession.maxConcurrency` |
| `eligibleProjectIds` | `string[]?` | Existing route projection |
| `eligibleRuntimeProviders` | `string[]?` | Existing route projection |

## MCPError

JSON-RPC-style route-local error envelope.

| Field | Type | Notes |
|---|---|---|
| `code` | `number` | JSON-RPC-compatible negative code for method/params/tool errors |
| `message` | `string` | Human-readable summary |
| `data` | `object?` | Optional structured details such as tool name or validation issues |
