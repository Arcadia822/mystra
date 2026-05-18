# ADR-0002: Hosted Supabase and Control-Plane MCP Endpoint

## Status

Superseded by ADR-0004 for RDB provider selection. The control-plane MCP endpoint decision remains relevant.

## Context

The MVP control plane is intended to run on Vercel. A local-only database would make the deployed control plane unable to persist jobs, runner sessions, structured events, results, and artifacts without extra tunneling.

Mystra also needs to be controlled by agents through MCP. Running a separate MCP bridge would add another deployment and authentication surface before the core job lifecycle is proven.

## Decision

Use the configured `RdbProvider` for MVP shared state. ADR-0004 selects local SQLite as the first implementation. Hosted Supabase/Postgres may return later as a cloud provider implementation, but is not the initial MVP requirement.

Expose Mystra's MCP surface from `apps/control-plane` using official Streamable HTTP semantics. Do not build a separate stdio MCP server in the MVP.

Use a shared runner registration token for private runner enrollment. After registration, the control plane issues a runner session token for polling, structured event writes, and result submission.

The MVP does not add control-plane caller authentication, callback URLs, retry tools, or log tools. The exposed MCP tools are limited to job creation, job inspection, cancellation, and runner listing.

## Consequences

Positive:

- The control plane and MCP endpoint share one persistence contract through `RdbProvider`.
- The MCP and HTTP APIs share validation, auth, schemas, and database access.
- Agents can control Mystra remotely without requiring a local stdio bridge.
- Runner registration is simple enough for MVP while still avoiding anonymous runner enrollment.

Negative:

- A future hosted provider will need separate deployment and credential handling.
- HTTP/SSE MCP support is the only first-class MCP transport in MVP.
- Runner shared secret rotation must be handled deliberately.
- Public unauthenticated control-plane access is an accepted MVP risk and must be revisited before broader deployment.
- Without log tools, MCP clients only inspect structured events and final results.

## Verification

The decision is validated when:

1. `apps/control-plane` can create a job through HTTP and Streamable HTTP MCP endpoints against the configured `RdbProvider`.
2. A runner can register with `RUNNER_REGISTRATION_TOKEN`.
3. The runner can poll, append structured events, and submit a result using its issued session token.
4. No separate MCP bridge is required for the MVP control path.
